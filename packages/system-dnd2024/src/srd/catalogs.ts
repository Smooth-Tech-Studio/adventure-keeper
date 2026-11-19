/**
 * The SRD's large catalogues — spells and equipment — loaded on demand: each
 * file is a chunk of its own, fetched the first time a picker needs it, never
 * part of the engine's initial bundle. Each resolves to the pack-format kind
 * file: `{ entries, translations: { en } }`.
 */
export const SRD_CATALOGS = {
  spells: () => import("./spells.json"),
  weapons: () => import("./weapons.json"),
  armors: () => import("./armors.json"),
  tools: () => import("./tools.json"),
  gear: () => import("./gear.json"),
  equipmentPacks: () => import("./equipment-packs.json"),
};
