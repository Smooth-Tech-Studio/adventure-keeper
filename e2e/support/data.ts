/**
 * Ready-made game data, written straight to the emulator: a test about the
 * campaign page should not first have to play through the creation wizard.
 * Shapes follow `scripts/seed.ts` and the app's own writers.
 */
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { FieldValue } from "firebase-admin/firestore";

// Source import, as in `scripts/seed.ts`: always the current rules. Only the
// small `@adventure-keeper/locale` package they rely on is built first
// (`pnpm test:e2e` does it).
import { computeCharacterDerived } from "../../packages/system-dnd2024/src/index";
import type { Dnd2024CharacterInput } from "../../packages/schemas/src/index";
import { CHARACTER_PRIVATE_FIELDS } from "../../packages/schemas/src/character-private";
import { adminDb, type TestUser } from "./emulator";

const now = () => FieldValue.serverTimestamp();
const item = (name: string) => ({ id: randomUUID(), name, consumable: false, quantity: 1 });

/** Complete sheets to start from: a dwarf soldier fighter, dwarf criminal wizard and druid. */
const PRESETS = {
  fighter: {
    classId: "fighter",
    backgroundId: "soldier",
    baseAbilityScores: { str: 15, dex: 13, con: 14, int: 8, wis: 12, cha: 10 },
    backgroundAbilityBonuses: { str: 2, dex: 0, con: 1, int: 0, wis: 0, cha: 0 },
    // Not Athletics: the soldier already has it, and a skill taken twice asks for a replacement.
    skillProficiencies: ["acrobatics", "perception"],
    toolProficiencies: ["dice-set"],
    cantrips: [],
    spells: [],
    weapons: ["Hache de guerre"],
    armors: ["Cotte de mailles"],
    // The soldier's « Jeu (au choix) », so the sheet is complete.
    choices: [{ choiceId: "background:soldier:tool", values: ["dice-set"] }],
  },
  wizard: {
    classId: "wizard",
    backgroundId: "criminal",
    baseAbilityScores: { str: 8, dex: 13, con: 14, int: 15, wis: 12, cha: 10 },
    backgroundAbilityBonuses: { str: 0, dex: 0, con: 1, int: 2, wis: 0, cha: 0 },
    skillProficiencies: ["arcana", "history"],
    toolProficiencies: [],
    cantrips: ["fire-bolt", "mage-hand", "ray-of-frost"],
    spells: ["magic-missile", "shield", "mage-armor", "sleep"],
    weapons: ["Dague"],
    armors: [],
    choices: [],
  },
  // A Warden druid: medium armour is theirs, and Wild Shape from level 2.
  druid: {
    classId: "druid",
    backgroundId: "criminal",
    baseAbilityScores: { str: 10, dex: 14, con: 14, int: 8, wis: 15, cha: 10 },
    backgroundAbilityBonuses: { str: 0, dex: 1, con: 0, int: 0, wis: 2, cha: 0 },
    skillProficiencies: ["nature", "perception"],
    toolProficiencies: [],
    cantrips: ["druidcraft", "produce-flame"],
    spells: ["cure-wounds", "entangle", "healing-word", "thunderwave"],
    weapons: ["Gourdin"],
    armors: [],
    choices: [{ choiceId: "class:druid:primal-order", values: ["primal-order-warden"] }],
  },
  // A monk: Dexterity and Wisdom, no armour, the Martial Arts die.
  monk: {
    classId: "monk",
    backgroundId: "criminal",
    baseAbilityScores: { str: 10, dex: 15, con: 13, int: 8, wis: 15, cha: 10 },
    backgroundAbilityBonuses: { str: 0, dex: 2, con: 1, int: 0, wis: 0, cha: 0 },
    skillProficiencies: ["acrobatics", "insight"],
    toolProficiencies: [],
    cantrips: [],
    spells: [],
    weapons: [],
    armors: [],
    choices: [],
  },
} as const;

/** A finished dwarf character of `preset`, owned by `owner`. Returns its id. */
export async function createDndCharacter(
  owner: TestUser,
  name: string,
  {
    preset = "fighter",
    level = 1,
    subclassId = null,
  }: { preset?: keyof typeof PRESETS; level?: number; subclassId?: string | null } = {},
): Promise<string> {
  const p = PRESETS[preset];
  const input: Dnd2024CharacterInput = {
    system: "dnd2024",
    name,
    speciesId: "dwarf",
    classId: p.classId,
    backgroundId: p.backgroundId,
    alignment: "LG",
    level,
    color: "#b45309",
    baseAbilityScores: { ...p.baseAbilityScores },
    backgroundAbilityBonuses: { ...p.backgroundAbilityBonuses },
    skillProficiencies: [...p.skillProficiencies],
    speciesSkillProficiencies: [],
    skillExpertise: [],
    languages: ["elvish", "giant"],
    cantrips: [...p.cantrips],
    spells: [...p.spells],
    tools: [],
    toolProficiencies: [...p.toolProficiencies],
    toolExpertise: [],
    weaponMasteries: [],
    weapons: p.weapons.map(item),
    armors: p.armors.map(item),
    inventory: [],
    money: { platinum: 0, gold: 15, electrum: 0, silver: 0, copper: 0 },
    // The engine reads the subclass back from its choice.
    choices: [
      ...p.choices.map((pick) => ({ ...pick, values: [...pick.values] })),
      ...(subclassId ? [{ choiceId: `class:${p.classId}:subclass`, values: [subclassId] }] : []),
    ],
    packContent: [],
    eldritchInvocations: [],
    wildShapeForms: [],
    companions: [],
  };
  const derived = computeCharacterDerived({
    classId: input.classId,
    level: input.level,
    baseAbilityScores: input.baseAbilityScores,
    backgroundAbilityBonuses: input.backgroundAbilityBonuses,
    backgroundId: input.backgroundId,
    speciesId: input.speciesId,
    skillProficiencies: input.skillProficiencies,
    speciesSkillProficiencies: input.speciesSkillProficiencies,
    skillExpertise: input.skillExpertise,
    weapons: input.weapons,
    armors: input.armors,
    tools: input.tools,
    toolProficiencies: input.toolProficiencies,
    toolExpertise: input.toolExpertise,
    weaponMasteries: input.weaponMasteries,
    choices: input.choices,
  });
  // As the app writes it: the bag, purse and XP in the owner-and-GM-only doc.
  const sheet: Record<string, unknown> = { ...input, ...derived };
  const belongings: Record<string, unknown> = {};
  for (const key of CHARACTER_PRIVATE_FIELDS) {
    if (key in sheet) belongings[key] = sheet[key];
    delete sheet[key];
  }
  const ref = adminDb.collection("characters").doc();
  await ref.set({ ...sheet, ownerId: owner.uid, createdAt: now(), updatedAt: now() });
  await ref
    .collection("private")
    .doc("belongings")
    .set({ ...belongings, updatedAt: now() });
  return ref.id;
}

/** A 5E campaign with `gm` as its Maître du jeu. Returns its id. */
export async function createCampaign(gm: TestUser, name: string): Promise<string> {
  const ref = adminDb.collection("campaigns").doc();
  await ref.set({
    name,
    description: "Une campagne de test.",
    system: "dnd5e",
    characterSystem: "dnd2024",
    ownerId: gm.uid,
    memberIds: [gm.uid],
    isArchived: false,
    createdAt: now(),
    updatedAt: now(),
  });
  await ref.collection("members").doc(gm.uid).set({
    uid: gm.uid,
    role: "gm",
    status: "active",
    displayName: gm.displayName,
    joinedAt: now(),
    createdAt: now(),
    updatedAt: now(),
  });
  return ref.id;
}

/** `player` joins the campaign, with `characterId` as their character if given. */
export async function addPlayer(campaignId: string, player: TestUser, characterId?: string) {
  const ref = adminDb.collection("campaigns").doc(campaignId);
  await ref.update({ memberIds: FieldValue.arrayUnion(player.uid), updatedAt: now() });
  await ref
    .collection("members")
    .doc(player.uid)
    .set({
      uid: player.uid,
      role: "player",
      status: "active",
      displayName: player.displayName,
      ...(characterId ? { characterId, characterIds: [characterId] } : {}),
      joinedAt: now(),
      createdAt: now(),
      updatedAt: now(),
    });
  // As the app does: the campaign's GM and members may now read the sheet.
  if (characterId) {
    await adminDb
      .doc(`characters/${characterId}`)
      .update({ campaignIds: FieldValue.arrayUnion(campaignId) });
  }
}

/** An adventure of the campaign, as « Nouvelle aventure » writes it. Returns its id. */
export async function createAdventure(
  campaignId: string,
  gm: TestUser,
  title: string,
  status: "draft" | "upcoming" | "active" | "completed" = "draft",
): Promise<string> {
  const ref = adminDb.collection("campaigns").doc(campaignId).collection("adventures").doc();
  await ref.set({
    campaignId,
    createdBy: gm.uid,
    title,
    status,
    playerIds: [],
    order: 0,
    createdAt: now(),
    updatedAt: now(),
  });
  return ref.id;
}

export async function campaignDoc(campaignId: string) {
  return (await adminDb.doc(`campaigns/${campaignId}`).get()).data();
}

export async function memberDoc(campaignId: string, uid: string) {
  return (await adminDb.doc(`campaigns/${campaignId}/members/${uid}`).get()).data();
}

/** Paths are from the repository root, where Playwright runs. */
export const EXAMPLE_PACK = path.resolve(
  "packages/system-dnd2024/src/packs/fixtures/brumes-du-nord.json",
);

/** « Les Brumes du Nord », the example pack, in `owner`'s library. Returns its doc id. */
export async function importExamplePack(
  owner: TestUser,
  /** Changes the pack before it is stored (an illustration, say). */
  patch?: (pack: { content: Record<string, Record<string, unknown>[]> }) => void,
): Promise<string> {
  const pack = JSON.parse(readFileSync(EXAMPLE_PACK, "utf8")) as {
    id: string;
    name: string;
    version: string;
    content: Record<string, Record<string, unknown>[]>;
  };
  patch?.(pack);
  const ref = adminDb.collection("contentPacks").doc();
  await ref.set({
    ownerId: owner.uid,
    ownerName: owner.displayName,
    packId: pack.id,
    name: pack.name,
    version: pack.version,
    entryCount: Object.values(pack.content).reduce((sum, list) => sum + list.length, 0),
    pack,
    sharedWith: [],
    linkSharing: false,
    createdAt: now(),
    updatedAt: now(),
  });
  return ref.id;
}

/** The GM allows a library pack in the campaign (a copy, as the campaign page makes it). */
export async function allowPackInCampaign(campaignId: string, packDocId: string, gm: TestUser) {
  const source = (await adminDb.doc(`contentPacks/${packDocId}`).get()).data()!;
  await adminDb.doc(`campaigns/${campaignId}/packs/${source.packId}`).set({
    sourceId: packDocId,
    ownerId: source.ownerId,
    ownerName: source.ownerName,
    packId: source.packId,
    name: source.name,
    version: source.version,
    pack: source.pack,
    activatedBy: gm.uid,
    createdAt: now(),
    updatedAt: now(),
  });
}

/** Adds `characterId` to the adventure's participants, as the adventure page does. */
export async function addParticipant(
  campaignId: string,
  adventureId: string,
  player: TestUser,
  characterId: string,
) {
  const character = (await adminDb.doc(`characters/${characterId}`).get()).data()!;
  const adventure = adminDb.doc(`campaigns/${campaignId}/adventures/${adventureId}`);
  await adventure.collection("participants").doc(characterId).set({
    campaignId,
    adventureId,
    characterId,
    playerId: player.uid,
    characterName: character.name,
    currentHitPoints: character.maxHitPoints,
    createdAt: now(),
    updatedAt: now(),
  });
  await adventure.update({ playerIds: FieldValue.arrayUnion(player.uid), updatedAt: now() });
}

/** A location of the adventure; its map is served by `fixtures.ts`. Returns its id. */
export async function addLocation(
  campaignId: string,
  adventureId: string,
  name: string,
  { hidden = false, order = 0, loot = undefined as Record<string, unknown> | undefined } = {},
): Promise<string> {
  const ref = adminDb
    .collection(`campaigns/${campaignId}/adventures/${adventureId}/locations`)
    .doc();
  await ref.set({
    campaignId,
    adventureId,
    name,
    ...(hidden ? {} : { imageUrl: `${TEST_IMAGE_ORIGIN}/${encodeURIComponent(name)}.svg` }),
    hidden,
    order,
    createdAt: now(),
    updatedAt: now(),
  });
  // The GM-only half: description and the full map, hidden or not.
  await adminDb
    .doc(`campaigns/${campaignId}/adventures/${adventureId}/locationSecrets/${ref.id}`)
    .set({
      campaignId,
      adventureId,
      imageUrl: `${TEST_IMAGE_ORIGIN}/${encodeURIComponent(name)}.svg`,
      ...(loot ? { loot } : {}),
      createdAt: now(),
      updatedAt: now(),
    });
  return ref.id;
}

/** An enemy type of the adventure. Returns its id. */
export async function addEnemy(
  campaignId: string,
  adventureId: string,
  name: string,
  {
    armorClass = 15,
    maxHitPoints = 7,
    order = 0,
    attacks = [] as Record<string, unknown>[],
    locationId = undefined as string | undefined,
    loot = undefined as Record<string, unknown> | undefined,
  } = {},
): Promise<string> {
  const ref = adminDb.collection(`campaigns/${campaignId}/adventures/${adventureId}/enemies`).doc();
  await ref.set({
    campaignId,
    adventureId,
    name,
    armorClass,
    maxHitPoints,
    speed: 30,
    count: 1,
    attacks,
    ...(locationId ? { locationId } : {}),
    ...(loot ? { loot } : {}),
    order,
    createdAt: now(),
    updatedAt: now(),
  });
  return ref.id;
}

/** A codex entry of the campaign. Returns its id. */
export async function addCodexEntry(
  campaignId: string,
  name: string,
  { kind = "item", summary = "", revealed = false } = {},
): Promise<string> {
  const ref = adminDb.collection(`campaigns/${campaignId}/codex`).doc();
  await ref.set({
    campaignId,
    kind,
    name,
    summary,
    revealed,
    createdAt: now(),
    updatedAt: now(),
  });
  return ref.id;
}

/** Where test maps live: answered by a route in `fixtures.ts`, never the network. */
export const TEST_IMAGE_ORIGIN = "https://images.e2e.test";
