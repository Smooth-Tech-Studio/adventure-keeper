import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ExternalLinkIcon } from "lucide-react";
import type { CodexEntry, ShownDocument } from "@adventure-keeper/schemas";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Markdown } from "@/components/ui/markdown";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { codexPath } from "@/hooks/use-codex";
import { useMediaQuery } from "@/hooks/use-media-query";
import type { WithId } from "@/lib/collections";

interface Props {
  campaignId: string;
  /** The handout to open; `null` keeps the dialog closed. */
  document: ShownDocument | null;
  /** Its codex entry, when this reader may see it (for the text the GM wrote). */
  entry?: WithId<CodexEntry>;
  onClose: () => void;
}

/**
 * A handout shown during a session, opened in place from the chronicle: where
 * it was found, the image or link as it was shown, the text of its codex entry
 * on a sheet of paper, and a secondary link to the entry itself. A centred
 * dialog on a computer, a panel rising from the bottom on a phone.
 */
export function ShownDocumentDialog({ campaignId, document, entry, onClose }: Props) {
  const { t } = useTranslation("codex");
  const wide = useMediaQuery("(min-width: 768px)");
  const imageUrl = document?.imageUrl ?? entry?.imageUrl;
  const url = document?.url ?? entry?.url;
  const summary = entry?.summary.trim();
  const open = document !== null;
  const onOpenChange = (next: boolean) => !next && onClose();

  const eyebrow = (
    <p className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
      {t("handout.title")}
    </p>
  );
  const found = document?.foundAt ? t("handout.foundAt", { place: document.foundAt }) : "";
  const body: ReactNode = (
    <>
      {imageUrl && (
        <img
          src={imageUrl}
          alt={document?.name ?? ""}
          className="max-h-[50vh] max-w-full justify-self-center rounded-md border"
        />
      )}
      {summary && (
        // The document itself, as a sheet of paper in the theme's colours.
        <div className="bg-secondary text-secondary-foreground rounded-lg border p-4 shadow-inner sm:p-5">
          <Markdown>{summary}</Markdown>
        </div>
      )}
      {url && (
        <a
          href={url}
          target="_blank"
          rel="noreferrer noopener"
          className="text-primary inline-flex items-center gap-1 text-sm hover:underline"
        >
          <ExternalLinkIcon className="size-4" /> {t("entry.openDocument")}
        </a>
      )}
    </>
  );
  // The codex link on the left, « Fermer » on the right — on one line, phone included.
  const footer = (
    <>
      {document ? (
        <Button asChild variant="ghost" size="sm">
          <Link to={codexPath(campaignId, document.entryId)}>
            <ExternalLinkIcon /> {t("handout.inCodex")}
          </Link>
        </Button>
      ) : (
        <span />
      )}
      <Button type="button" onClick={onClose}>
        {t("handout.close")}
      </Button>
    </>
  );

  if (!wide) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent>
          <SheetHeader>
            {eyebrow}
            <SheetTitle>{document?.name}</SheetTitle>
            <SheetDescription className={found ? undefined : "sr-only"}>
              {found || t("handout.title")}
            </SheetDescription>
          </SheetHeader>
          <SheetBody className="gap-4">{body}</SheetBody>
          <SheetFooter>{footer}</SheetFooter>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          {eyebrow}
          <DialogTitle>{document?.name}</DialogTitle>
          <DialogDescription className={found ? undefined : "sr-only"}>
            {found || t("handout.title")}
          </DialogDescription>
        </DialogHeader>
        {body}
        <div className="flex items-center justify-between gap-2">{footer}</div>
      </DialogContent>
    </Dialog>
  );
}
