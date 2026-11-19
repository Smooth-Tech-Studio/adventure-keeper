import { useState } from "react";
import { Link } from "react-router-dom";
import {
  BookOpenIcon,
  DownloadIcon,
  FileUpIcon,
  LogOutIcon,
  RefreshCwIcon,
  Share2Icon,
  Trash2Icon,
} from "lucide-react";
import { toast } from "sonner";
import type { ContentPackDoc } from "@adventure-keeper/schemas";
import { contentPackToJson } from "@adventure-keeper/system-dnd2024";
import { Trans, useTranslation } from "react-i18next";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageContainer } from "@/components/page-container";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ListSkeleton } from "@/components/ui/page-loading";
import { SharePackDialog } from "@/systems/dnd2024/packs/components/share-pack-dialog";
import { useAuth } from "@/hooks/use-auth";
import { useContentPacks } from "@/systems/dnd2024/hooks/use-content-packs";
import { useLicenceNotice } from "@/hooks/use-licence-notice";
import type { WithId } from "@/lib/collections";
import { downloadTextFile } from "@/lib/download";
import { packByline, packName, packSummary } from "@/systems/dnd2024/lib/pack-labels";
import {
  deletePack,
  importPack,
  leaveSharedPack,
  packFileName,
  replacePack,
} from "@/systems/dnd2024/lib/packs";
import { nameOf, useUserProfiles } from "@/hooks/use-user-profiles";
import { currentLanguage, tr } from "@/i18n";
import { PackLanguageBadge } from "@/systems/dnd2024/packs/components/pack-language-badge";
import { useFilePicker } from "@/hooks/use-file-picker";

/**
 * `/packs` — the player's content packs: import a pack file, export it,
 * replace it with a new version, share it, delete it; and the packs others
 * shared with them.
 */
export function PacksPage() {
  const { t } = useTranslation("packs", { keyPrefix: "list" });
  const { user } = useAuth();
  const { myPacks, sharedPacks, loaded } = useContentPacks();
  // Packs extend the 5E base content and list it alongside.
  useLicenceNotice("srd521");
  const [errors, setErrors] = useState<string[]>([]);
  const [conflict, setConflict] = useState<{ id: string; json: string } | null>(null);

  async function replace(docId: string, json: string) {
    const result = await replacePack(docId, json);
    if (result.ok) {
      setErrors([]);
      toast.success(t("replaced"));
    } else {
      setErrors(result.errors);
    }
  }

  const importer = useFilePicker(async (json) => {
    if (!user) return;
    try {
      const result = await importPack(json, user);
      if (result.ok) {
        setErrors([]);
        toast.success(t("imported"));
      } else if ("conflictId" in result) {
        setErrors([]);
        setConflict({ id: result.conflictId, json });
      } else {
        setErrors(result.errors);
      }
    } catch (error) {
      console.error(error);
      toast.error(t("importFailed"));
    }
  });

  return (
    <PageContainer className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-xl">
          <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
          <p className="text-muted-foreground text-sm">
            <Trans t={t} i18nKey="intro" components={{ code: <code /> }} />
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link to="/packs/format">
              <BookOpenIcon /> {t("create")}
            </Link>
          </Button>
          <Button type="button" onClick={importer.open}>
            <FileUpIcon /> {t("import")}
          </Button>
        </div>
        {importer.element}
      </div>

      {errors.length > 0 && (
        <div
          role="alert"
          className="border-destructive/50 bg-destructive/5 flex flex-col gap-2 rounded-md border p-4 text-sm"
        >
          <p className="font-medium">{t("importErrors")}</p>
          <ul className="list-disc space-y-1 pl-5">
            {errors.slice(0, 20).map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
          {errors.length > 20 && (
            <p className="text-muted-foreground">
              {t("moreErrors", { count: errors.length - 20 })}
            </p>
          )}
          <p className="text-muted-foreground">
            <Trans
              t={t}
              i18nKey="guideHint"
              components={{
                guide: <Link to="/packs/format" className="underline underline-offset-4" />,
              }}
            />
          </p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="self-start"
            onClick={() => setErrors([])}
          >
            {tr("common:actions.close")}
          </Button>
        </div>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">{t("mine")}</h2>
        {!loaded ? (
          <ListSkeleton />
        ) : myPacks.length === 0 ? (
          <p className="text-muted-foreground text-sm">{t("noneMine")}</p>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2 lg:items-start">
            {myPacks
              .slice()
              .sort((a, b) => packName(a).localeCompare(packName(b), currentLanguage()))
              .map((pack) => (
                <OwnPackCard key={pack.id} pack={pack} onErrors={setErrors} onReplace={replace} />
              ))}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">{t("shared")}</h2>
        {loaded && sharedPacks.length === 0 ? (
          <p className="text-muted-foreground text-sm">{t("noneShared")}</p>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2 lg:items-start">
            {sharedPacks
              .slice()
              .sort((a, b) => packName(a).localeCompare(packName(b), currentLanguage()))
              .map((pack) => (
                <SharedPackCard key={pack.id} pack={pack} uid={user?.uid ?? ""} />
              ))}
          </div>
        )}
      </section>

      <ConfirmDialog
        open={conflict !== null}
        onOpenChange={(open) => !open && setConflict(null)}
        title={t("conflictTitle")}
        description={t("conflictDescription")}
        confirmLabel={t("replace")}
        variant="default"
        onConfirm={async () => {
          if (conflict) await replace(conflict.id, conflict.json);
        }}
      />
    </PageContainer>
  );
}

function exportPack(pack: WithId<ContentPackDoc>) {
  downloadTextFile(packFileName(pack), contentPackToJson(pack.pack), "application/json");
}

function PackCardShell({
  pack,
  subtitle,
  badges,
  actions,
}: {
  pack: WithId<ContentPackDoc>;
  subtitle: string;
  badges?: React.ReactNode;
  actions: React.ReactNode;
}) {
  // The title link stretches over the whole card, so a click anywhere opens
  // the pack; the action buttons sit above it.
  return (
    <Card className="hover:bg-accent/40 relative transition-colors">
      <CardHeader className="gap-2">
        <div className="min-w-0">
          <CardTitle className="flex flex-wrap items-center gap-2">
            <Link
              to={`/packs/${pack.id}`}
              className="underline-offset-4 after:absolute after:inset-0 after:rounded-[inherit] hover:underline"
            >
              {packName(pack)}
            </Link>
            <span className="text-muted-foreground font-mono text-xs font-normal">
              {pack.packId} · v{pack.version}
            </span>
          </CardTitle>
          <CardDescription>{subtitle}</CardDescription>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="whitespace-normal">
            {packSummary(pack.pack)}
          </Badge>
          <PackLanguageBadge pack={pack.pack} />
          {badges}
        </div>
        <div className="relative z-10 -ml-2 flex flex-wrap gap-1">{actions}</div>
      </CardHeader>
    </Card>
  );
}

function OwnPackCard({
  pack,
  onErrors,
  onReplace,
}: {
  pack: WithId<ContentPackDoc>;
  onErrors: (errors: string[]) => void;
  onReplace: (docId: string, json: string) => Promise<void>;
}) {
  const { t } = useTranslation("packs", { keyPrefix: "list" });
  const [sharing, setSharing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const replacer = useFilePicker((json) => {
    onErrors([]);
    onReplace(pack.id, json).catch((error) => {
      console.error(error);
      toast.error(t("replaceFailed"));
    });
  });
  const shared = pack.sharedWith.length;

  return (
    <>
      <PackCardShell
        pack={pack}
        subtitle={packByline(pack.pack, t("yourPack"))}
        badges={
          (shared > 0 || pack.linkSharing) && (
            <Badge variant="outline">
              <Share2Icon />
              {[shared > 0 && t("people", { count: shared }), pack.linkSharing && t("linkActive")]
                .filter(Boolean)
                .join(" · ")}
            </Badge>
          )
        }
        actions={
          <>
            <Button type="button" variant="ghost" size="sm" onClick={() => setSharing(true)}>
              <Share2Icon /> {t("share")}
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => exportPack(pack)}>
              <DownloadIcon /> {t("export")}
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={replacer.open}>
              <RefreshCwIcon /> {t("replace")}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="text-destructive hover:text-destructive size-8"
              aria-label={t("deleteAria", { name: packName(pack) })}
              onClick={() => setDeleting(true)}
            >
              <Trash2Icon className="size-4" />
            </Button>
          </>
        }
      />
      {replacer.element}
      <SharePackDialog pack={pack} open={sharing} onOpenChange={setSharing} />
      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title={t("deleteTitle", { name: packName(pack) })}
        description={t("deleteDescription")}
        onConfirm={async () => {
          try {
            await deletePack(pack.id);
            toast.success(t("deleted"));
          } catch (error) {
            console.error(error);
            toast.error(t("deleteFailed"));
          }
        }}
      />
    </>
  );
}

function SharedPackCard({ pack, uid }: { pack: WithId<ContentPackDoc>; uid: string }) {
  const { t } = useTranslation("packs", { keyPrefix: "list" });
  const [leaving, setLeaving] = useState(false);
  const owners = useUserProfiles([pack.ownerId]);
  return (
    <>
      <PackCardShell
        pack={pack}
        subtitle={packByline(
          pack.pack,
          t("sharedBy", { name: nameOf(owners, pack.ownerId, pack.ownerName) }),
        )}
        actions={
          <>
            <Button type="button" variant="ghost" size="sm" onClick={() => exportPack(pack)}>
              <DownloadIcon /> {t("export")}
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setLeaving(true)}>
              <LogOutIcon /> {tr("common:actions.remove")}
            </Button>
          </>
        }
      />
      <ConfirmDialog
        open={leaving}
        onOpenChange={setLeaving}
        title={t("leaveTitle", { name: packName(pack) })}
        description={t("leaveDescription")}
        confirmLabel={tr("common:actions.remove")}
        onConfirm={async () => {
          try {
            await leaveSharedPack(pack.id, uid);
            toast.success(t("left"));
          } catch (error) {
            console.error(error);
            toast.error(t("leaveFailed"));
          }
        }}
      />
    </>
  );
}
