import { useState, type ReactNode } from "react";
import { TriangleAlertIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  /** Confirm button label. Default: "Supprimer". */
  confirmLabel?: string;
  /** `destructive` (default) or `default`. */
  variant?: "destructive" | "default";
  onConfirm: () => Promise<void> | void;
}

/**
 * A yes/no confirmation dialog. Mirrors the confirm flow of
 * {@link import("@/components/danger-zone").DangerZone} but standalone, for
 * per-row destructive actions (delete a location / enemy / NPC…).
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Supprimer",
  variant = "destructive",
  onConfirm,
}: Props) {
  const [busy, setBusy] = useState(false);

  async function confirm() {
    setBusy(true);
    try {
      await onConfirm();
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {variant === "destructive" && <TriangleAlertIcon className="text-destructive size-5" />}
            {title}
          </DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="ghost" disabled={busy} onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button type="button" variant={variant} disabled={busy} onClick={confirm}>
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
