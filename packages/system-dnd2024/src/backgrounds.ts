import { z } from "zod";
import { ABILITIES, type Ability } from "./abilities";
import type { Skill } from "./skills";
import type { ToolChoiceGroup } from "./tools";
import type { ChoiceDef } from "./choices";
import type { EquipmentRef } from "./starting-equipment";
import { activeContent } from "./packs/active";
import { translateTree, type Shadow } from "./locale";
import SRD_BACKGROUND_FILE from "./srd/backgrounds.json";

/**
 * 5e 2024 backgrounds. Each grants: three ability options (allocate +2/+1 or
 * +1/+1/+1 — see `isValidBackgroundBonusPattern`), two skill proficiencies, one
 * tool proficiency and one origin feat. Only names are stored, no rules text.
 *
 * **Only the SRD 5.2.1 content lives here.** Everything else from the 2024
 * rules was moved out of the code on 8 October 2026 into a private content pack
 * (see `docs/CONTENT_PACKS.md`): a table that owns the book imports it and
 * shares it, the app does not ship it.
 */
export interface BackgroundDef {
  /** A `BackgroundId` for the SRD; `"pack:slug"` for a pack background. */
  id: string;
  name: string;
  /** An illustration, hosted by the pack's author. */
  imageUrl?: string;
  /**
   * One line on the life your character led before adventuring, shown on the
   * creation card above the proficiencies. Our words, never rulebook prose.
   */
  blurb: string;
  abilityOptions: Ability[];
  /**
   * The three grants below are **absent on a custom background**, where the
   * player picks them instead — `resolveChoices` turns each absence into a
   * `ChoiceDef`. On the four SRD backgrounds they are always present.
   */
  skillProficiencies?: [Skill, Skill];
  toolProficiency?: BackgroundToolProficiency;
  /** Id of the origin feat granted, resolved through `getFeat` (see `feats.ts`). */
  originFeatId?: string;
  /**
   * The background's own starting package; the « 50 po instead » option is
   * added (see `backgroundStartingEquipment`). Absent on the custom background.
   */
  startingKit?: { items: EquipmentRef[]; gold: number; choices?: ChoiceDef[] };
}

/**
 * A background's tool proficiency: either a fixed catalogue tool (`toolId`), or
 * a group the player picks from (`choice`). `label` is the display string so the
 * UI never has to load the tool catalogue.
 */
export type BackgroundToolProficiency =
  | { label: string; toolId: string }
  | { label: string; choice: Extract<ToolChoiceGroup, "artisan" | "instrument" | "gaming"> };

export const BACKGROUND_IDS = [
  "acolyte",
  "criminal",
  "sage",
  "soldier",
  /** Not a rulebook background: the player defines their own (see `BACKGROUNDS`). */
  "custom",
] as const;
export const backgroundIdSchema = z.enum(BACKGROUND_IDS);
export type BackgroundId = (typeof BACKGROUND_IDS)[number];

/** The SRD backgrounds, read from `srd/backgrounds.json` (the pack format). */
const SRD_BACKGROUNDS: BackgroundDef[] = (
  SRD_BACKGROUND_FILE.entries as unknown as BackgroundDef[]
).map((entry) => ({
  ...entry,
  startingKit: entry.startingKit && {
    ...entry.startingKit,
    // A kit item from one of the background's own choices: `background:<id>:<slug>`.
    items: entry.startingKit.items.map((item) =>
      item.fromChoice ? { ...item, fromChoice: `background:${entry.id}:${item.fromChoice}` } : item,
    ),
  },
}));

{
  const english = SRD_BACKGROUND_FILE.translations.en as Record<string, Shadow>;
  SRD_BACKGROUNDS.forEach((background) =>
    translateTree(background, { en: english[background.id] }),
  );
}

/**
 * Not a rulebook background: the player designs their own (the SRD's
 * « Conception d'historique »). A rule, not an entry — it stays in the code.
 */
const CUSTOM_BACKGROUND: BackgroundDef = {
  id: "custom",
  name: "Personnalisé",
  blurb:
    "Vous inventez votre propre passé et choisissez vous-même compétences, outil et don d'origine.",
  // Every ability is open — the +2/+1 spread is entirely the player's.
  abilityOptions: [...ABILITIES],
  // No grant at all: each absence becomes a choice in `resolveChoices`.
};
translateTree(CUSTOM_BACKGROUND, {
  en: {
    name: "Custom",
    blurb: "You invent your own past and choose your skills, tool and origin feat yourself.",
  },
});

/** The SRD backgrounds, then the custom one. */
export const BACKGROUNDS: BackgroundDef[] = [...SRD_BACKGROUNDS, CUSTOM_BACKGROUND];

export function getBackground(id: string): BackgroundDef | undefined {
  return (
    activeContent()?.backgrounds.get(id) ?? BACKGROUNDS.find((background) => background.id === id)
  );
}

/** The built-in backgrounds, then those of the active content packs. */
export function allBackgrounds(): BackgroundDef[] {
  const packs = activeContent()?.backgrounds;
  return packs ? [...BACKGROUNDS, ...packs.values()] : BACKGROUNDS;
}

/** The fixed tool id a background grants, or `undefined` when it is a choice. */
export function backgroundFixedToolId(background: BackgroundDef): string | undefined {
  const tool = background.toolProficiency;
  return tool && "toolId" in tool ? tool.toolId : undefined;
}
