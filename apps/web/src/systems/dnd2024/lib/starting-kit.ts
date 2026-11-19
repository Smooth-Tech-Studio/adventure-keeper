/**
 * Turning a chosen starting-equipment package into actual sheet lines.
 *
 * `starting-equipment.ts` describes each package as catalogue *references*; this
 * resolves them against the loaded catalogues and produces the weapons, armour,
 * tools and inventory a character actually starts with, plus the gold the
 * package hands over — which is what the shop step then spends.
 *
 * Two resolutions happen here:
 *
 * - **packs are expanded**. « Paquetage d'explorateur » becomes its ten lines,
 *   because a player wants to see the rope and the rations, not the bundle.
 * - **`fromChoice` refs** are replaced by the tool the player is proficient
 *   with — « vos outils d'artisan » is a pointer, not a second decision.
 */

import {
  choiceValue,
  startingEquipmentById,
  startingEquipmentOption,
  type ChoicePick,
} from "@adventure-keeper/system-dnd2024";

import type { ChoiceCatalogs } from "@/systems/dnd2024/lib/choices";
import {
  draftFromArmorDef,
  draftFromGearDef,
  draftFromToolDef,
  draftFromWeaponDef,
  type ItemDraft,
} from "@/systems/dnd2024/lib/items";

export interface StartingKit {
  weapons: ItemDraft[];
  armors: ItemDraft[];
  tools: ItemDraft[];
  inventory: ItemDraft[];
  /** Gold pieces the chosen packages hand over. */
  gold: number;
}

const EMPTY_KIT: StartingKit = {
  weapons: [],
  armors: [],
  tools: [],
  inventory: [],
  gold: 0,
};

export interface StartingKitInput {
  classId?: string;
  backgroundId?: string;
  picks?: readonly ChoicePick[];
  catalogs: ChoiceCatalogs;
}

/**
 * The lines and gold the chosen packages produce. Returns an empty kit while the
 * catalogues are still loading, so a caller can render without guarding.
 */
export function buildStartingKit(input: StartingKitInput): StartingKit {
  const { catalogs } = input;
  if (!catalogs.weapons || !catalogs.armors || !catalogs.tools || !catalogs.gear) {
    return { ...EMPTY_KIT };
  }

  const kit: StartingKit = { weapons: [], armors: [], tools: [], inventory: [], gold: 0 };
  const owners = [
    input.classId ? `class:${input.classId}` : undefined,
    input.backgroundId ? `background:${input.backgroundId}` : undefined,
  ].filter((owner): owner is string => Boolean(owner));

  for (const owner of owners) {
    const def = startingEquipmentById(owner);
    if (!def) continue;
    const option = startingEquipmentOption(def, choiceValue(input.picks, `${owner}:equipment`));
    if (!option) continue;

    kit.gold += option.gold;

    for (const ref of option.items) {
      // The tool a proficiency choice already settled.
      const id = ref.fromChoice ? choiceValue(input.picks, ref.fromChoice) : ref.id;
      if (!id) continue;
      addRef(kit, ref.kind, id, ref.qty ?? 1, catalogs);
    }
  }

  return kit;
}

function addRef(
  kit: StartingKit,
  kind: string,
  id: string,
  qty: number,
  catalogs: ChoiceCatalogs,
): void {
  switch (kind) {
    case "weapon": {
      const def = catalogs.weapons?.find((row) => row.id === id);
      if (def) kit.weapons.push({ ...draftFromWeaponDef(def), quantity: qty });
      return;
    }
    case "armor": {
      const def = catalogs.armors?.find((row) => row.id === id);
      if (def) kit.armors.push({ ...draftFromArmorDef(def), quantity: qty });
      return;
    }
    case "tool": {
      const def = catalogs.tools?.find((row) => row.id === id);
      if (def) kit.tools.push({ ...draftFromToolDef(def), quantity: qty });
      return;
    }
    case "gear": {
      const def = catalogs.gear?.find((row) => row.id === id);
      if (def) kit.inventory.push({ ...draftFromGearDef(def), quantity: qty });
      return;
    }
    case "pack": {
      // Expanded: the player carries the contents, not the bundle.
      const pack = catalogs.packs?.find((row) => row.id === id);
      for (const entry of pack?.contents ?? []) {
        const def = catalogs.gear?.find((row) => row.id === entry.gearId);
        if (def) kit.inventory.push({ ...draftFromGearDef(def), quantity: entry.qty * qty });
      }
      return;
    }
  }
}

/** What a kit's gold is worth, in copper — the shop's starting purse. */
export function kitPurseCp(kit: StartingKit): number {
  return kit.gold * 100;
}

/** Total price of a list of items, in copper. */
export function itemsCostCp(items: readonly ItemDraft[]): number {
  return items.reduce(
    (total, item) => total + (item.priceCp ?? 0) * Math.max(1, item.quantity ?? 1),
    0,
  );
}

/** Total weight of a list of items, in kilograms. */
export function itemsWeightKg(items: readonly ItemDraft[]): number {
  return items.reduce(
    (total, item) => total + (item.weightKg ?? 0) * Math.max(1, item.quantity ?? 1),
    0,
  );
}
