import { useState, type ReactNode } from "react";
import { PencilIcon, Trash2Icon } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

interface Props {
  /** Primary label. */
  name: ReactNode;
  /** Compact read-only chips shown after the name. */
  badges?: ReactNode[];
  /** Extra content under the name (kept short — "informations limitées"). */
  detail?: ReactNode;
  onEdit: () => void;
  onDelete: () => void | Promise<void>;
  /** Word for the thing being removed, translated: « le lieu », "the enemy". */
  deleteLabel: string;
  /** Extra buttons before the pencil (e.g. « Ajouter au codex »). */
  extra?: ReactNode;
}

/**
 * One row of an adventure sub-entity list (location / enemy / NPC). Shared by
 * the creation form and the adventure detail cards so both look and behave the
 * same: a pencil that reopens the editor dialog and a trash that confirms.
 */
export function EntityRow({
  name,
  badges = [],
  detail,
  onEdit,
  onDelete,
  deleteLabel,
  extra,
}: Props) {
  const { t } = useTranslation();
  const [confirming, setConfirming] = useState(false);

  return (
    <div className="bg-muted/30 flex flex-wrap items-center gap-2 rounded-md border p-2 text-sm">
      <span className="min-w-0 flex-1 font-medium">{name}</span>
      {badges.map((badge, index) => (
        <Badge key={index} variant="outline" className="shrink-0 gap-1 font-normal">
          {badge}
        </Badge>
      ))}
      {extra}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-8 shrink-0"
        aria-label={t("actions.edit")}
        onClick={onEdit}
      >
        <PencilIcon className="size-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="text-destructive hover:text-destructive hover:bg-destructive/10 size-8 shrink-0"
        aria-label={t("actions.delete")}
        onClick={() => setConfirming(true)}
      >
        <Trash2Icon className="size-4" />
      </Button>
      {detail && <div className="text-muted-foreground w-full text-xs">{detail}</div>}

      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={t("entityRow.confirmTitle", { what: deleteLabel })}
        description={t("entityRow.confirmText")}
        onConfirm={onDelete}
      />
    </div>
  );
}
