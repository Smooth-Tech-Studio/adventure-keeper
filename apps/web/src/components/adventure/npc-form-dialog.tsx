import { useState } from "react";
import { toast } from "sonner";
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
import {
  LocationLinkSelect,
  type LocationOption,
} from "@/components/adventure/location-link-select";
import type { NpcFormValues } from "@/components/adventure/npc-form";

/** Add / edit dialog for an adventure NPC. Shared by creation & detail. */
export function NpcFormDialog({
  open,
  onOpenChange,
  initial,
  locationOptions,
  enemyOptions,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial: NpcFormValues;
  locationOptions: LocationOption[];
  /** The adventure's enemy profiles; absent where they have no id yet (creation). */
  enemyOptions?: { id: string; name: string }[];
  onSave: (values: NpcFormValues) => void | Promise<void>;
}) {
  const { t } = useTranslation(["adventures", "common"]);
  const [form, setForm] = useState(initial);
  const [busy, setBusy] = useState(false);
  // Refill the form when the dialog opens, not on every render: `initial` is
  // a new object each time the parent renders, which would wipe the typing.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setForm(initial);
  }

  const set = (patch: Partial<NpcFormValues>) => setForm((f) => ({ ...f, ...patch }));

  async function submit() {
    if (!form.name.trim()) {
      toast.error(t("npcs.nameRequired"));
      return;
    }
    setBusy(true);
    try {
      await onSave({ ...form, name: form.name.trim() });
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
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("npcs.dialogTitle")}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-3">
          <div className="grid gap-1">
            <Label className="text-xs">{t("npcs.name")}</Label>
            <Input
              autoFocus
              placeholder={t("npcs.namePlaceholder")}
              value={form.name}
              onChange={(e) => set({ name: e.target.value })}
            />
          </div>
          <div className="grid gap-1">
            <Label className="text-xs">{t("npcs.personality")}</Label>
            <Input
              placeholder={t("npcs.personalityPlaceholder")}
              value={form.personality}
              onChange={(e) => set({ personality: e.target.value })}
            />
          </div>
          <div className="grid gap-1">
            <Label className="text-xs">{t("npcs.lore")}</Label>
            <Textarea
              rows={3}
              placeholder={t("npcs.lorePlaceholder")}
              value={form.lore}
              onChange={(e) => set({ lore: e.target.value })}
            />
          </div>
          <LocationLinkSelect
            options={locationOptions}
            value={form.locationId}
            onChange={(locationId) => set({ locationId })}
          />
          {enemyOptions && enemyOptions.length > 0 && (
            <div className="grid gap-1">
              <Label className="text-xs">{t("npcs.combatProfile")}</Label>
              <Select
                value={form.enemyId || "none"}
                onValueChange={(next) => set({ enemyId: next === "none" ? "" : next })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t("npcs.noCombatProfile")}</SelectItem>
                  {enemyOptions.map((option) => (
                    <SelectItem key={option.id} value={option.id}>
                      {option.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-muted-foreground text-xs">{t("npcs.combatProfileHint")}</p>
            </div>
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
