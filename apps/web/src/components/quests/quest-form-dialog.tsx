import { useState } from "react";
import { toast } from "sonner";
import { QUEST_STATUSES, type QuestStatus } from "@adventure-keeper/schemas";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { QuestInput } from "@/lib/quests";

/**
 * A quest's title, summary and status. For the GM, `revealed` shows it to the
 * players; for a player writing their own, it shares it with the party (the
 * GM sees it either way).
 */
export function QuestFormDialog({
  open,
  onOpenChange,
  initial,
  editing,
  onSave,
  audience = "gm",
  sharing = true,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial: QuestInput;
  editing: boolean;
  onSave: (values: QuestInput) => Promise<void>;
  audience?: "gm" | "player";
  /** `false`: the reveal / share box is not this reader's to tick. */
  sharing?: boolean;
}) {
  const { t } = useTranslation(["quests", "common"]);
  const [form, setForm] = useState(initial);
  const [busy, setBusy] = useState(false);
  // Refill when the dialog opens, not on every parent render.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setForm(initial);
  }
  const set = (patch: Partial<QuestInput>) => setForm((f) => ({ ...f, ...patch }));

  async function submit() {
    if (!form.title.trim()) {
      toast.error(t("form.titleRequired"));
      return;
    }
    setBusy(true);
    try {
      await onSave(form);
      onOpenChange(false);
    } catch (error) {
      console.error(error);
      toast.error(t("common:saveFailed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? t("form.editTitle") : t("form.newTitle")}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1">
            <Label htmlFor="quest-title" className="text-xs">
              {t("form.title")}
            </Label>
            <Input
              id="quest-title"
              autoFocus
              maxLength={160}
              value={form.title}
              onChange={(e) => set({ title: e.target.value })}
            />
          </div>
          <div className="grid gap-1">
            <Label htmlFor="quest-summary" className="text-xs">
              {t("form.summary")}
            </Label>
            <Textarea
              id="quest-summary"
              rows={4}
              maxLength={5000}
              placeholder={t("form.summaryPlaceholder")}
              value={form.summary}
              onChange={(e) => set({ summary: e.target.value })}
            />
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <div className="grid gap-1">
              <Label className="text-xs">{t("form.status")}</Label>
              <Select value={form.status} onValueChange={(v) => set({ status: v as QuestStatus })}>
                <SelectTrigger className="w-44" aria-label={t("form.status")}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {QUEST_STATUSES.map((status) => (
                    <SelectItem key={status} value={status}>
                      {t(`statuses.${status}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {sharing && (
              <label className="mt-5 flex items-center gap-2 text-sm">
                <Checkbox
                  checked={form.revealed}
                  onCheckedChange={(checked) => set({ revealed: checked === true })}
                />
                {audience === "gm" ? t("form.revealed") : t("form.shared")}
              </label>
            )}
          </div>
          {audience === "player" && sharing && (
            <p className="text-muted-foreground text-xs">{t("form.sharedHint")}</p>
          )}
        </div>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            {t("common:actions.cancel")}
          </Button>
          <Button type="button" onClick={submit} disabled={busy}>
            {t("common:actions.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
