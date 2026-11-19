import {
  PACK_CONTENT_KINDS,
  activeContent,
  packIdOf,
  packLanguages,
  packText,
  type ContentPack,
  type PackContentKind,
} from "@adventure-keeper/system-dnd2024";
import { LANGUAGE_NAMES, tr } from "@/i18n";

/**
 * The name of the content pack an entry comes from (`"pack:slug"` ids), or
 * `undefined` for SRD content. Falls back to the pack id when that pack is
 * not loaded.
 */
export function packNameOf(id: string): string | undefined {
  const packId = packIdOf(id);
  if (!packId) return undefined;
  const pack = activeContent()?.sourcePacks.find((source) => source.id === packId);
  return (pack && packText(pack, "name")) ?? packId;
}

export const PACK_KIND_PLURALS: Record<PackContentKind, string> = Object.defineProperties(
  {} as Record<PackContentKind, string>,
  Object.fromEntries(
    PACK_CONTENT_KINDS.map((kind) => [
      kind,
      { enumerable: true, get: () => tr(`packs:kinds.${kind}`) },
    ]),
  ),
);

/** « 2 espèces · 3 dons » — the non-empty kinds of a pack. */
export function packSummary(pack: ContentPack): string {
  const parts = PACK_CONTENT_KINDS.flatMap((kind) => {
    const count = pack.content[kind].length;
    return count ? [tr(`characters:create.kinds.${kind}`, { count })] : [];
  });
  return parts.length ? parts.join(" · ") : tr("packs:empty");
}

/** A stored pack's name in the reader's language (its translation's, if it has one). */
export function packName(doc: { name: string; pack: ContentPack }): string {
  return packText(doc.pack, "name") ?? doc.name;
}

/** What a field shows for a pack entry it cannot resolve: its slug, readable. */
export function unresolvedPackLabel(id: string): string {
  const packId = packIdOf(id);
  return packId ? id.slice(packId.length + 1).replace(/-/g, " ") : id;
}

/**
 * Who a pack is from, as a byline: its author — the one the file credits,
 * a community creator included — then where it comes from. « Créé par Gandalf ·
 * partagé par Rémi », or just the source when the file names no author.
 */
export function packByline(
  pack: Pick<ContentPack, "author" | "language" | "translations">,
  source: string,
): string {
  const author = packText(pack, "author")?.trim();
  if (!author) return source;
  return tr("packs:byline", {
    author,
    source: `${source.charAt(0).toLowerCase()}${source.slice(1)}`,
  });
}

/** « Français, English » — every language the pack can be read in. */
export function packLanguageNames(pack: Pick<ContentPack, "language" | "translations">): string {
  return packLanguages(pack)
    .map((code) => LANGUAGE_NAMES[code])
    .join(", ");
}
