/**
 * 5e 2024 starting equipment, for classes and backgrounds.
 *
 * Each owner offers a short list of options; the player takes exactly one. One
 * option is always « gold only » — buy everything yourself, which is what the
 * creation wizard's shop step is for.
 *
 * **Not a fixed A/B pair**: the Fighter has three options (two kits and 155 gp).
 * Backgrounds all have two, and their gold-only option is 50 gp across the board.
 *
 * Items are *references* into the web app's catalogues (`weapons.json`,
 * `armors.json`, `tools.json`, `gear.json`, `equipment-packs.json`) — this
 * package holds no catalogue data, only ids.
 *
 * A package never asks a question of its own. Where the 2024 text says « outils
 * d'artisan au choix » or « un instrument de musique », it means **the one you
 * are proficient with** — the Monk's entry says so outright (« le même que
 * ci-dessus »). That pick is the class's or the background's tool choice, and
 * asking again here only produced a duplicate field. Turning the package into
 * actual inventory lines reads that pick back.
 *
 * Contents follow https://www.aidedd.org/regles-24/. Plain serialisable data.
 */

import { BACKGROUNDS, getBackground, type BackgroundId } from "./backgrounds";
import type { ChoiceDef } from "./choices";
import { getClass } from "./classes";
import { pick } from "./locale";
import {
  goldOnly,
  type EquipmentOptionDef,
  type EquipmentRef,
  type StartingEquipmentDef,
} from "./equipment-options";

export type {
  EquipmentOptionDef,
  EquipmentRef,
  EquipmentRefKind,
  StartingEquipmentDef,
} from "./equipment-options";

// ===========================================================================
// Backgrounds — every gold-only option is 50 po in the 2024 rules.
// ===========================================================================

const BACKGROUND_GOLD = 50;

/** Shorthand: a background has one kit plus the flat 50 gp option. */
function background(
  id: string,
  items: EquipmentRef[],
  gold: number,
  choices?: ChoiceDef[],
): StartingEquipmentDef {
  return {
    id: `background:${id}`,
    options: [
      {
        id: "a",
        get label() {
          return pick({ fr: "Paquetage d'origine", en: "Origin pack" });
        },
        items,
        gold,
        ...(choices ? { choices } : {}),
      },
      goldOnly("b", BACKGROUND_GOLD),
    ],
  };
}

/** Every built-in background's package, by id — the custom one has only the gold. */
export const BACKGROUND_STARTING_EQUIPMENT: Record<BackgroundId, StartingEquipmentDef> =
  Object.fromEntries(
    BACKGROUNDS.map((def) => [
      def.id,
      def.startingKit
        ? background(def.id, def.startingKit.items, def.startingKit.gold, def.startingKit.choices)
        : // A custom background has no package of its own: the player buys
          // everything, so only the gold option exists. `startingEquipmentChoice`
          // still asks, which keeps the step reading the same as every other.
          { id: `background:${def.id}`, options: [goldOnly("b", BACKGROUND_GOLD)] },
    ]),
  ) as Record<BackgroundId, StartingEquipmentDef>;
// ===========================================================================
// Lookups
// ===========================================================================

export function classStartingEquipment(classId: string): StartingEquipmentDef | undefined {
  return getClass(classId)?.startingEquipment;
}

export function backgroundStartingEquipment(
  backgroundId: string,
): StartingEquipmentDef | undefined {
  const builtIn = BACKGROUND_STARTING_EQUIPMENT[backgroundId as BackgroundId];
  if (builtIn) return builtIn;
  // A content-pack background carries its own package.
  const kit = getBackground(backgroundId)?.startingKit;
  return kit ? background(backgroundId, kit.items, kit.gold, kit.choices) : undefined;
}

/** By owner id — `"class:druid"`, `"background:hermit"`, `"background:pack:slug"`. */
export function startingEquipmentById(ownerId: string): StartingEquipmentDef | undefined {
  const separator = ownerId.indexOf(":");
  const kind = ownerId.slice(0, separator);
  const id = ownerId.slice(separator + 1);
  if (kind === "class") return classStartingEquipment(id);
  if (kind === "background") return backgroundStartingEquipment(id);
  return undefined;
}

/** Suffix of the choice that picks a package — `"class:druid:equipment"`. */
export const EQUIPMENT_CHOICE_SUFFIX = ":equipment";

/** The owner behind an equipment choice id, or `undefined` if it is not one. */
export function equipmentOwnerOf(choiceId: string): string | undefined {
  return choiceId.endsWith(EQUIPMENT_CHOICE_SUFFIX)
    ? choiceId.slice(0, -EQUIPMENT_CHOICE_SUFFIX.length)
    : undefined;
}

/** The option a player picked, or `undefined` when the id is unknown. */
export function startingEquipmentOption(
  def: StartingEquipmentDef | undefined,
  optionId: string | undefined,
): EquipmentOptionDef | undefined {
  if (!def || !optionId) return undefined;
  return def.options.find((option) => option.id === optionId);
}

/** The « which package » pick itself, as a choice. */
export function startingEquipmentChoice(def: StartingEquipmentDef): ChoiceDef {
  return {
    id: `${def.id}:equipment`,
    source: def.id.startsWith("class:") ? "class" : "background",
    kind: "option",
    label: pick({ fr: "Équipement de départ", en: "Starting equipment" }),
    count: 1,
    pool: { kind: "list", values: def.options.map((option) => option.id) },
    hint: pick({
      fr: "Prenez le paquetage, ou l'or pour tout acheter vous-même.",
      en: "Take the pack, or the gold to buy everything yourself.",
    }),
  };
}

/**
 * The choices a picked option opens on top of the package pick — the Bard's
 * instrument, the Monk's tool, a background's artisan tools or gaming set.
 */
export function startingEquipmentChoices(
  def: StartingEquipmentDef | undefined,
  optionId: string | undefined,
): ChoiceDef[] {
  return startingEquipmentOption(def, optionId)?.choices ?? [];
}
