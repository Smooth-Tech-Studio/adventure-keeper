import { useEffect, useState } from "react";
import { EyeIcon, PencilIcon, SparklesIcon } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import type { LiveSession, QuickNote } from "@adventure-keeper/schemas";

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
import { Markdown } from "@/components/ui/markdown";
import { Textarea } from "@/components/ui/textarea";
import type { WithId } from "@/lib/collections";
import {
  getSessionGm,
  publishSessionRecap,
  saveSessionDraft,
  unpublishSessionRecap,
  type RecapDraft,
} from "@/lib/sessions";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaignId: string;
  adventureId: string;
  session: WithId<LiveSession>;
  number: number;
  /** Markdown skeleton built from what the app knows of the session. */
  skeleton: () => string;
  onChange: () => void | Promise<void>;
}

const EMPTY: RecapDraft = { title: "", recap: "", gmNotes: "" };

/**
 * The GM writes a session's recap here: a draft only they read, published to
 * the players on demand. Their private notes ("what they did not see") stay in
 * the draft doc.
 */
export function RecapEditorDialog({
  open,
  onOpenChange,
  campaignId,
  adventureId,
  session,
  number,
  skeleton,
  onChange,
}: Props) {
  const { t } = useTranslation(["adventures", "common"]);
  const [draft, setDraft] = useState<RecapDraft | null>(null);
  const [quickNotes, setQuickNotes] = useState<QuickNote[]>([]);
  const [preview, setPreview] = useState(false);
  const [busy, setBusy] = useState(false);
  const published = Boolean(session.recap);

  // Load the draft each time the dialog opens. A recap published before
  // drafts existed seeds it.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setDraft(null);
    setPreview(false);
    getSessionGm(campaignId, adventureId, session.id)
      .catch(() => null)
      .then((gm) => {
        if (cancelled) return;
        setDraft({
          title: gm?.titleDraft ?? session.title ?? "",
          recap: gm?.recapDraft ?? session.recap ?? "",
          gmNotes: gm?.gmNotes ?? "",
        });
        setQuickNotes(gm?.quickNotes ?? []);
      });
    return () => {
      cancelled = true;
    };
  }, [open, campaignId, adventureId, session.id, session.title, session.recap]);

  const set = (patch: Partial<RecapDraft>) => setDraft((d) => ({ ...(d ?? EMPTY), ...patch }));

  async function act(action: () => Promise<void>, success: string, close = true) {
    setBusy(true);
    try {
      await action();
      await onChange();
      toast.success(success);
      if (close) onOpenChange(false);
    } catch (error) {
      console.error(error);
      toast.error(t("common:saveFailed"));
    } finally {
      setBusy(false);
    }
  }

  function prefill() {
    const text = skeleton();
    set({ recap: draft?.recap.trim() ? `${draft.recap.trimEnd()}\n\n${text}` : text });
    setPreview(false);
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("recap.dialogTitle", { number })}</DialogTitle>
          <DialogDescription>
            {published ? t("recap.publishedHint") : t("recap.draftHint")}
          </DialogDescription>
        </DialogHeader>

        {draft === null ? (
          <p className="text-muted-foreground text-sm">{t("common:actions.loading")}</p>
        ) : (
          <div className="grid gap-4">
            <div className="grid gap-1">
              <Label htmlFor="recap-title" className="text-xs">
                {t("recap.title")}
              </Label>
              <Input
                id="recap-title"
                placeholder={t("recap.titlePlaceholder")}
                value={draft.title}
                maxLength={160}
                onChange={(e) => set({ title: e.target.value })}
              />
            </div>

            <div className="grid gap-1">
              <div className="flex flex-wrap items-center gap-1">
                <Label htmlFor="recap-body" className="mr-auto text-xs">
                  {t("recap.body")}
                </Label>
                <Button type="button" variant="ghost" size="sm" onClick={prefill}>
                  <SparklesIcon /> {t("recap.prefill")}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-pressed={preview}
                  onClick={() => setPreview((v) => !v)}
                >
                  {preview ? <PencilIcon /> : <EyeIcon />}
                  {preview ? t("recap.write") : t("recap.preview")}
                </Button>
              </div>
              {preview ? (
                <div className="bg-muted/30 min-h-40 rounded-md border p-3">
                  {draft.recap.trim() ? (
                    <Markdown>{draft.recap}</Markdown>
                  ) : (
                    <p className="text-muted-foreground text-sm">{t("recap.emptyPreview")}</p>
                  )}
                </div>
              ) : (
                <Textarea
                  id="recap-body"
                  rows={10}
                  className="min-h-40"
                  placeholder={t("recap.bodyPlaceholder")}
                  value={draft.recap}
                  maxLength={20000}
                  onChange={(e) => set({ recap: e.target.value })}
                />
              )}
              <p className="text-muted-foreground text-xs">{t("recap.markdownHint")}</p>
            </div>

            {quickNotes.length > 0 && (
              <div className="grid gap-1 rounded-md border border-dashed p-2">
                <p className="text-muted-foreground text-xs font-medium">{t("recap.quickNotes")}</p>
                <ul className="flex flex-col gap-1 text-sm">
                  {quickNotes.map((note) => (
                    <li key={note.at} className="flex items-center gap-2">
                      <span className="min-w-0 flex-1">{note.text}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 shrink-0"
                        onClick={() =>
                          set({
                            recap: draft.recap.trim()
                              ? `${draft.recap.trimEnd()}\n- ${note.text}`
                              : `- ${note.text}`,
                          })
                        }
                      >
                        {t("recap.insertNote")}
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="grid gap-1">
              <Label htmlFor="recap-gm-notes" className="text-xs">
                {t("recap.gmNotes")}
              </Label>
              <Textarea
                id="recap-gm-notes"
                rows={3}
                placeholder={t("recap.gmNotesPlaceholder")}
                value={draft.gmNotes}
                maxLength={20000}
                onChange={(e) => set({ gmNotes: e.target.value })}
              />
              <p className="text-muted-foreground text-xs">{t("recap.gmNotesHint")}</p>
            </div>
          </div>
        )}

        <DialogFooter className="flex-wrap gap-2">
          {published && (
            <Button
              type="button"
              variant="ghost"
              className="sm:mr-auto"
              disabled={busy}
              onClick={() =>
                act(
                  () => unpublishSessionRecap(campaignId, adventureId, session.id),
                  t("recap.unpublished"),
                )
              }
            >
              {t("recap.unpublish")}
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            disabled={busy || draft === null}
            onClick={() =>
              act(
                () => saveSessionDraft(campaignId, adventureId, session.id, draft ?? EMPTY),
                t("recap.draftSaved"),
              )
            }
          >
            {t("recap.saveDraft")}
          </Button>
          <Button
            type="button"
            disabled={busy || !draft?.recap.trim()}
            onClick={() =>
              act(
                () => publishSessionRecap(campaignId, adventureId, session.id, draft ?? EMPTY),
                published ? t("recap.updated") : t("recap.published"),
              )
            }
          >
            {published ? t("recap.update") : t("recap.publish")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
