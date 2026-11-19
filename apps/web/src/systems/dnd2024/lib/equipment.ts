import { useEffect, useMemo, useState } from "react";
import {
  SRD_CATALOGS,
  activeContent,
  translateById,
  type ArmorDef,
  type EquipmentPackDef,
  type GearDef,
  type Shadow,
  type ToolDef,
  type WeaponDef,
} from "@adventure-keeper/system-dnd2024";

/**
 * The 5e equipment catalogues (weapons / armour / tools / gear) are static
 * JSON, loaded the same lazy way as `spells.json`: not part of the initial
 * bundle, fetched with a dynamic import the first time a picker needs them,
 * then cached for the session.
 */
function makeCatalogLoader<T extends object>(
  /** The SRD kind file: entries, and their English texts by id (they follow the engine's locale). */
  importer: () => Promise<{ default: { entries: unknown; translations: { en: unknown } } }>,
) {
  let cache: T[] | null = null;
  let inflight: Promise<T[]> | null = null;

  function load(): Promise<T[]> {
    if (cache) return Promise.resolve(cache);
    if (!inflight) {
      inflight = importer().then(({ default: file }) => {
        const rows = file.entries as T[];
        translateById(rows, { en: file.translations.en as Record<string, Shadow> });
        cache = rows;
        return cache;
      });
    }
    return inflight;
  }

  function useCatalog(enabled = true): T[] | null {
    const [rows, setRows] = useState<T[] | null>(cache);
    useEffect(() => {
      if (!enabled || rows) return;
      let active = true;
      load()
        .then((loaded) => {
          if (active) setRows(loaded);
        })
        .catch((error) => console.error("[equipment] load failed", error));
      return () => {
        active = false;
      };
    }, [enabled, rows]);
    return rows;
  }

  return { load, useCatalog, peek: () => cache };
}

const weapons = makeCatalogLoader<WeaponDef>(SRD_CATALOGS.weapons);
const armors = makeCatalogLoader<ArmorDef>(SRD_CATALOGS.armors);
const tools = makeCatalogLoader<ToolDef>(SRD_CATALOGS.tools);
const gear = makeCatalogLoader<GearDef>(SRD_CATALOGS.gear);
const packs = makeCatalogLoader<EquipmentPackDef>(SRD_CATALOGS.equipmentPacks);

type Overlay = NonNullable<ReturnType<typeof activeContent>>;

/**
 * A catalogue plus the entries of the active content packs. Callers re-render
 * when packs change (see `useContentPacks`), which refreshes the merge.
 */
function withPacks<T extends object>(
  catalog: ReturnType<typeof makeCatalogLoader<T>>,
  ofPacks: (overlay: Overlay) => ReadonlyMap<string, T>,
) {
  const merge = (base: T[] | null): T[] | null => {
    const extra = activeContent();
    const fromPacks = extra ? ofPacks(extra) : undefined;
    return base && fromPacks?.size ? [...base, ...fromPacks.values()] : base;
  };
  return {
    load: async () => merge(await catalog.load()) ?? [],
    useCatalog(enabled = true): T[] | null {
      const base = catalog.useCatalog(enabled);
      const extra = activeContent();
      const fromPacks = extra ? ofPacks(extra) : undefined;
      return useMemo(
        () => (base && fromPacks?.size ? [...base, ...fromPacks.values()] : base),
        [base, fromPacks],
      );
    },
  };
}

const weaponCatalog = withPacks(weapons, (overlay) => overlay.weapons);
const armorCatalog = withPacks(armors, (overlay) => overlay.armors);
const toolCatalog = withPacks(tools, (overlay) => overlay.tools);
const gearCatalog = withPacks(gear, (overlay) => overlay.gear);
const packCatalog = withPacks(packs, (overlay) => overlay.equipmentPacks);

export const loadWeaponCatalog = weaponCatalog.load;
export const loadArmorCatalog = armorCatalog.load;
export const loadToolCatalog = toolCatalog.load;
export const loadGearCatalog = gearCatalog.load;
export const loadEquipmentPacks = packCatalog.load;

export const useWeaponCatalog = weaponCatalog.useCatalog;
export const useArmorCatalog = armorCatalog.useCatalog;
export const useToolCatalog = toolCatalog.useCatalog;
export const useGearCatalog = gearCatalog.useCatalog;
export const useEquipmentPacks = packCatalog.useCatalog;

export function findById<T extends { id: string }>(rows: T[] | null, id: string): T | undefined {
  return rows?.find((row) => row.id === id);
}
