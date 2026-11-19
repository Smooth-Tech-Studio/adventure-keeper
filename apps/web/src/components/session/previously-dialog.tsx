import { useEffect, useState } from "react";
import { sessionNumbers, type LiveSession } from "@adventure-keeper/schemas";
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
import { Markdown } from "@/components/ui/markdown";
import { toMillis } from "@/lib/firestore";
import type { WithId } from "@/lib/collections";
import { listEndedSessions } from "@/lib/sessions";

const seenKey = (sessionId: string) => `ak:previously:${sessionId}`;

function alreadyShown(sessionId: string): boolean {
  try {
    return localStorage.getItem(seenKey(sessionId)) === "1";
  } catch {
    return false;
  }
}

function markShown(sessionId: string): void {
  try {
    localStorage.setItem(seenKey(sessionId), "1");
  } catch {
    // Storage unavailable: it will just show again next time.
  }
}

/**
 * « Précédemment… » — on opening a live session, the last published recap,
 * once per session and device. The GM can read it aloud to the table.
 */
export function PreviouslyDialog({
  campaignId,
  adventureId,
  sessionId,
}: {
  campaignId: string;
  adventureId: string;
  sessionId: string;
}) {
  const { t } = useTranslation("session", { keyPrefix: "previously" });
  const [previous, setPrevious] = useState<{ session: WithId<LiveSession>; number: number } | null>(
    null,
  );
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (alreadyShown(sessionId)) return;
    let cancelled = false;
    listEndedSessions(campaignId, adventureId)
      .then((ended) => {
        // Newest first: the latest session that has a published recap.
        const last = ended.find((s) => s.id !== sessionId && s.recap);
        if (cancelled || !last) return;
        const numbers = sessionNumbers(ended, toMillis);
        setPrevious({ session: last, number: numbers.get(last.id) ?? 1 });
        setOpen(true);
        markShown(sessionId);
      })
      .catch((error) => console.error(error));
    return () => {
      cancelled = true;
    };
  }, [campaignId, adventureId, sessionId]);

  if (!previous) return null;
  const { session, number } = previous;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>
            {session.title
              ? t("subtitleTitled", { number, title: session.title })
              : t("subtitle", { number })}
          </DialogDescription>
        </DialogHeader>
        <Markdown>{session.recap ?? ""}</Markdown>
        <DialogFooter>
          <Button type="button" onClick={() => setOpen(false)}>
            {t("start")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
