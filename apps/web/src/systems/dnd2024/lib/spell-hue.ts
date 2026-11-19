import type { CSSProperties } from "react";
import type { SpellDef } from "@adventure-keeper/system-dnd2024";

/** One hue per school, so a hand reads at a glance. */
const SCHOOL_HUE: Record<string, number> = {
  abjuration: 220,
  divination: 200,
  enchantment: 330,
  evocation: 25,
  illusion: 285,
  conjuration: 60,
  necromancy: 140,
  transmutation: 95,
};

/** The card's colour: its school's hue. */
export const spellHueStyle = (spell: SpellDef) =>
  ({ "--hue": SCHOOL_HUE[spell.school] ?? 260 }) as CSSProperties;
