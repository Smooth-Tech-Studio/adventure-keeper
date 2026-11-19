/**
 * Emitting the catalogues as JSON.
 *
 * The long-term goal is a character sheet described by JSON files rather than
 * by TypeScript. The first design principle of the guided creation was written
 * for that day: the description modules hold **only** ids, enums, numbers,
 * strings and arrays — no function, no closure, no instance — so that the day
 * the export matters, it is a `JSON.stringify`, not a rewrite.
 *
 * This module is that `JSON.stringify`, and `export-json.test.ts` is the proof
 * that the principle held. It is deliberately **not** the sheet layout:
 * describing *how a sheet is drawn* in data is a design question that needs a
 * second game system to answer honestly. What ships here is the part that is
 * ready — the catalogues a sheet reads from.
 */

import { BACKGROUNDS } from "./backgrounds";
import { CLASSES } from "./classes";
import { FEATS } from "./feats";
import { SPECIES } from "./species";
import { SUBCLASSES } from "./subclasses";
import { BACKGROUND_STARTING_EQUIPMENT, type StartingEquipmentDef } from "./starting-equipment";

/** Bumped when a catalogue's *shape* changes, not when an entry is added. */
export const CATALOG_SCHEMA_VERSION = 1;

export interface CatalogExport {
  schemaVersion: number;
  /** The rules edition these catalogues describe. */
  system: "dnd2024";
  classes: typeof CLASSES;
  species: typeof SPECIES;
  backgrounds: typeof BACKGROUNDS;
  subclasses: typeof SUBCLASSES;
  feats: typeof FEATS;
  startingEquipment: {
    classes: Record<string, StartingEquipmentDef | undefined>;
    backgrounds: typeof BACKGROUND_STARTING_EQUIPMENT;
  };
}

/** Every catalogue, as one plain object ready for `JSON.stringify`. */
export function catalogExport(): CatalogExport {
  return {
    schemaVersion: CATALOG_SCHEMA_VERSION,
    system: "dnd2024",
    classes: CLASSES,
    species: SPECIES,
    backgrounds: BACKGROUNDS,
    subclasses: SUBCLASSES,
    feats: FEATS,
    startingEquipment: {
      classes: Object.fromEntries(CLASSES.map((klass) => [klass.id, klass.startingEquipment])),
      backgrounds: BACKGROUND_STARTING_EQUIPMENT,
    },
  };
}

/** The same, serialised. `indent` of 0 gives the compact form. */
export function catalogJson(indent = 2): string {
  return JSON.stringify(catalogExport(), null, indent);
}
