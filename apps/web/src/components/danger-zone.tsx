import { useState, type ReactNode } from "react";
import { TriangleAlertIcon } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export interface DangerAction {
  /** Button label, and the dialog title unless `confirmTitle` is set. */
  label: string;
  /** One line next to the button explaining what it does. */
  description?: string;
  /** Dialog title; defaults to `label`. */
  confirmTitle?: string;
  /** Dialog body — spell out exactly what is lost. */
  confirmDescription: ReactNode;
  /** Confirm button label; defaults to "Supprimer définitivement". */
  confirmLabel?: string;
  /** Greys the button out; `disabledReason` replaces `description`. */
  disabled?: boolean;
  disabledReason?: string;
  onConfirm: () => Promise<void> | void;
}

interface Props {
  title?: string;
  actions: DangerAction[];
  className?: string;
}

/** A destructive-actions card with a confirmation dialog per action. */
export function DangerZone({ title, actions, className }: Props) {
  const { t } = useTranslation();
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  async function confirm(action: DangerAction) {
    setBusy(true);
    try {
      await action.onConfirm();
      setOpenIndex(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className={cn("border-destructive/40", className)}>
      <CardHeader>
        <CardTitle className="text-destructive flex items-center gap-2">
          <TriangleAlertIcon className="size-4" /> {title ?? t("dangerZone.title")}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {actions.map((action, index) => (
          <div
            key={action.label}
            className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
          >
            <p className="text-muted-foreground text-sm">
              {action.disabled && action.disabledReason
                ? action.disabledReason
                : action.description}
            </p>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              className="shrink-0 self-start sm:self-auto"
              disabled={action.disabled || busy}
              onClick={() => setOpenIndex(index)}
            >
              {action.label}
            </Button>
          </div>
        ))}
      </CardContent>

      {actions.map((action, index) => (
        <Dialog
          key={action.label}
          open={openIndex === index}
          onOpenChange={(open) => !open && setOpenIndex(null)}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <TriangleAlertIcon className="text-destructive size-5" />
                {action.confirmTitle ?? action.label}
              </DialogTitle>
              <DialogDescription>{action.confirmDescription}</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                disabled={busy}
                onClick={() => setOpenIndex(null)}
              >
                Annuler
              </Button>
              <Button
                type="button"
                variant="destructive"
                disabled={busy}
                onClick={() => confirm(action)}
              >
                {action.confirmLabel ?? t("dangerZone.confirm")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ))}
    </Card>
  );
}
