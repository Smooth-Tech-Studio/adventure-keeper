import { useState, type ReactNode } from "react";
import { DownloadIcon, EllipsisVerticalIcon, PencilIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import { GAME_SYSTEM_LABELS, campaignFileToJson, type Campaign } from "@adventure-keeper/schemas";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { RenameCampaignDialog } from "@/components/campaign/rename-campaign-dialog";
import { downloadJsonFile, exportCampaignFile } from "@/lib/campaign-file";
import type { WithId } from "@/lib/collections";
import { getSystem } from "@/systems";

/**
 * The campaign's name, what it plays and who runs it, its pitch — and, for the
 * GM, a ⋮ menu: rename, export, delete.
 */
export function CampaignHeader({
  campaign,
  isGm,
  gmName,
  live,
  onRename,
  onDelete,
  children,
}: {
  campaign: WithId<Campaign>;
  isGm: boolean;
  /** Said to players: « MJ : Rémi ». */
  gmName?: string;
  /** A session is running: the campaign cannot be deleted. */
  live: boolean;
  onRename: (name: string) => Promise<void>;
  onDelete: () => Promise<void>;
  /** Under the pitch (the live bar, on a phone). */
  children?: ReactNode;
}) {
  const { t } = useTranslation(["campaigns", "common"]);
  const [renaming, setRenaming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function exportFile() {
    try {
      downloadJsonFile(campaign.name, campaignFileToJson(await exportCampaignFile(campaign.id)));
    } catch (error) {
      console.error(error);
      toast.error(t("export.failed"));
    }
  }

  return (
    <header>
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold tracking-tight lg:text-[1.75rem]">{campaign.name}</h1>
          <p className="text-muted-foreground text-sm">
            {campaign.systemLabel ?? GAME_SYSTEM_LABELS[campaign.system] ?? campaign.system}
            {t("detail.sheets", { system: getSystem(campaign.characterSystem).label })}
            {isGm ? t("detail.youAreGm") : gmName ? t("detail.gmIs", { name: gmName }) : ""}
          </p>
        </div>
        {isGm && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="shrink-0"
                aria-label={t("detail.menu")}
              >
                <EllipsisVerticalIcon />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => setRenaming(true)}>
                <PencilIcon /> {t("rename.button")}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={exportFile}>
                <DownloadIcon /> {t("export.campaign")}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                disabled={live}
                onSelect={() => setDeleting(true)}
              >
                <Trash2Icon /> {t("detail.delete")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
      {campaign.description && (
        <p className="text-muted-foreground mt-2 max-w-prose text-sm">{campaign.description}</p>
      )}
      {children}
      {isGm && (
        <>
          {/* Remounted on opening: the field starts from the name stored. */}
          <RenameCampaignDialog
            key={renaming ? "open" : "closed"}
            open={renaming}
            onOpenChange={setRenaming}
            currentName={campaign.name}
            onRename={onRename}
          />
          <ConfirmDialog
            open={deleting}
            onOpenChange={setDeleting}
            title={t("detail.deleteConfirmTitle", { name: campaign.name })}
            description={t("detail.deleteConfirm")}
            confirmLabel={t("common:dangerZone.confirm")}
            onConfirm={onDelete}
          />
        </>
      )}
    </header>
  );
}
