/**
 * Fields kept out of `characters/{id}`, which every member of the sheet's
 * campaigns reads: they live in `characters/{id}/private/belongings`, read by
 * the owner and the GM only. Weapons, armour, tools and familiars stay public.
 *
 * On its own, without imports, so the scripts can take it from the source.
 */
export const CHARACTER_PRIVATE_FIELDS = [
  "inventory",
  "money",
  "experiencePoints",
  "notes",
] as const;
export type CharacterPrivateField = (typeof CHARACTER_PRIVATE_FIELDS)[number];
