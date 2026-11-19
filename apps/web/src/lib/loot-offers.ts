import {
  addDoc,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import {
  COLLECTIONS,
  lootOfferSchema,
  type LootItem,
  type LootOffer,
  type LootOfferSection,
  type Item,
  type Money,
  type ReadyCharacter,
  type WithId,
} from "@adventure-keeper/schemas";

import { updateCharacterItems, type CharacterItemsPatch } from "@/lib/characters";
import { db } from "@/lib/firebase";
import { parseDoc, toMillis } from "@/lib/firestore";
import { setCodexRevealed } from "@/lib/codex";
import { systemOf } from "@/systems";
import { normalizeItems } from "@/systems/dnd2024/lib/items";
import { addCoins, formatPurse, normalizeMoney, toCopper } from "@/systems/dnd2024/lib/money";

interface SessionPath {
  campaignId: string;
  adventureId: string;
  sessionId: string;
}

const sessionRef = ({ campaignId, adventureId, sessionId }: SessionPath) =>
  doc(
    db,
    COLLECTIONS.campaigns,
    campaignId,
    COLLECTIONS.adventures,
    adventureId,
    COLLECTIONS.liveSessions,
    sessionId,
  );
const offersCol = (path: SessionPath) => collection(sessionRef(path), COLLECTIONS.lootOffers);

const newestFirst = (a: LootOffer, b: LootOffer) => toMillis(b.createdAt) - toMillis(a.createdAt);

/** What the GM gives one player: items and/or coins, waiting for an answer. */
export async function createLootOffer(
  path: SessionPath,
  input: {
    toUid: string;
    characterId: string;
    characterName: string;
    items: { section: LootOfferSection; item: Item }[];
    money: Money;
    /** Codex entries among the items, revealed once the offer is accepted. */
    codexEntryIds?: string[];
    where?: string;
  },
): Promise<void> {
  await addDoc(offersCol(path), {
    toUid: input.toUid,
    characterId: input.characterId,
    characterName: input.characterName,
    items: input.items,
    money: normalizeMoney(input.money),
    codexEntryIds: input.codexEntryIds ?? [],
    ...(input.where?.trim() ? { where: input.where.trim() } : {}),
    status: "pending",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

/** Every offer of the session, newest first (the GM). */
export function subscribeSessionLootOffers(
  path: SessionPath,
  onChange: (offers: WithId<LootOffer>[]) => void,
): () => void {
  return onSnapshot(offersCol(path), (snapshot) =>
    onChange(snapshot.docs.map((d) => parseDoc<LootOffer>(lootOfferSchema, d)).sort(newestFirst)),
  );
}

/** The offers made to this player (the rules only let them read their own). */
export function subscribeMyLootOffers(
  path: SessionPath,
  uid: string,
  onChange: (offers: WithId<LootOffer>[]) => void,
): () => void {
  return onSnapshot(query(offersCol(path), where("toUid", "==", uid)), (snapshot) =>
    onChange(snapshot.docs.map((d) => parseDoc<LootOffer>(lootOfferSchema, d)).sort(newestFirst)),
  );
}

/** « Épée longue, Corde ×2 · 50 po · 5 pa » — what an offer holds, in one line. */
export function lootOfferLabel(offer: Pick<LootOffer, "items" | "money">): string {
  return [
    ...offer.items.map(({ item }) =>
      item.quantity > 1 ? `${item.name} ×${item.quantity}` : item.name,
    ),
    ...(toCopper(offer.money) > 0 ? [formatPurse(offer.money)] : []),
  ].join(", ");
}

/**
 * The player takes it: the items go to their sheet (each where it belongs,
 * all in the inventory for a sheet without sections), the coins to their
 * purse — then the offer is marked accepted.
 */
export async function acceptLootOffer(
  path: SessionPath,
  offer: WithId<LootOffer>,
  character: WithId<ReadyCharacter>,
): Promise<void> {
  // A sheet with a purse has sections too; without one it has a free inventory.
  const { sessionFields } = systemOf(character);
  if (sessionFields.includes("money") && "money" in character) {
    const patch: CharacterItemsPatch = {};
    for (const section of ["weapons", "armors", "tools", "inventory"] as const) {
      const given = offer.items.filter((entry) => entry.section === section);
      if (given.length) {
        patch[section] = [...normalizeItems(character[section]), ...given.map((e) => e.item)];
      }
    }
    if (toCopper(offer.money) > 0) patch.money = addCoins(character.money, offer.money);
    if (Object.keys(patch).length) await updateCharacterItems(character.id, patch);
  } else {
    // A standard sheet has one free inventory: the coins become a line of it.
    const lines = offer.items.map((entry) => entry.item);
    if (toCopper(offer.money) > 0) {
      lines.push({
        id: crypto.randomUUID(),
        name: formatPurse(offer.money),
        quantity: 1,
        consumable: false,
      });
    }
    if (lines.length) {
      await updateCharacterItems(character.id, {
        inventory: [...normalizeItems(character.inventory), ...lines],
      });
    }
  }
  await updateDoc(doc(offersCol(path), offer.id), {
    status: "accepted",
    updatedAt: serverTimestamp(),
  });
}

/** The player leaves it: the GM is told, and may give it to someone else. */
export async function declineLootOffer(path: SessionPath, offerId: string): Promise<void> {
  await updateDoc(doc(offersCol(path), offerId), {
    status: "declined",
    updatedAt: serverTimestamp(),
  });
}

/** The GM takes an offer back (declined, or never answered). */
export async function deleteLootOffer(path: SessionPath, offerId: string): Promise<void> {
  await deleteDoc(doc(offersCol(path), offerId));
}

/**
 * The GM writes an accepted offer in the session's loot — one line per item
 * and one for the coins, with who took it — once. The codex entries it held
 * are revealed to the party at the same time.
 */
export async function logAcceptedLootOffer(
  path: SessionPath,
  offer: WithId<LootOffer>,
): Promise<void> {
  const lines: LootItem[] = [
    ...offer.items.map(({ item }, index) => ({
      id: `${offer.id}:${index}`,
      name: item.name,
      ...(item.quantity > 1 ? { quantity: item.quantity } : {}),
      ...(offer.where ? { where: offer.where } : {}),
      recipient: offer.characterName,
    })),
    ...(toCopper(offer.money) > 0
      ? [
          {
            id: `${offer.id}:money`,
            name: formatPurse(offer.money),
            ...(offer.where ? { where: offer.where } : {}),
            recipient: offer.characterName,
          },
        ]
      : []),
  ];
  await Promise.all(
    offer.codexEntryIds.map((entryId) =>
      // An entry deleted since is not worth blocking the log.
      setCodexRevealed(path.campaignId, entryId, true).catch((error) => console.error(error)),
    ),
  );
  await updateDoc(sessionRef(path), {
    ...(lines.length ? { loot: arrayUnion(...lines) } : {}),
    updatedAt: serverTimestamp(),
  });
  await updateDoc(doc(offersCol(path), offer.id), { logged: true, updatedAt: serverTimestamp() });
}
