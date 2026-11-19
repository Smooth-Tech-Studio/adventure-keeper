import {
  addDoc,
  arrayUnion,
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import {
  COLLECTIONS,
  DEFAULT_CHARACTER_SYSTEM,
  campaignMemberSchema,
  campaignSchema,
  characterSystemSatisfies,
  memberCharacterIds,
  type Campaign,
  type CampaignMember,
  type CharacterSystem,
  type GameSystem,
  type WithId,
} from "@adventure-keeper/schemas";

import { db } from "@/lib/firebase";
import { deleteAdventure, listAdventuresForPlayer } from "@/lib/adventures";
import { hasUnreadRecap } from "@/lib/recap-seen";
import { deleteCodex } from "@/lib/codex";
import { deleteQuests } from "@/lib/quests";
import { getCharacter } from "@/lib/characters";
import { byUpdatedAtDesc, deleteAllDocs, parseDoc } from "@/lib/firestore";
import { tr } from "@/i18n";

export interface CreateCampaignInput {
  name: string;
  description?: string;
  system: GameSystem;
  systemLabel?: string;
  /** Character rules module the campaign requires. Defaults to `dnd2024`. */
  characterSystem?: CharacterSystem;
}

/** Legacy docs written before the field existed get the default on read. */
function withCharacterSystem<T extends { characterSystem?: CharacterSystem }>(campaign: T): T {
  return campaign.characterSystem
    ? campaign
    : { ...campaign, characterSystem: DEFAULT_CHARACTER_SYSTEM };
}

export interface CampaignOwner {
  uid: string;
  displayName: string | null;
  email: string | null;
}

/** Create a campaign and its `gm` member document. Returns the campaign id. */
export async function createCampaign(
  input: CreateCampaignInput,
  owner: CampaignOwner,
): Promise<string> {
  const now = serverTimestamp();

  const campaignRef = await addDoc(collection(db, COLLECTIONS.campaigns), {
    name: input.name,
    description: input.description,
    system: input.system,
    systemLabel: input.systemLabel,
    characterSystem: input.characterSystem ?? DEFAULT_CHARACTER_SYSTEM,
    ownerId: owner.uid,
    memberIds: [owner.uid],
    isArchived: false,
    createdAt: now,
    updatedAt: now,
  });

  await setDoc(doc(db, COLLECTIONS.campaigns, campaignRef.id, COLLECTIONS.members, owner.uid), {
    uid: owner.uid,
    role: "gm",
    status: "active",
    displayName: owner.displayName || owner.email || tr("common:gm"),
    joinedAt: now,
    createdAt: now,
    updatedAt: now,
  });

  return campaignRef.id;
}

export async function listMyCampaigns(uid: string): Promise<WithId<Campaign>[]> {
  const snapshot = await getDocs(
    query(collection(db, COLLECTIONS.campaigns), where("memberIds", "array-contains", uid)),
  );
  return snapshot.docs
    .map((d) => withCharacterSystem(parseDoc<Campaign>(campaignSchema, d)))
    .sort(byUpdatedAtDesc);
}

export async function getCampaign(id: string): Promise<WithId<Campaign> | null> {
  const snapshot = await getDoc(doc(db, COLLECTIONS.campaigns, id));
  if (!snapshot.exists()) return null;
  return withCharacterSystem(parseDoc<Campaign>(campaignSchema, snapshot));
}

/** Rename a campaign (owner only, per Firestore rules). */
export async function renameCampaign(id: string, name: string): Promise<void> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("EMPTY_CAMPAIGN_NAME");
  await updateDoc(doc(db, COLLECTIONS.campaigns, id), {
    name: trimmed,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Delete a campaign and everything under it (owner only, per Firestore rules):
 * every adventure with its whole subtree, plus members, notes,
 * resources, the codex and the quests. The campaign document goes last so the child deletes still
 * pass the `ownsCampaign()` rule.
 */
export async function deleteCampaign(id: string): Promise<void> {
  const campaignRef = doc(db, COLLECTIONS.campaigns, id);

  const adventures = await getDocs(collection(campaignRef, COLLECTIONS.adventures));
  for (const adventure of adventures.docs) {
    await deleteAdventure(id, adventure.id);
  }

  await Promise.all([
    deleteAllDocs(collection(campaignRef, COLLECTIONS.members)),
    deleteAllDocs(collection(campaignRef, COLLECTIONS.notes)),
    deleteAllDocs(collection(campaignRef, COLLECTIONS.resources)),
    deleteCodex(id),
    deleteQuests(id),
  ]);

  await deleteDoc(campaignRef);
}

/**
 * Campaigns where this player still has to pick a character — the
 * "à faire" part of the notifications. One member read per campaign.
 */
export async function listCampaignsMissingMyCharacter(uid: string): Promise<WithId<Campaign>[]> {
  const campaigns = (await listMyCampaigns(uid)).filter((c) => c.ownerId !== uid && !c.isArchived);
  const members = await Promise.all(
    campaigns.map((c) =>
      getDoc(doc(db, COLLECTIONS.campaigns, c.id, COLLECTIONS.members, uid)).then((d) =>
        d.exists() ? parseDoc<CampaignMember>(campaignMemberSchema, d) : null,
      ),
    ),
  );
  return campaigns.filter((_, i) => members[i] && !members[i].characterId);
}

/** A published recap the player has not opened yet, for the bell. */
export interface UnreadRecap {
  campaignId: string;
  campaignName: string;
  adventureId: string;
  adventureTitle: string;
}

/** Adventures of the player's campaigns whose latest recap they have not read. */
export async function listUnreadRecaps(uid: string): Promise<UnreadRecap[]> {
  const campaigns = (await listMyCampaigns(uid)).filter((c) => c.ownerId !== uid && !c.isArchived);
  const perCampaign = await Promise.all(
    campaigns.map(async (campaign) =>
      (await listAdventuresForPlayer(campaign.id, uid).catch(() => []))
        .filter(hasUnreadRecap)
        .map((adventure) => ({
          campaignId: campaign.id,
          campaignName: campaign.name,
          adventureId: adventure.id,
          adventureTitle: adventure.title,
        })),
    ),
  );
  return perCampaign.flat();
}

/**
 * Make `characterId` the member's active character, adding it to their roster
 * if it is new there. The other characters stay in the roster. The character
 * notes the campaign in `campaignIds` (its GM and members may then read it) —
 * and keeps it after leaving the roster, for the adventures it played there.
 */
export async function setMemberCharacter(
  campaignId: string,
  uid: string,
  characterId: string,
): Promise<void> {
  const [campaign, character] = await Promise.all([
    getCampaign(campaignId),
    getCharacter(characterId),
  ]);
  if (
    campaign &&
    character &&
    !characterSystemSatisfies(character.system, campaign.characterSystem)
  ) {
    throw new Error("CHARACTER_SYSTEM_MISMATCH");
  }
  const ref = doc(db, COLLECTIONS.campaigns, campaignId, COLLECTIONS.members, uid);
  const current = await getDoc(ref);
  const roster = current.exists() ? memberCharacterIds(current.data() as CampaignMember) : [];
  const batch = writeBatch(db);
  batch.update(ref, {
    characterId,
    characterIds: roster.includes(characterId) ? roster : [...roster, characterId],
    updatedAt: serverTimestamp(),
  });
  batch.update(doc(db, COLLECTIONS.characters, characterId), {
    campaignIds: arrayUnion(campaignId),
  });
  await batch.commit();
}

/**
 * Take a character out of the member's roster. The active one passes to the
 * next in the roster, or to none. Whether the character may leave (not while an
 * adventure in progress holds it) is checked by the caller — see `character-lock.ts`.
 */
export async function removeMemberCharacter(
  campaignId: string,
  member: Pick<CampaignMember, "uid" | "characterId" | "characterIds">,
  characterId: string,
): Promise<void> {
  const roster = memberCharacterIds(member).filter((id) => id !== characterId);
  const active = member.characterId === characterId ? roster[0] : member.characterId;
  await updateDoc(doc(db, COLLECTIONS.campaigns, campaignId, COLLECTIONS.members, member.uid), {
    characterId: active ?? deleteField(),
    characterIds: roster,
    updatedAt: serverTimestamp(),
  });
}
