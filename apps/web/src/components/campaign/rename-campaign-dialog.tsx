import { useState } from "react";
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

/** Max length of a campaign name — mirrors `campaignSchema.name`. */
const MAX_NAME_LENGTH = 120;

interface Props {
  /** Opened from the campaign's menu. */
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentName: string;
  /** Persist the new (trimmed, non-empty) name; reject to keep the dialog open. */
  onRename: (name: string) => Promise<void>;
}

/** The "rename" dialog of the campaign's menu (GM only). */
export function RenameCampaignDialog({
  open,
  onOpenChange: setOpen,
  currentName,
  onRename,
}: Props) {
  const { t } = useTranslation(["campaigns", "common"]);
  const [name, setName] = useState(currentName);
  const [saving, setSaving] = useState(false);

  const trimmed = name.trim();
  const unchanged = trimmed === currentName;

  function onOpenChange(next: boolean) {
    // Start every session of the dialog from the name currently stored.
    if (next) setName(currentName);
    setOpen(next);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!trimmed || unchanged) return;
    setSaving(true);
    try {
      await onRename(trimmed);
      setOpen(false);
    } catch {
      // The caller reports the failure; keep the dialog open so the name isn't lost.
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={submit} className="grid gap-4">
            <DialogHeader>
              <DialogTitle>{t("rename.title")}</DialogTitle>
              <DialogDescription>{t("rename.intro")}</DialogDescription>
            </DialogHeader>
            <div className="grid gap-2">
              <Label htmlFor="campaign-name">{t("rename.name")}</Label>
              <Input
                id="campaign-name"
                autoFocus
                maxLength={MAX_NAME_LENGTH}
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                {t("common:actions.cancel")}
              </Button>
              <Button type="submit" disabled={saving || !trimmed || unchanged}>
                {saving ? t("common:actions.saving") : t("common:actions.save")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
