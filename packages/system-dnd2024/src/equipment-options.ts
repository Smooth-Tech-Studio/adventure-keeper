/**
 * The shape of a starting-equipment option, and the « take the money
 * instead » option every owner offers. Kept apart from `starting-equipment.ts`
 * so the content modules (`classes.ts`) can build their packages without an
 * import cycle.
 */

import type { ChoiceDef } from "./choices";
import { pick } from "./locale";

/** Which catalogue an {@link EquipmentRef} points into. */
export type EquipmentRefKind = "weapon" | "armor" | "tool" | "gear" | "pack";

export interface EquipmentRef {
  kind: EquipmentRefKind;
  /** Catalogue id. Absent when {@link EquipmentRef.fromChoice} supplies it. */
  id?: string;
  /** Defaults to 1. Ammunition is sold by the bundle, so « 20 flèches » is qty 1. */
  qty?: number;
  /**
   * The item is whichever value a choice resolved to — « vos outils d'artisan »
   * is the pair you are proficient with, not a second decision. Holds the id of
   * that choice.
   */
  fromChoice?: string;
}

export interface EquipmentOptionDef {
  /** Unique within its owner: `"a"`, `"b"`, `"c"`. */
  id: string;
  label: string;
  items: EquipmentRef[];
  /** Gold pieces handed over with the items. */
  gold: number;
  /** Picks this option requires — resolved on the same step. */
  choices?: ChoiceDef[];
}

export interface StartingEquipmentDef {
  /** `"class:druid"` or `"background:acolyte"`. */
  id: string;
  options: EquipmentOptionDef[];
}

/** The « take the money instead » option every owner offers. */
export const goldOnly = (id: string, gold: number): EquipmentOptionDef => ({
  id,
  get label() {
    return pick({ fr: `${gold} po`, en: `${gold} gp` });
  },
  items: [],
  gold,
});
