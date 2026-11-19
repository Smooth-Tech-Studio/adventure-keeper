import { useState } from "react";
import { ExternalLinkIcon } from "lucide-react";
import type { ShownDocument } from "@adventure-keeper/schemas";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/** A handout in a dialog: the image (or a link to the document) fills it. */
export function HandoutView({
  shown,
  open,
  onOpenChange,
}: {
  shown: ShownDocument | undefined;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation("codex", { keyPrefix: "handout" });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[95vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>{shown?.name}</DialogTitle>
          <DialogDescription>{t("title")}</DialogDescription>
        </DialogHeader>
        {shown?.imageUrl && (
          <img
            src={shown.imageUrl}
            alt={shown.name}
            className="max-h-[75vh] max-w-full self-center rounded-md border"
          />
        )}
        <DialogFooter>
          {shown?.url && (
            <Button asChild variant="outline">
              <a href={shown.url} target="_blank" rel="noreferrer noopener">
                <ExternalLinkIcon /> {t("open")}
              </a>
            </Button>
          )}
          <Button type="button" onClick={() => onOpenChange(false)}>
            {t("close")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * A player's screen when the GM shows a handout: it opens by itself. Closing
 * it only closes it here; showing another one opens it again.
 */
export function HandoutDialog({ shown }: { shown: ShownDocument | undefined }) {
  const [closedId, setClosedId] = useState<string | null>(null);
  const [lastId, setLastId] = useState<string | undefined>(shown?.entryId);
  // A new handout (or the same one shown again after a pause) reopens.
  if (shown?.entryId !== lastId) {
    setLastId(shown?.entryId);
    setClosedId(null);
  }
  const open = Boolean(shown) && closedId !== shown?.entryId;
  return (
    <HandoutView
      shown={shown}
      open={open}
      onOpenChange={(o) => !o && shown && setClosedId(shown.entryId)}
    />
  );
}
