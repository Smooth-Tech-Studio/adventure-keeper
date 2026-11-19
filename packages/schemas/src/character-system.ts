import { z } from "zod";
import { localized } from "@adventure-keeper/locale";

/**
 * Which rules module a character sheet is built with. A campaign requires one
 * system; `dnd2024` characters also satisfy a `standard` requirement because
 * `dnd2024` is a superset of `standard` (name / colour / image / hit points /
 * inventory + 5e specifics). More systems will be added later.
 */
export const CHARACTER_SYSTEMS = ["standard", "dnd2024"] as const;
export const characterSystemSchema = z.enum(CHARACTER_SYSTEMS);
export type CharacterSystem = (typeof CHARACTER_SYSTEMS)[number];

export const CHARACTER_SYSTEM_LABELS: Record<CharacterSystem, string> = localized({
  fr: {
    standard: "Standard",
    dnd2024: "5E (2024)",
  },
  en: {
    standard: "Standard",
    dnd2024: "5E (2024)",
  },
});

/** Default applied to legacy docs written before the field existed. */
export const DEFAULT_CHARACTER_SYSTEM: CharacterSystem = "dnd2024";

/** Can a character built for `characterSystem` join content requiring `required`? */
export function characterSystemSatisfies(
  characterSystem: CharacterSystem,
  required: CharacterSystem,
): boolean {
  if (characterSystem === required) return true;
  // dnd2024 ⊇ standard.
  return required === "standard" && characterSystem === "dnd2024";
}
