import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import type { CampaignPack } from "@adventure-keeper/schemas";
import { packText, type ContentPack, type PackContentKind } from "@adventure-keeper/system-dnd2024";
import { useTranslation } from "react-i18next";

import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/hooks/use-auth";
import { nameOf, useUserProfiles } from "@/hooks/use-user-profiles";
import i18n, { currentLanguage } from "@/i18n";
import type { WithId } from "@/lib/collections";
import {
  useContentPacks,
  useExcludedPacks,
  useRegisterPacks,
} from "@/systems/dnd2024/hooks/use-content-packs";
import { packByline } from "@/systems/dnd2024/lib/pack-labels";
import { subscribeCampaignPacks } from "@/systems/dnd2024/lib/packs";

/**
 * `?campaign=` (from the campaign's « Packs autorisés » card): offer that
 * campaign's packs on top of the player's own library.
 */
function useCampaignPacks(campaignId: string | null) {
  const [packs, setPacks] = useState<WithId<CampaignPack>[]>([]);
  useEffect(() => {
    if (!campaignId) return;
    return subscribeCampaignPacks(campaignId, setPacks);
  }, [campaignId]);
  useRegisterPacks(packs.map((copy) => copy.pack));
  return packs;
}

/** A pack the creation can draw from, with where it comes from. */
interface AvailablePack {
  id: string;
  name: string;
  source: string;
  /** « 2 espèces, 1 historique » — what it adds to the creation. */
  contents: string;
}

const KINDS: PackContentKind[] = [
  "species",
  "backgrounds",
  "subclasses",
  "feats",
  "spells",
  "tools",
  "monsters",
];

function describeContents(pack: ContentPack): string {
  return (
    KINDS.map((kind) => {
      const count = pack.content[kind].length;
      return count ? i18n.t(`characters:create.kinds.${kind}`, { count }) : "";
    })
      .filter(Boolean)
      .join(", ") || i18n.t("characters:create.empty")
  );
}

/** Library and campaign packs, one line per pack id (the campaign copy wins). */
function useAvailablePacks(campaignPacks: WithId<CampaignPack>[]): {
  packs: AvailablePack[];
  loaded: boolean;
} {
  const { t } = useTranslation("characters", { keyPrefix: "create" });
  const { user } = useAuth();
  const { myPacks, sharedPacks, loaded } = useContentPacks();
  const owners = useUserProfiles(sharedPacks.map((doc) => doc.ownerId));
  const byId = new Map<string, AvailablePack>();
  const add = (pack: ContentPack, source: string) =>
    byId.set(pack.id, {
      id: pack.id,
      name: packText(pack, "name") ?? pack.name,
      source,
      contents: describeContents(pack),
    });
  for (const doc of myPacks) add(doc.pack, packByline(doc.pack, t("yourPack")));
  for (const doc of sharedPacks) {
    add(
      doc.pack,
      packByline(
        doc.pack,
        doc.ownerId === user?.uid
          ? t("yourPack")
          : t("sharedBy", { name: nameOf(owners, doc.ownerId, doc.ownerName) }),
      ),
    );
  }
  for (const copy of campaignPacks) {
    add(copy.pack, packByline(copy.pack, t("campaignPack")));
  }
  return {
    packs: [...byId.values()].sort((a, b) => a.name.localeCompare(b.name, currentLanguage())),
    loaded,
  };
}

interface CreationPacks {
  packs: AvailablePack[];
  loaded: boolean;
  excluded: ReadonlySet<string>;
  toggle: (id: string) => void;
}

const CreationPacksContext = createContext<CreationPacks | null>(null);

/**
 * The packs a creation draws from, kept for the whole creation page: the
 * player's library, the campaign's packs (`?campaign=`), and the ones the
 * player unticked — their content is not offered, in the chooser nor in the
 * wizard that follows.
 */
export function CreationPacksScope({
  campaignId,
  children,
}: {
  campaignId: string | null;
  children: ReactNode;
}) {
  const { user } = useAuth();
  // A campaign's packs are only readable with an account.
  const campaignPacks = useCampaignPacks(user ? campaignId : null);
  const { packs, loaded } = useAvailablePacks(campaignPacks);
  const [excluded, setExcluded] = useState<ReadonlySet<string>>(new Set());
  useExcludedPacks(excluded);
  // `packs` is rebuilt on every render: what it says is what matters.
  const packsKey = JSON.stringify(packs);
  const value = useMemo<CreationPacks>(
    () => ({
      packs: JSON.parse(packsKey) as AvailablePack[],
      loaded,
      excluded,
      toggle: (id) =>
        setExcluded((current) => {
          const next = new Set(current);
          if (next.has(id)) next.delete(id);
          else next.add(id);
          return next;
        }),
    }),
    [packsKey, loaded, excluded],
  );
  return <CreationPacksContext.Provider value={value}>{children}</CreationPacksContext.Provider>;
}

/** The pack choice, in the system chooser. */
export function CreationPackChoice() {
  const packs = useContext(CreationPacksContext);
  if (!packs) return null;
  return (
    <PackChoice
      packs={packs.packs}
      loaded={packs.loaded}
      excluded={packs.excluded}
      onToggle={packs.toggle}
    />
  );
}

/**
 * The content the creation will draw from, made explicit: the SRD always, plus
 * each pack the player can tick off. Without this, a pack's species simply
 * appeared among the others.
 */
function PackChoice({
  packs,
  loaded,
  excluded,
  onToggle,
}: {
  packs: AvailablePack[];
  loaded: boolean;
  excluded: ReadonlySet<string>;
  onToggle: (id: string) => void;
}) {
  const { t } = useTranslation("characters", { keyPrefix: "create" });
  return (
    <div className="flex flex-col gap-3">
      <span className="type-label">{t("content")}</span>
      <p className="text-muted-foreground text-sm">
        {t("srdAlways")} {packs.length > 0 ? t("tickPacks") : t("addPacks")}
      </p>
      {!loaded ? (
        <p className="text-muted-foreground text-sm">{t("loadingPacks")}</p>
      ) : packs.length === 0 ? (
        <Link to="/packs" className="text-sm underline underline-offset-4">
          {t("managePacks")}
        </Link>
      ) : (
        <ul className="flex flex-col gap-2">
          {packs.map((pack) => {
            const id = `pack-${pack.id}`;
            return (
              <li key={pack.id} className="flex items-start gap-3 rounded-lg border px-3 py-2.5">
                <Checkbox
                  id={id}
                  className="mt-0.5"
                  checked={!excluded.has(pack.id)}
                  onCheckedChange={() => onToggle(pack.id)}
                />
                <label htmlFor={id} className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-sm font-medium">{pack.name}</span>
                  <span className="text-muted-foreground text-xs">
                    {pack.source} · {pack.contents}
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
