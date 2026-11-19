import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { DownloadIcon } from "lucide-react";
import type { ContentPackDoc } from "@adventure-keeper/schemas";
import { contentPackToJson, packText } from "@adventure-keeper/system-dnd2024";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { PageContainer } from "@/components/page-container";
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { DetailSkeleton } from "@/components/ui/page-loading";
import { PackContents } from "@/systems/dnd2024/packs/components/pack-contents";
import { useAuth } from "@/hooks/use-auth";
import { useBreadcrumbs } from "@/hooks/use-breadcrumbs";
import { useLicenceNotice } from "@/hooks/use-licence-notice";
import type { WithId } from "@/lib/collections";
import { downloadTextFile } from "@/lib/download";
import {
  packByline,
  packLanguageNames,
  packName,
  packSummary,
} from "@/systems/dnd2024/lib/pack-labels";
import { PackLanguageBadge } from "@/systems/dnd2024/packs/components/pack-language-badge";
import { addSharedPackToLibrary, getPack, packFileName } from "@/systems/dnd2024/lib/packs";
import { nameOf, useUserProfiles } from "@/hooks/use-user-profiles";

/**
 * `/packs/:packDocId` — a pack's own page, opened from the library: what it
 * holds, entry by entry. Also where a share link lands
 * (`/packs/shared/:packDocId`, kept for the links already sent), with a
 * button to add the pack to one's library.
 */
export function PackPage() {
  const { t } = useTranslation("packs");
  const { packDocId } = useParams<{ packDocId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [pack, setPack] = useState<WithId<ContentPackDoc> | null | "missing">(null);
  const [busy, setBusy] = useState(false);
  const owners = useUserProfiles([pack && pack !== "missing" ? pack.ownerId : undefined]);
  // Packs extend the 5E base content and list it alongside.
  useLicenceNotice("srd521");
  useBreadcrumbs([
    { label: t("page.crumb"), to: "/packs" },
    { label: pack === "missing" ? t("page.notFound") : pack ? packName(pack) : undefined },
  ]);

  useEffect(() => {
    if (!packDocId) return;
    let cancelled = false;
    getPack(packDocId)
      .then((found) => !cancelled && setPack(found ?? "missing"))
      .catch(() => !cancelled && setPack("missing"));
    return () => {
      cancelled = true;
    };
  }, [packDocId]);

  if (!user || pack === null) {
    return (
      <PageContainer>
        <DetailSkeleton />
      </PageContainer>
    );
  }

  if (pack === "missing") {
    return (
      <PageContainer size="narrow">
        <Card>
          <CardHeader>
            <CardTitle>{t("page.missing")}</CardTitle>
            <CardDescription>{t("page.missingHint")}</CardDescription>
          </CardHeader>
        </Card>
      </PageContainer>
    );
  }

  const owned = pack.ownerId === user.uid;
  const inLibrary = owned || pack.sharedWith.includes(user.uid);

  async function add() {
    if (!user || pack === null || pack === "missing") return;
    setBusy(true);
    try {
      await addSharedPackToLibrary(pack.id, user.uid);
      toast.success(t("page.added", { name: packName(pack) }));
      navigate("/packs");
    } catch (error) {
      console.error(error);
      toast.error(t("page.addFailed"));
      setBusy(false);
    }
  }

  return (
    <PageContainer className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardDescription>
            {packByline(
              pack.pack,
              owned
                ? t("list.yourPack")
                : t("list.sharedBy", { name: nameOf(owners, pack.ownerId, pack.ownerName) }),
            )}
          </CardDescription>
          <CardTitle className="flex flex-wrap items-center gap-2 text-2xl">
            {packName(pack)}
            <PackLanguageBadge pack={pack.pack} />
          </CardTitle>
          <CardDescription>
            {pack.packId} · v{pack.version} · {packSummary(pack.pack)} ·{" "}
            {packLanguageNames(pack.pack)}
          </CardDescription>
        </CardHeader>
        {pack.pack.description && (
          <p className="px-6 text-sm whitespace-pre-line">{packText(pack.pack, "description")}</p>
        )}
        <CardFooter className="flex flex-wrap justify-end gap-2">
          {inLibrary && (
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                downloadTextFile(
                  packFileName(pack),
                  contentPackToJson(pack.pack),
                  "application/json",
                )
              }
            >
              <DownloadIcon /> {t("list.export")}
            </Button>
          )}
          {inLibrary ? (
            <Button asChild variant="secondary">
              <Link to="/packs">{owned ? t("page.myPacks") : t("page.inLibrary")}</Link>
            </Button>
          ) : (
            <Button type="button" onClick={add} disabled={busy}>
              {t("page.add")}
            </Button>
          )}
        </CardFooter>
      </Card>
      <PackContents pack={pack.pack} />
    </PageContainer>
  );
}
