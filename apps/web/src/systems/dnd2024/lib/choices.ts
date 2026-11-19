/**
 * Bridging `ChoiceDef`s to the web app's catalogues.
 *
 * `@adventure-keeper/system-dnd2024` describes *which* choices exist and what
 * they allow, but holds no catalogue data: tools, spells and equipment live in
 * lazily-loaded JSON here. This module supplies the {@link ChoiceContext} the
 * package asks for, and turns a picked value into something readable.
 */

import { useMemo } from "react";
import {
  ABILITY_LABELS,
  CREATURE_SIZE_LABELS,
  SKILL_LABELS,
  SKILL_SUMMARY,
  TOOL_CATEGORY_DESCRIPTIONS,
  getClassOption,
  getFeat,
  getLanguage,
  getLineage,
  equipmentOwnerOf,
  getSubclass,
  subclassSpellVariantSummary,
  normalizeChoices,
  parseProficiencyValue,
  resolveChoices,
  startingEquipmentById,
  spellGroup,
  startingEquipmentOption,
  type Ability,
  type ArmorDef,
  type ChoiceContext,
  type ChoiceDef,
  type ChoicePick,
  type CreatureSize,
  type EquipmentPackDef,
  type GearDef,
  type Skill,
  type SpellDef,
  type ToolDef,
  type WeaponDef,
  type InvocationPick,
} from "@adventure-keeper/system-dnd2024";

import {
  useArmorCatalog,
  useEquipmentPacks,
  useGearCatalog,
  useToolCatalog,
  useWeaponCatalog,
} from "@/systems/dnd2024/lib/equipment";
import { useSpells } from "@/systems/dnd2024/lib/spells";
import { tr } from "@/i18n";

/** Catalogues a choice renderer may need, all optional while they load. */
export interface ChoiceCatalogs {
  tools: ToolDef[] | null;
  gear: GearDef[] | null;
  spells: SpellDef[] | null;
  /** Loaded with `gear`, to name and build the items of a starting package. */
  weapons: WeaponDef[] | null;
  armors: ArmorDef[] | null;
  packs: EquipmentPackDef[] | null;
}

/**
 * Loads the catalogues a set of choices actually needs — nothing is fetched for
 * a step that only picks skills.
 */
export function useChoiceCatalogs(defs: readonly ChoiceDef[]): ChoiceCatalogs {
  const kinds = useMemo(() => new Set(defs.map((def) => def.kind)), [defs]);
  // `option` pools can name equipment packages, so gear is pulled in with them.
  const needsGear = kinds.has("item") || kinds.has("option");
  // A starting-equipment package can hold tools, so they come along with gear.
  const needsTools = kinds.has("tool") || kinds.has("proficiency") || needsGear;
  const needsSpells = kinds.has("spell");

  const tools = useToolCatalog(needsTools);
  const gear = useGearCatalog(needsGear);
  const spells = useSpells(needsSpells);
  // Starting-equipment packages name weapons, armour and packs too.
  const weapons = useWeaponCatalog(needsGear);
  const armors = useArmorCatalog(needsGear);
  const packs = useEquipmentPacks(needsGear);

  return useMemo(
    () => ({ tools, gear, spells, weapons, armors, packs }),
    [tools, gear, spells, weapons, armors, packs],
  );
}

/**
 * The context `choicePoolValues` / `validateChoices` need: the full catalogues,
 * the tool families behind a `group` pool, and what the sheet already masters
 * for a `proficient` pool.
 */
export function buildChoiceContext(
  catalogs: ChoiceCatalogs,
  proficient?: ChoiceContext["proficient"],
): ChoiceContext {
  const toolIds = catalogs.tools?.map((tool) => tool.id) ?? [];

  // One bucket per ToolChoiceGroup, plus the catch-all.
  const toolGroups: Record<string, string[]> = { any: toolIds };
  for (const tool of catalogs.tools ?? []) {
    (toolGroups[tool.category] ??= []).push(tool.id);
  }
  toolGroups["artisan-or-instrument"] = [
    ...(toolGroups.artisan ?? []),
    ...(toolGroups.instrument ?? []),
  ];

  // One bucket per `classe:niveau`, so « Initié à la magie (clerc) » offers the
  // nine cleric cantrips rather than the whole catalogue. The group names come
  // from `spellGroup()` in the rules package; the members are resolved here,
  // because the spell catalogue is lazy-loaded by the app.
  const spellGroups: Record<string, string[]> = {};
  for (const spell of catalogs.spells ?? []) {
    for (const classId of spell.classes) {
      (spellGroups[spellGroup(classId, spell.level)] ??= []).push(spell.id);
    }
  }

  return {
    proficient,
    catalog: {
      tool: toolIds,
      spell: catalogs.spells?.map((spell) => spell.id) ?? [],
      item: catalogs.gear?.map((row) => row.id) ?? [],
    },
    catalogGroups: { tool: toolGroups, spell: spellGroups },
  };
}

/**
 * How a picked value reads on screen. `option` values are ids from wherever the
 * choice points — a subclass, a feat, a lineage, an equipment package — so they
 * are resolved by trying each source in turn; a value that resolves to nothing
 * is shown as-is, which is right for a lineage (« Drow » is already its label).
 */
export function choiceValueLabel(def: ChoiceDef, value: string, catalogs: ChoiceCatalogs): string {
  switch (def.kind) {
    case "skill":
      return SKILL_LABELS[value as Skill] ?? value;
    case "ability":
      return ABILITY_LABELS[value as Ability] ?? value;
    case "language":
      return getLanguage(value)?.name ?? value;
    case "tool":
      return catalogs.tools?.find((tool) => tool.id === value)?.name ?? value;
    case "spell":
      return catalogs.spells?.find((spell) => spell.id === value)?.name ?? value;
    case "item":
      return catalogs.gear?.find((row) => row.id === value)?.name ?? value;
    case "proficiency": {
      const parsed = parseProficiencyValue(value);
      if (!parsed) return value;
      return parsed.kind === "skill"
        ? (SKILL_LABELS[parsed.id as Skill] ?? parsed.id)
        : (catalogs.tools?.find((tool) => tool.id === parsed.id)?.name ?? parsed.id);
    }
    case "option":
      return optionLabel(def, value, catalogs);
  }
}

function optionLabel(def: ChoiceDef, value: string, catalogs: ChoiceCatalogs): string {
  // An equipment package's id is only unique within its owner, so it is read
  // through the choice rather than looked up globally.
  const owner = equipmentOwnerOf(def.id);
  if (owner) {
    const option = startingEquipmentOption(startingEquipmentById(owner), value);
    if (option) return option.label;
  }
  return (
    getSubclass(value)?.name ??
    getFeat(value)?.name ??
    getClassOption(value)?.name ??
    CREATURE_SIZE_LABELS[value as CreatureSize] ??
    catalogs.gear?.find((row) => row.id === value)?.name ??
    value
  );
}

/** The one-line explanation shown under a value, when the source has one. */
export function choiceValueSummary(
  def: ChoiceDef,
  value: string,
  catalogs?: ChoiceCatalogs,
): string | undefined {
  // Every kind that *can* explain itself does. A picker that lists « Glas ·
  // Nécromancie » and nothing else asks the player to choose blind, when the
  // catalogue has carried the answer all along.
  switch (def.kind) {
    case "skill":
      return SKILL_SUMMARY[value as Skill];
    case "tool": {
      const tool = catalogs?.tools?.find((row) => row.id === value);
      return tool?.description ?? (tool ? TOOL_CATEGORY_DESCRIPTIONS[tool.category] : undefined);
    }
    case "spell":
      return catalogs?.spells?.find((spell) => spell.id === value)?.summary;
    case "item":
      return catalogs?.gear?.find((row) => row.id === value)?.description;
    case "proficiency": {
      const parsed = parseProficiencyValue(value);
      if (!parsed) return undefined;
      if (parsed.kind === "skill") return SKILL_SUMMARY[parsed.id as Skill];
      const tool = catalogs?.tools?.find((row) => row.id === parsed.id);
      return tool?.description ?? (tool ? TOOL_CATEGORY_DESCRIPTIONS[tool.category] : undefined);
    }
    case "language":
      return getLanguage(value)?.summary;
    case "ability":
      // An ability score needs no gloss — the name is the thing.
      return undefined;
    case "option":
      break;
  }

  const owner = equipmentOwnerOf(def.id);
  if (owner) {
    const option = startingEquipmentOption(startingEquipmentById(owner), value);
    // A gold-only package says everything in its label already.
    if (!option || option.items.length === 0) return undefined;
    const items = option.items.map((item) => {
      // An item the player's own tool choice supplies is only named once that
      // choice is resolved — the package itself asks nothing.
      const name = item.fromChoice
        ? tr("common:choices.yourTool")
        : equipmentItemName(item.kind, item.id ?? "", catalogs);
      // « Paquetage d'explorateur » hides ten objects behind one name; the card
      // is the only place the player gets to see what they are taking.
      const contents = item.kind === "pack" ? packContents(item.id ?? "", catalogs) : undefined;
      return `${name}${contents ? ` (${contents})` : ""}${item.qty && item.qty > 1 ? ` ×${item.qty}` : ""}`;
    });
    const gold = option.gold > 0 ? `${option.gold} po` : "";
    return [...items, gold].filter(Boolean).join(", ");
  }

  // A lineage says what it changes: speed, vision, spells.
  const lineage = /^species:(.+):lineage$/.exec(def.id);
  if (lineage) return getLineage(lineage[1], value)?.summary;

  // So does a subclass's spell list (the Circle of the Land's environments).
  const subclassSpells = /^class:(.+):subclass-spells$/.exec(def.id);
  if (subclassSpells) return subclassSpellVariantSummary(subclassSpells[1], value);

  // A subclass, a feat, a lineage — whichever the option names. A feat's blurb
  // wins over its summary: the summary is the rule, which belongs on the sheet,
  // while the picker needs a line you can scan across forty-odd entries.
  // Origin feats and fighting styles carry no blurb, so they fall back to the
  // summary — which is exactly the rule you pick them on.
  const feat = getFeat(value);
  return (
    getSubclass(value)?.blurb ?? feat?.blurb ?? feat?.summary ?? getClassOption(value)?.summary
  );
}

/** What is inside a pack, named and counted; empty while the catalogues load. */
function packContents(id: string, catalogs?: ChoiceCatalogs): string {
  const pack = catalogs?.packs?.find((row) => row.id === id);
  if (!pack || !catalogs?.gear) return "";
  return pack.contents
    .map((entry) => {
      const name = catalogs.gear?.find((row) => row.id === entry.gearId)?.name ?? entry.gearId;
      return entry.qty > 1 ? `${name} ×${entry.qty}` : name;
    })
    .join(", ");
}

/**
 * A starting-equipment item's display name, from whichever catalogue it belongs
 * to. Falls back to the id while the catalogue is still loading.
 */
function equipmentItemName(kind: string, id: string, catalogs?: ChoiceCatalogs): string {
  const rows =
    kind === "tool"
      ? catalogs?.tools
      : kind === "gear"
        ? catalogs?.gear
        : kind === "weapon"
          ? catalogs?.weapons
          : kind === "armor"
            ? catalogs?.armors
            : catalogs?.packs;
  return rows?.find((row) => row.id === id)?.name ?? id;
}

/** Which family of values a `proficiency` pick belongs to — used to group the picker. */
export function proficiencyGroupLabel(value: string): string {
  return parseProficiencyValue(value)?.kind === "tool"
    ? tr("common:choices.tools")
    : tr("common:choices.skills");
}

/**
 * An existing sheet's picks. Anything recorded in `choices` is kept; the rest is
 * read back from the dedicated fields, so a character written before the guided
 * creation reopens in it with its choices already filled in.
 */
export function picksForExistingSheet(sheet: {
  classId?: string;
  speciesId?: string;
  backgroundId?: string;
  level?: number;
  choices?: ChoicePick[];
  skillProficiencies?: string[];
  speciesSkillProficiencies?: string[];
  toolProficiencies?: string[];
  speciesChoice?: string;
  size?: string;
  speciesSpellAbility?: string;
  eldritchInvocations?: readonly (InvocationPick | string)[];
}): ChoicePick[] {
  const defs = resolveChoices({
    classId: sheet.classId,
    speciesId: sheet.speciesId,
    backgroundId: sheet.backgroundId,
    level: sheet.level,
    picks: sheet.choices,
    invocations: sheet.eldritchInvocations,
  });
  return normalizeChoices(defs, sheet);
}
