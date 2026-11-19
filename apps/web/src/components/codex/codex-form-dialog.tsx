import { useState } from "react";
import { toast } from "sonner";
import { CODEX_KINDS, type CodexKind } from "@adventure-keeper/schemas";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
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
import type { CodexInput } from "@/lib/codex";

function validUrl(value: string): boolean {
  if (!value.trim()) return true;
  try {
    return ["http:", "https:"].includes(new URL(value.trim()).protocol);
  } catch {
    return false;
  }
}

/** GM: create or edit a codex entry — what players learn, and the GM's secret. */
export function CodexFormDialog({
  open,
  onOpenChange,
  initial,
  editing,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial: CodexInput;
  editing: boolean;
  onSave: (values: CodexInput) => Promise<void>;
}) {
  const { t } = useTranslation(["codex", "common"]);
  const [form, setForm] = useState(initial);
  const [busy, setBusy] = useState(false);
  // Refill when the dialog opens, not on every parent render.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setForm(initial);
  }
  const set = (patch: Partial<CodexInput>) => setForm((f) => ({ ...f, ...patch }));

  async function submit() {
    if (!form.name.trim()) {
      toast.error(t("form.nameRequired"));
      return;
    }
    if (!validUrl(form.imageUrl) || !validUrl(form.url)) {
      toast.error(t("form.invalidUrl"));
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
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{editing ? t("form.editTitle") : t("form.newTitle")}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-3 sm:grid-cols-[1fr_12rem]">
            <div className="grid gap-1">
              <Label htmlFor="codex-name" className="text-xs">
                {t("form.name")}
              </Label>
              <Input
                id="codex-name"
                autoFocus
                maxLength={160}
                value={form.name}
                onChange={(e) => set({ name: e.target.value })}
              />
            </div>
            <div className="grid gap-1">
              <Label className="text-xs">{t("form.kind")}</Label>
              <Select value={form.kind} onValueChange={(kind) => set({ kind: kind as CodexKind })}>
                <SelectTrigger aria-label={t("form.kind")}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CODEX_KINDS.map((kind) => (
                    <SelectItem key={kind} value={kind}>
                      {t(`kinds.${kind}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-1">
            <Label htmlFor="codex-summary" className="text-xs">
              {t("form.summary")}
            </Label>
            <Textarea
              id="codex-summary"
              rows={5}
              maxLength={20000}
              placeholder={t("form.summaryPlaceholder")}
              value={form.summary}
              onChange={(e) => set({ summary: e.target.value })}
            />
            <p className="text-muted-foreground text-xs">{t("form.summaryHint")}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1">
              <Label htmlFor="codex-image" className="text-xs">
                {t("form.imageUrl")}
              </Label>
              <Input
                id="codex-image"
                type="url"
                placeholder="https://…"
                value={form.imageUrl}
                onChange={(e) => set({ imageUrl: e.target.value })}
              />
            </div>
            <div className="grid gap-1">
              <Label htmlFor="codex-url" className="text-xs">
                {t("form.url")}
              </Label>
              <Input
                id="codex-url"
                type="url"
                placeholder="https://…"
                value={form.url}
                onChange={(e) => set({ url: e.target.value })}
              />
            </div>
          </div>
          <div className="grid gap-1">
            <Label htmlFor="codex-secret" className="text-xs">
              {t("form.secret")}
            </Label>
            <Textarea
              id="codex-secret"
              rows={3}
              maxLength={20000}
              placeholder={t("form.secretPlaceholder")}
              value={form.secret}
              onChange={(e) => set({ secret: e.target.value })}
            />
            <p className="text-muted-foreground text-xs">{t("form.secretHint")}</p>
          </div>
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
