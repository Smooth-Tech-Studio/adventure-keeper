import { useState } from "react";
import { QuoteIcon } from "lucide-react";
import { toast } from "sonner";
import type { LiveSession } from "@adventure-keeper/schemas";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import { addQuote } from "@/lib/session-memory";
import type { WithId } from "@/lib/collections";

/**
 * Pin a line the table wants to remember. Anyone in the session can; the
 * quotes come back in the chronicle.
 */
export function QuoteButton({
  session,
  speakers,
}: {
  session: WithId<LiveSession>;
  /** Names offered for « qui l'a dit » (the characters at the table). */
  speakers: string[];
}) {
  const { t } = useTranslation(["session", "common"]);
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [speaker, setSpeaker] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!user || !text.trim()) return;
    setBusy(true);
    try {
      await addQuote(
        session.campaignId,
        session.adventureId,
        session.id,
        { text, speaker },
        user.uid,
      );
      toast.success(t("quotes.pinned"));
      setText("");
      setSpeaker("");
      setOpen(false);
    } catch (error) {
      console.error(error);
      toast.error(t("common:saveFailed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="bg-background/90 size-8 rounded-full shadow-sm backdrop-blur"
        aria-label={t("quotes.pin")}
        title={t("quotes.pin")}
        onClick={() => setOpen(true)}
      >
        <QuoteIcon className="size-4" />
      </Button>
      <Dialog open={open} onOpenChange={(o) => !busy && setOpen(o)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("quotes.pin")}</DialogTitle>
            <DialogDescription>{t("quotes.hint")}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1">
              <Label htmlFor="quote-text" className="text-xs">
                {t("quotes.text")}
              </Label>
              <Textarea
                id="quote-text"
                rows={3}
                maxLength={500}
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
            </div>
            <div className="grid gap-1">
              <Label htmlFor="quote-speaker" className="text-xs">
                {t("quotes.speaker")}
              </Label>
              <Input
                id="quote-speaker"
                list="quote-speakers"
                maxLength={120}
                value={speaker}
                onChange={(e) => setSpeaker(e.target.value)}
              />
              <datalist id="quote-speakers">
                {speakers.map((name) => (
                  <option key={name} value={name} />
                ))}
              </datalist>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              {t("common:actions.cancel")}
            </Button>
            <Button type="button" onClick={submit} disabled={busy || !text.trim()}>
              {t("quotes.submit")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** The in-game date, next to the clock — when the GM set one. */
export function GameDatePill({ value }: { value: string | undefined }) {
  if (!value) return null;
  return (
    <div className="bg-background/90 flex items-center rounded-full border px-3 py-1 text-sm shadow-sm backdrop-blur">
      {value}
    </div>
  );
}
