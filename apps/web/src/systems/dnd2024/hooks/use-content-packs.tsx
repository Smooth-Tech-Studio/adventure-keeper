import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { ContentPackDoc, WithId } from "@adventure-keeper/schemas";
import {
  createContentOverlay,
  mergeContentPacks,
  setActiveContent,
  type ContentOverlay,
  type ContentPack,
} from "@adventure-keeper/system-dnd2024";

import { useAuth } from "@/hooks/use-auth";
import {
  subscribeCampaignPacks,
  subscribeMyPacks,
  subscribePacksSharedWithMe,
} from "@/systems/dnd2024/lib/packs";

interface ContentPacksValue {
  /** The signed-in player's own packs. */
  myPacks: WithId<ContentPackDoc>[];
  /** Packs other players shared with them. */
  sharedPacks: WithId<ContentPackDoc>[];
  /** Both lists have answered at least once. */
  loaded: boolean;
  /** What the lookups currently see on top of the SRD (`null` = SRD only). */
  overlay: ContentOverlay | null;
  register: (key: string, packs: readonly ContentPack[]) => void;
  unregister: (key: string) => void;
  /** Pack ids left out of the lookups — the ones a new character does without. */
  setExcludedPacks: (ids: ReadonlySet<string>) => void;
}

const ContentPacksContext = createContext<ContentPacksValue | null>(null);

/**
 * Makes content packs visible to the rules engine's lookups (`getSpecies`,
 * `allBackgrounds`, `subclassesFor`…) for the whole app:
 *
 * - the player's **library** (own + shared packs), which is what character
 *   creation offers;
 * - whatever the screen on display **registers** with {@link useRegisterPacks}
 *   — the copy a character sheet keeps, the packs a campaign allows — so names
 *   and traits resolve even for packs the viewer does not own.
 *
 * Copies of one pack are merged, the library first. The overlay is installed
 * with `setActiveContent` while rendering, before the children read it.
 */
export function ContentPacksProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const uid = user?.uid;
  const [myPacks, setMyPacks] = useState<WithId<ContentPackDoc>[] | null>(null);
  const [sharedPacks, setSharedPacks] = useState<WithId<ContentPackDoc>[] | null>(null);
  const [extras, setExtras] = useState<ReadonlyMap<string, readonly ContentPack[]>>(new Map());
  const [excluded, setExcludedPacks] = useState<ReadonlySet<string>>(new Set());

  useEffect(() => {
    if (!uid) {
      setMyPacks([]);
      setSharedPacks([]);
      return;
    }
    setMyPacks(null);
    setSharedPacks(null);
    const stopMine = subscribeMyPacks(uid, setMyPacks);
    const stopShared = subscribePacksSharedWithMe(uid, setSharedPacks);
    return () => {
      stopMine();
      stopShared();
    };
  }, [uid]);

  const register = useCallback((key: string, packs: readonly ContentPack[]) => {
    setExtras((current) => new Map(current).set(key, packs));
  }, []);
  const unregister = useCallback((key: string) => {
    setExtras((current) => {
      if (!current.has(key)) return current;
      const next = new Map(current);
      next.delete(key);
      return next;
    });
  }, []);

  const overlay = useMemo(() => {
    const library = [...(myPacks ?? []), ...(sharedPacks ?? [])].map((doc) => doc.pack);
    const all = mergeContentPacks([...library, ...[...extras.values()].flat()]).filter(
      (pack) => !excluded.has(pack.id),
    );
    return all.length ? createContentOverlay(all) : null;
  }, [myPacks, sharedPacks, extras, excluded]);

  // Installed during render so the children rendered next already see it.
  setActiveContent(overlay);
  useEffect(() => () => setActiveContent(null), []);

  const value = useMemo<ContentPacksValue>(
    () => ({
      myPacks: myPacks ?? [],
      sharedPacks: sharedPacks ?? [],
      loaded: myPacks !== null && sharedPacks !== null,
      overlay,
      register,
      unregister,
      setExcludedPacks,
    }),
    [myPacks, sharedPacks, overlay, register, unregister],
  );

  return <ContentPacksContext.Provider value={value}>{children}</ContentPacksContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useContentPacks(): ContentPacksValue {
  const value = useContext(ContentPacksContext);
  if (!value) throw new Error("useContentPacks must be used inside <ContentPacksProvider>");
  return value;
}

/** A cheap fingerprint, so a fresh array with the same packs does not re-register. */
function signature(packs: readonly ContentPack[]): string {
  return packs
    .map((pack) => {
      const counts = Object.values(pack.content)
        .map((entries) => entries.map((entry) => entry.id).join(","))
        .join("|");
      return `${pack.id}@${pack.version}:${counts}`;
    })
    .join(";");
}

/**
 * Make `packs` visible to the lookups while the calling component is mounted —
 * a sheet's own copy, a campaign's allowed packs.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function useRegisterPacks(packs: readonly ContentPack[] | undefined): void {
  const { register, unregister } = useContentPacks();
  const key = useId();
  const sig = packs ? signature(packs) : "";
  // `packs` is read through the signature: a new array with the same content
  // must not trigger a provider update (and its re-render) on every render.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const stable = useMemo(() => packs ?? [], [sig]);

  useEffect(() => {
    if (stable.length) register(key, stable);
    else unregister(key);
  }, [key, stable, register, unregister]);
  useEffect(() => () => unregister(key), [key, unregister]);
}

/**
 * Leave `ids` out of the lookups while the calling component is mounted — the
 * packs a player unticked before creating a character.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function useExcludedPacks(ids: ReadonlySet<string>): void {
  const { setExcludedPacks } = useContentPacks();
  const key = [...ids].sort().join(",");
  useEffect(() => {
    setExcludedPacks(new Set(key ? key.split(",") : []));
  }, [key, setExcludedPacks]);
  useEffect(() => () => setExcludedPacks(new Set()), [setExcludedPacks]);
}

/**
 * Make the packs a campaign allows visible while a screen of that campaign is
 * shown — the adventure pages, where the GM picks pack monsters for enemies.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function useCampaignPacks(campaignId: string | undefined): void {
  const [packs, setPacks] = useState<ContentPack[]>([]);
  useEffect(() => {
    if (!campaignId) return;
    return subscribeCampaignPacks(campaignId, (copies) =>
      setPacks(copies.map((copy) => copy.pack)),
    );
  }, [campaignId]);
  useRegisterPacks(packs);
}
