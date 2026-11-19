import { useEffect, useMemo, useState } from "react";
import {
  activeContent,
  filterSpellsForClass,
  maxSpellLevel,
  translateById,
  type SpellDef,
  SRD_CATALOGS,
  type Shadow,
} from "@adventure-keeper/system-dnd2024";

/**
 * The spell dictionary is a ~100 KB JSON file (plus its English texts). It is **not** part of the initial
 * bundle: `loadSpells()` fetches it with a dynamic import the first time a
 * spellcasting sheet needs it, then caches it for the session.
 */
let cache: SpellDef[] | null = null;
let inflight: Promise<SpellDef[]> | null = null;

export function loadSpells(): Promise<SpellDef[]> {
  if (cache) return Promise.resolve(cache);
  if (!inflight) {
    // The English texts ride along: the spells' names and summaries follow the
    // interface language through the engine's locale (`translateById`).
    inflight = SRD_CATALOGS.spells().then(({ default: file }) => {
      const spells = file.entries as unknown as SpellDef[];
      translateById(spells, { en: file.translations.en as Record<string, Shadow> });
      cache = spells;
      return cache;
    });
  }
  return inflight;
}

export function getLoadedSpells(): SpellDef[] | null {
  return cache;
}

export function findSpell(spells: SpellDef[], id: string): SpellDef | undefined {
  return spells.find((spell) => spell.id === id);
}

export { filterSpellsForClass, maxSpellLevel };

/**
 * Lazily load the spell dictionary; `null` until it arrives. Spells from the
 * active content packs are appended — the caller re-renders when packs change
 * (see `useContentPacks`), which refreshes the merge.
 */
export function useSpells(enabled = true): SpellDef[] | null {
  const [spells, setSpells] = useState<SpellDef[] | null>(cache);
  const packSpells = activeContent()?.spells;
  const merged = useMemo(
    () => (spells && packSpells?.size ? [...spells, ...packSpells.values()] : spells),
    [spells, packSpells],
  );

  useEffect(() => {
    if (!enabled || spells) return;
    let active = true;
    loadSpells()
      .then((loaded) => {
        if (active) setSpells(loaded);
      })
      .catch((error) => console.error("[spells] load failed", error));
    return () => {
      active = false;
    };
  }, [enabled, spells]);

  return merged;
}
