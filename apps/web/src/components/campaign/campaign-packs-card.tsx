import { Link } from "react-router-dom";
import { PackageIcon, PlusIcon, RefreshCwIcon, XIcon } from "lucide-react";
import { toast } from "sonner";
import type { Campaign, CampaignPack, ContentPackDoc } from "@adventure-keeper/schemas";
import { useTranslation } from "react-i18next";

import { Badge } from "@/components/ui/badge";
import { PackLanguageBadge } from "@/systems/dnd2024/packs/components/pack-language-badge";
import { Button } from "@/components/ui/button";
import { CampaignCard } from "@/components/campaign/campaign-card";
import { Separator } from "@/components/ui/separator";
import { useContentPacks } from "@/systems/dnd2024/hooks/use-content-packs";
import type { WithId } from "@/lib/collections";
import { packByline, packName, packSummary } from "@/systems/dnd2024/lib/pack-labels";
import {
  activatePackInCampaign,
  deactivatePackInCampaign,
  type PackUser,
} from "@/systems/dnd2024/lib/packs";
import { nameOf, useUserProfiles } from "@/hooks/use-user-profiles";
import { currentLanguage } from "@/i18n";
import { soleSystemFor } from "@/systems";

interface Props {
  campaign: WithId<Campaign>;
  packs: WithId<CampaignPack>[];
  isGm: boolean;
  me: PackUser;
}

/**
 * The content packs allowed in the campaign. The GM allows a pack from their
 * library (it is copied into the campaign), refreshes it to a newer version,
 * or withdraws it; players see the list and can create a character with them.
 */
export function CampaignPacksCard({
  campaign,
  packs,
  isGm,
  me,
  titled = true,
}: Props & {
  /** Off in a phone's tab, which names it already. */
  titled?: boolean;
}) {
  const { t } = useTranslation("campaigns", { keyPrefix: "packs" });
  // A campaign that takes one system only skips the choice of a system.
  const onlySystem = soleSystemFor(campaign.characterSystem);
  const { myPacks, sharedPacks } = useContentPacks();
  const library = [...myPacks, ...sharedPacks];
  const sourceOf = (copy: CampaignPack) => library.find((pack) => pack.id === copy.sourceId);
  const activeIds = new Set(packs.map((pack) => pack.packId));
  const owners = useUserProfiles([
    ...packs.map((copy) => copy.ownerId),
    ...library.map((pack) => pack.ownerId),
  ]);
  const available = library
    .filter((pack) => !packs.some((copy) => copy.sourceId === pack.id))
    .sort((a, b) => a.name.localeCompare(b.name, currentLanguage()));

  async function activate(pack: WithId<ContentPackDoc>, verb: "activated" | "updated") {
    try {
      const result = await activatePackInCampaign(campaign.id, pack, me);
      if (result.ok) toast.success(t(verb, { name: packName(pack) }));
      else toast.error(result.reason);
    } catch (error) {
      console.error(error);
      toast.error(t("activateFailed"));
    }
  }

  async function withdraw(copy: WithId<CampaignPack>) {
    try {
      await deactivatePackInCampaign(campaign.id, copy.packId);
      toast.success(t("withdrawn", { name: packName(copy) }));
    } catch (error) {
      console.error(error);
      toast.error(t("withdrawFailed"));
    }
  }

  if (!isGm && packs.length === 0) return null;

  return (
    <CampaignCard
      title={titled ? t("title") : undefined}
      icon={PackageIcon}
      contentClassName="flex flex-col gap-4"
    >
      {isGm && <p className="text-muted-foreground -mt-1 text-xs">{t("introGm")}</p>}
      {packs.length === 0 ? (
        <p className="text-muted-foreground text-sm">{t("none")}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {packs.map((copy) => {
            const source = sourceOf(copy);
            const outdated =
              source && (source.version !== copy.version || source.name !== copy.name);
            return (
              <li key={copy.id} className="flex flex-wrap items-center gap-2 text-sm">
                <PackageIcon className="text-muted-foreground size-4 shrink-0" />
                <span className="min-w-0 flex-1">
                  <span className="font-medium">{packName(copy)}</span>{" "}
                  <PackLanguageBadge pack={copy.pack} />{" "}
                  <span className="text-muted-foreground text-xs">
                    v{copy.version} ·{" "}
                    {packByline(
                      copy.pack,
                      t("byOwner", { name: nameOf(owners, copy.ownerId, copy.ownerName) }),
                    )}{" "}
                    · {packSummary(copy.pack)}
                  </span>
                </span>
                {isGm && outdated && (
                  <Badge variant="outline">{t("available", { version: source.version })}</Badge>
                )}
                {isGm && source && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => activate(source, "updated")}
                  >
                    <RefreshCwIcon /> {t("update")}
                  </Button>
                )}
                {isGm && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    aria-label={t("withdraw", { name: packName(copy) })}
                    onClick={() => withdraw(copy)}
                  >
                    <XIcon className="size-4" />
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {!isGm && (
        <Button asChild variant="outline" size="sm" className="self-start">
          <Link
            to={`/characters/new?${new URLSearchParams({
              campaign: campaign.id,
              returnTo: `/campaigns/${campaign.id}`,
              ...(onlySystem ? { system: onlySystem } : {}),
            })}`}
          >
            <PlusIcon /> {t("createWith")}
          </Link>
        </Button>
      )}

      {isGm && (
        <>
          <Separator />
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium">{t("allowFromLibrary")}</p>
            {available.length === 0 ? (
              <p className="text-muted-foreground text-xs">
                {library.length === 0 ? t("libraryEmpty") : t("allAllowed")}
                <Link to="/packs" className="underline underline-offset-4">
                  {t("manage")}
                </Link>
              </p>
            ) : (
              <ul className="flex flex-col gap-1">
                {available.map((pack) => {
                  const clash = activeIds.has(pack.packId);
                  return (
                    <li key={pack.id} className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="min-w-0 flex-1">
                        {packName(pack)} <PackLanguageBadge pack={pack.pack} />{" "}
                        <span className="text-muted-foreground text-xs">
                          {packByline(
                            pack.pack,
                            pack.ownerId === me.uid
                              ? t("yours")
                              : t("byOwner", {
                                  name: nameOf(owners, pack.ownerId, pack.ownerName),
                                }),
                          )}{" "}
                          · {packSummary(pack.pack)}
                        </span>
                        {clash && (
                          <span className="text-muted-foreground block text-xs">
                            {t("clash", { id: pack.packId })}
                          </span>
                        )}
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={clash}
                        onClick={() => activate(pack, "activated")}
                      >
                        {t("allow")}
                      </Button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </>
      )}
    </CampaignCard>
  );
}
