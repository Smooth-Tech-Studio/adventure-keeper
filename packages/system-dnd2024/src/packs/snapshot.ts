/**
 * What a character keeps of the packs it uses: only the entries it actually
 * references, in the pack format, so its sheet still derives the same once the
 * pack is edited, deleted or no longer shared.
 */

import { packEntryId, resolvePackRef } from "./registry";
import { PACK_CONTENT_KINDS, type ContentPack } from "./schema";
import type { PackTranslations } from "./translations";

/** The translations of the entries kept, nothing more — a sheet stays small. */
function keepTranslations(
  translations: PackTranslations | undefined,
  content: ContentPack["content"],
): PackTranslations | undefined {
  if (!translations) return undefined;
  return Object.fromEntries(
    Object.entries(translations).map(([code, translation]) => [
      code,
      {
        ...translation,
        content: Object.fromEntries(
          PACK_CONTENT_KINDS.flatMap((kind) => {
            const shadows = translation.content[kind];
            if (!shadows) return [];
            const kept = new Set((content[kind] as { id: string }[]).map((entry) => entry.id));
            return [
              [kind, Object.fromEntries(Object.entries(shadows).filter(([id]) => kept.has(id)))],
            ];
          }),
        ),
      },
    ]),
  );
}

/**
 * The parts of `packs` that `usedIds` reference — namespaced ids such as a
 * species, background, subclass, feats or spells — plus what those entries
 * point to inside the same pack (a background's origin feat, a species'
 * spells). Packs with nothing used are left out. Ids from the SRD are ignored.
 */
export function extractUsedContent(
  packs: readonly ContentPack[],
  usedIds: Iterable<string>,
): ContentPack[] {
  const used = new Set(usedIds);
  return packs.flatMap((pack) => {
    const keep = new Set<string>();
    const localFeats = new Set(pack.content.feats.map((f) => f.id));
    const localSpells = new Set(pack.content.spells.map((s) => s.id));
    const localTools = new Set(pack.content.tools.map((t) => t.id));
    const localItems: Record<string, ReadonlySet<string>> = {
      weapon: new Set(pack.content.weapons.map((w) => w.id)),
      armor: new Set(pack.content.armors.map((a) => a.id)),
      tool: localTools,
      gear: new Set(pack.content.gear.map((g) => g.id)),
      pack: new Set(pack.content.equipmentPacks.map((p) => p.id)),
    };
    /** A kit line's item, when it is one of this pack's. */
    const keepItem = (item: { kind: string; id?: string }) => {
      if (item.id) keepRef(item.id, localItems[item.kind]);
    };
    const isUsed = (slug: string) => used.has(packEntryId(pack.id, slug));
    // A local reference resolves to this pack's own namespaced id.
    const keepRef = (ref: string, local: ReadonlySet<string>) => {
      const id = resolvePackRef(pack.id, ref, local);
      if (id === packEntryId(pack.id, ref)) keep.add(id);
    };

    const localLanguages = new Set(pack.content.languages.map((l) => l.id));
    for (const klass of pack.content.classes) {
      if (!isUsed(klass.id)) continue;
      for (const language of klass.languages ?? []) keepRef(language, localLanguages);
      for (const grant of klass.spells ?? []) keepRef(grant.spellId, localSpells);
      for (const tool of klass.toolProficiencies) keepRef(tool, localTools);
      for (const option of klass.startingEquipment?.options ?? []) {
        // A pack stored without parsing has no `items` on a gold-only option.
        for (const item of option.items ?? []) keepItem(item);
      }
    }
    const localInvocations = new Set(pack.content.invocations.map((i) => i.id));
    for (const invocation of pack.content.invocations) {
      if (!isUsed(invocation.id)) continue;
      for (const grant of invocation.spells ?? []) keepRef(grant.spellId, localSpells);
      if (invocation.requires) keepRef(invocation.requires, localInvocations);
    }
    for (const species of pack.content.species) {
      if (!isUsed(species.id)) continue;
      for (const language of species.languages ?? []) keepRef(language, localLanguages);
      const grants = [
        ...(species.spells ?? []),
        ...Object.values(species.lineages ?? {}).flatMap((l) => l.spells ?? []),
      ];
      for (const grant of grants) keepRef(grant.spellId, localSpells);
    }
    for (const background of pack.content.backgrounds) {
      if (!isUsed(background.id)) continue;
      if (background.originFeatId) keepRef(background.originFeatId, localFeats);
      const tool = background.toolProficiency;
      if (tool && "toolId" in tool) keepRef(tool.toolId, localTools);
      for (const item of background.startingKit?.items ?? []) keepItem(item);
    }

    // An equipment pack kept brings the gear it holds.
    for (const bundle of pack.content.equipmentPacks) {
      if (!isUsed(bundle.id) && !keep.has(packEntryId(pack.id, bundle.id))) continue;
      for (const line of bundle.contents) keepRef(line.gearId, localItems.gear);
    }

    const content = Object.fromEntries(
      PACK_CONTENT_KINDS.map((kind) => [
        kind,
        (pack.content[kind] as { id: string }[]).filter(
          (entry) => isUsed(entry.id) || keep.has(packEntryId(pack.id, entry.id)),
        ),
      ]),
    ) as ContentPack["content"];

    const empty = PACK_CONTENT_KINDS.every((kind) => content[kind].length === 0);
    if (empty) return [];
    return [{ ...pack, content, translations: keepTranslations(pack.translations, content) }];
  });
}
