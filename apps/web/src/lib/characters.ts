import {
  collection,
  deleteField,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  where,
  writeBatch,
  type DocumentSnapshot,
} from "firebase/firestore";
import {
  COLLECTIONS,
  DEFAULT_CHARACTER_STATUS,
  DEFAULT_CHARACTER_SYSTEM,
  characterSchema,
  isCharacterDraft,
  type Character,
  type CharacterBelongings,
  type CharacterDraftInput,
  type CharacterInput,
  type CharacterStatus,
  type CharacterSystem,
  type Dnd2024CharacterInput,
  type ReadyCharacter,
  type WithId,
} from "@adventure-keeper/schemas";

import { mergeBelongings, seedBelongings, splitBelongings } from "@/lib/character-belongings";
import { db } from "@/lib/firebase";
import { byUpdatedAtDesc, parseData, parseDoc } from "@/lib/firestore";
import { retrying } from "@/lib/retrying";
import { getSystem, isCharacterSystem, systemOf } from "@/systems";

// What the campaign's members may not read — inventory, purse, XP, notes —
// lives in `characters/{id}/private/belongings`, read by the owner and the GM.
const PRIVATE = "private";
const BELONGINGS_DOC = "belongings";
const characterDoc = (id: string) => doc(db, COLLECTIONS.characters, id);
const belongingsDoc = (id: string) => doc(characterDoc(id), PRIVATE, BELONGINGS_DOC);
/** One sentinel for the whole file, so the belongings helpers can tell it apart. */
const DELETE = deleteField();

const isDenied = (error: unknown) =>
  (error as { code?: string } | null)?.code === "permission-denied";

/**
 * Recompute the denormalised 5e block from the current rules data, in memory.
 *
 * The character sheet re-derives on every render; the live-session views instead
 * read the stored block straight off the document. Without this, a character not
 * re-saved since the last rules change (new equipment engine, mastery slots, …)
 * would show a stale — or schema-default — AC, speed and attack table in play.
 */
export function withFreshDerived<T extends Character>(character: T): T {
  // A draft has no derived block to refresh; a system without rules derives
  // nothing. TypeScript does not narrow a generic through the guard, hence the cast.
  if (isCharacterDraft(character)) return character;
  return { ...character, ...systemOf(character).derivedFields(character as ReadyCharacter) } as T;
}

/** Create a playable character, with what its system computes from the rules. */
export async function createCharacter(rawInput: CharacterInput, ownerId: string): Promise<string> {
  const input = systemOf(rawInput).withContent(rawInput);
  const now = serverTimestamp();
  const payload = { ...input, ...systemOf(input).derivedFields(input) };

  return createSheet({
    ...payload,
    status: "ready" satisfies CharacterStatus,
    ownerId,
    createdAt: now,
    updatedAt: now,
  });
}

/** A new sheet: its main doc and its belongings, in one batch. */
async function createSheet(fields: Record<string, unknown>): Promise<string> {
  const ref = doc(collection(db, COLLECTIONS.characters));
  // `undefined` rather than a sentinel: a new doc has nothing to delete.
  const { main } = splitBelongings(fields, undefined);
  const batch = writeBatch(db);
  batch.set(ref, main);
  batch.set(doc(ref, PRIVATE, BELONGINGS_DOC), {
    ...seedBelongings({}, fields, undefined),
    updatedAt: fields.updatedAt,
  });
  await batch.commit();
  return ref.id;
}

/**
 * A change across the sheet's two docs at once. The belongings get its
 * private fields; a sheet saved before the split has no belongings yet, so
 * it gets them whole — the old copies under the change. The main doc loses
 * its copies either way.
 */
async function writeSheet(id: string, fields: Record<string, unknown>): Promise<void> {
  const [main, belongings] = await Promise.all([
    getDoc(characterDoc(id)),
    getDoc(belongingsDoc(id)),
  ]);
  const split = splitBelongings(fields, DELETE);
  const batch = writeBatch(db);
  batch.update(characterDoc(id), split.main);
  if (belongings.exists()) {
    batch.set(
      belongingsDoc(id),
      { ...split.belongings, updatedAt: serverTimestamp() },
      { merge: true },
    );
  } else {
    batch.set(belongingsDoc(id), {
      ...seedBelongings(main.data() ?? {}, fields, DELETE),
      updatedAt: serverTimestamp(),
    });
  }
  await batch.commit();
}

/**
 * Firestore rejects `undefined`. A draft is by definition full of holes, so
 * every write goes through this rather than relying on the caller.
 */
function definedOnly(input: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined));
}

/**
 * Save a half-filled sheet. No derived block is computed — it cannot be, and
 * `status: "draft"` is what keeps this document out of campaigns and sessions.
 */
export async function createCharacterDraft(
  rawInput: CharacterDraftInput,
  ownerId: string,
): Promise<string> {
  const input = systemOf(rawInput).withContent(rawInput);
  const now = serverTimestamp();
  return createSheet({
    ...definedOnly(input),
    // Always a string so the lists can render it; may be empty.
    name: input.name?.trim() ?? "",
    status: "draft" satisfies CharacterStatus,
    ownerId,
    createdAt: now,
    updatedAt: now,
  });
}

/**
 * Patch an existing draft. Fields the player has cleared are removed rather
 * than left behind, so a draft never keeps a stale value for a choice undone.
 */
export async function updateCharacterDraft(
  id: string,
  rawInput: CharacterDraftInput,
): Promise<void> {
  const input = systemOf(rawInput).withContent(rawInput);
  const patch: Record<string, unknown> = {
    ...definedOnly(input),
    name: input.name?.trim() ?? "",
    status: "draft" satisfies CharacterStatus,
    updatedAt: serverTimestamp(),
  };
  for (const field of Object.keys(input)) {
    if ((input as Record<string, unknown>)[field] === undefined) patch[field] = DELETE;
  }
  await writeSheet(id, patch);
}

/** Delete a character or a draft, belongings included (owner only, per Firestore rules). */
export async function deleteCharacter(id: string): Promise<void> {
  const batch = writeBatch(db);
  batch.delete(belongingsDoc(id));
  batch.delete(characterDoc(id));
  await batch.commit();
}

/**
 * Legacy character docs written before the `system` / `status` fields existed.
 *
 * `parseDoc` hands back raw Firestore data — the Zod `.default()`s never run —
 * so the defaults have to be applied here, or every pre-existing sheet would
 * read as `status: undefined` and be treated as neither draft nor ready.
 */
function withCharacterDefaults<T extends { system?: CharacterSystem; status?: CharacterStatus }>(
  character: T,
): T {
  const system = character.system ?? DEFAULT_CHARACTER_SYSTEM;
  const status = character.status ?? DEFAULT_CHARACTER_STATUS;
  return character.system && character.status ? character : { ...character, system, status };
}

/**
 * The playable sheets in a list. Drafts are deliberately kept out of campaign
 * pickers and sessions: they have no hit points, AC or modifiers to play with.
 */
export function readyCharacters(characters: WithId<Character>[]): WithId<ReadyCharacter>[] {
  return characters.filter((c): c is WithId<ReadyCharacter> => !isCharacterDraft(c));
}

/**
 * One sheet if it is playable, `null` if it is still a draft.
 *
 * The narrowing is asserted rather than inferred: `WithId<T>` is an
 * intersection (`T & { id }`), not a union, so `Extract` inside a type
 * predicate has nothing to distribute over and would collapse to `never`.
 * Keeping that assertion in these two helpers is what spares every caller
 * from doing it by hand.
 */
export function readyCharacterOrNull(
  character: WithId<Character> | null,
): WithId<ReadyCharacter> | null {
  if (!character || isCharacterDraft(character)) return null;
  return character as WithId<ReadyCharacter>;
}

export async function listMyCharacters(uid: string): Promise<WithId<Character>[]> {
  const snapshot = await getDocs(
    query(collection(db, COLLECTIONS.characters), where("ownerId", "==", uid)),
  );
  return snapshot.docs
    .map((d) => withCharacterDefaults(parseDoc<Character>(characterSchema, d)))
    .sort(byUpdatedAtDesc);
}

/** A sheet's belongings; `null` when it has none yet, or for a reader they are closed to (a companion). */
async function getBelongings(id: string): Promise<CharacterBelongings | null> {
  try {
    const snapshot = await getDoc(belongingsDoc(id));
    return snapshot.exists() ? (snapshot.data() as CharacterBelongings) : null;
  } catch (error) {
    if (isDenied(error)) return null;
    throw error;
  }
}

/**
 * A whole sheet from its two docs. A reader the belongings are closed to gets
 * an empty bag and purse, which the companion view hides anyway.
 */
function sheetFrom(
  snapshot: DocumentSnapshot,
  belongings: CharacterBelongings | null,
): WithId<Character> {
  const sheet: Record<string, unknown> = mergeBelongings(
    { id: snapshot.id, ...(snapshot.data() ?? {}) },
    belongings,
  );
  const filled = {
    ...sheet,
    inventory: sheet.inventory ?? [],
    ...(isCharacterSystem(sheet.system) ? getSystem(sheet.system).storedDefaults(sheet) : {}),
  };
  return withCharacterDefaults(parseData<Character>(characterSchema, snapshot.ref.path, filled));
}

export async function getCharacter(id: string): Promise<WithId<Character> | null> {
  const [snapshot, belongings] = await Promise.all([getDoc(characterDoc(id)), getBelongings(id)]);
  if (!snapshot.exists()) return null;
  return sheetFrom(snapshot, belongings);
}

/**
 * Another player's sheet, for a card that shows it (the group, the
 * participants, the chronicle): read again a few times if the read fails,
 * then `null`, logged — a card has no other chance to fill in. `null` too for
 * a missing sheet or a draft.
 */
export async function getCompanionSheet(id: string): Promise<WithId<ReadyCharacter> | null> {
  try {
    return readyCharacterOrNull(await retrying(() => getCharacter(id)));
  } catch (error) {
    console.error(`Could not read sheet ${id}`, error);
    return null;
  }
}

/**
 * Live sheet — used by the session views so a sheet edited elsewhere (the
 * owner's session panel, another tab) shows up for every viewer. Nothing is
 * sent until both docs have answered: a sheet shown without its bag for an
 * instant could be saved that way, and lose it.
 */
export function subscribeCharacter(
  id: string,
  onChange: (character: WithId<Character> | null) => void,
): () => void {
  let main: DocumentSnapshot | undefined;
  let belongings: CharacterBelongings | null | undefined;
  const emit = () => {
    if (main === undefined || belongings === undefined) return;
    onChange(main.exists() ? sheetFrom(main, belongings) : null);
  };
  const stopMain = onSnapshot(characterDoc(id), (snapshot) => {
    main = snapshot;
    emit();
  });
  const stopBelongings = onSnapshot(
    belongingsDoc(id),
    (snapshot) => {
      belongings = snapshot.exists() ? (snapshot.data() as CharacterBelongings) : null;
      emit();
    },
    (error) => {
      // Closed to this reader (a companion): the sheet comes without them.
      if (!isDenied(error)) console.error(error);
      belongings = null;
      emit();
    },
  );
  return () => {
    stopMain();
    stopBelongings();
  };
}

/**
 * What the session panel lets the owner edit during play: the item lists, the
 * familiar, the Wild Shape forms known.
 */
export type CharacterItemsPatch = Partial<
  Pick<
    Dnd2024CharacterInput,
    "weapons" | "armors" | "tools" | "inventory" | "money" | "companions" | "wildShapeForms"
  >
>;

/**
 * Patch a character's equipment / inventory from the live session (owner only,
 * per Firestore rules). The 5e derived block (AC, attacks, speed…) is
 * recomputed so the session reflects the change immediately.
 */
export async function updateCharacterItems(id: string, patch: CharacterItemsPatch): Promise<void> {
  const character = await getCharacter(id);
  if (!character) throw new Error("character not found");
  // Unreachable in practice: a draft cannot be picked for a campaign, so it
  // never reaches a session panel. Narrowed here so the compiler agrees.
  if (isCharacterDraft(character)) throw new Error("a draft carries no session state");

  // A system keeps the parts of the patch its sheets have: a standard sheet
  // only has a free inventory.
  const system = systemOf(character);
  const kept = Object.fromEntries(
    Object.entries(patch).filter(
      ([field, value]) => value !== undefined && system.sessionFields.includes(field),
    ),
  );
  if (Object.keys(kept).length === 0) return;

  // Inventory alone doesn't feed the derived block; weapons / armour / tools do.
  const touchesDerived =
    kept.weapons !== undefined || kept.armors !== undefined || kept.tools !== undefined;
  await writeSheet(id, {
    ...kept,
    ...(touchesDerived ? system.derivedFields({ ...character, ...kept } as ReadyCharacter) : {}),
    updatedAt: serverTimestamp(),
  });
}

/** Set the character's accumulated XP (owner only, per Firestore rules). */
export async function setCharacterExperience(id: string, experiencePoints: number): Promise<void> {
  await writeSheet(id, {
    experiencePoints: Math.max(0, Math.round(experiencePoints)),
    updatedAt: serverTimestamp(),
  });
}

/** Recompute derived stats (5e 2024), then patch an existing character. */
export async function updateCharacter(id: string, rawInput: CharacterInput): Promise<void> {
  const input = systemOf(rawInput).withContent(rawInput);
  const patch: Record<string, unknown> = {
    ...input,
    ...systemOf(input).derivedFields(input),
    // Saving a sheet that passes validation is also how a draft becomes playable.
    status: "ready" satisfies CharacterStatus,
    updatedAt: serverTimestamp(),
  };
  for (const field of systemOf(input).clearableFields) {
    if ((input as Record<string, unknown>)[field] === undefined) {
      patch[field] = DELETE;
    }
  }

  await writeSheet(id, patch);
}
