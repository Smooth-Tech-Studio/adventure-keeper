import { useState } from "react";
import { EyeOffIcon } from "lucide-react";
import { toast } from "sonner";
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
import { Textarea } from "@/components/ui/textarea";
import { ImageUrlField } from "@/components/image-url-field";
import { PlannedLootField } from "@/components/adventure/planned-loot-field";
import { MapScaleCalibrator } from "@/components/adventure/map-scale-calibrator";
import type { LocationFormValues } from "@/components/adventure/location-form";

/** Add / edit dialog for an adventure location. Shared by creation & detail. */
export function LocationFormDialog({
  open,
  onOpenChange,
  initial,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial: LocationFormValues;
  onSave: (values: LocationFormValues) => void | Promise<void>;
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

  const set = (patch: Partial<LocationFormValues>) => setForm((f) => ({ ...f, ...patch }));

  async function submit() {
    if (!form.name.trim()) {
      toast.error(t("locations.nameRequired"));
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
          <DialogTitle>{t("locations.dialogTitle")}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-3">
          <div className="grid gap-1">
            <Label className="text-xs">{t("locations.name")}</Label>
            <Input
              autoFocus
              placeholder={t("locations.namePlaceholder")}
              value={form.name}
              onChange={(e) => set({ name: e.target.value })}
            />
          </div>
          <div className="grid gap-1">
            <Label className="text-xs">{t("locations.description")}</Label>
            <Textarea
              rows={3}
              value={form.description}
              onChange={(e) => set({ description: e.target.value })}
            />
          </div>
          <PlannedLootField
            idPrefix="location"
            value={form.loot}
            onChange={(loot) => set({ loot })}
          />
          <ImageUrlField
            crop={false}
            value={{ imageUrl: form.imageUrl }}
            onChange={(value) => {
              const imageUrl = value.imageUrl ?? "";
              // A new image means a new measure.
              set(imageUrl === form.imageUrl ? { imageUrl } : { imageUrl, scale: undefined });
            }}
            label={t("locations.imageLabel")}
            placeholder={t("locations.imagePlaceholder")}
          />
          {form.imageUrl && (
            <MapScaleCalibrator
              key={form.imageUrl}
              imageUrl={form.imageUrl}
              value={form.scale}
              onChange={(scale) => set({ scale })}
            />
          )}
          <label className="flex items-start gap-2 text-sm">
            <Checkbox
              className="mt-0.5"
              checked={form.hidden}
              onCheckedChange={(checked) => set({ hidden: checked === true })}
            />
            <span>
              <span className="inline-flex items-center gap-1 font-medium">
                <EyeOffIcon className="size-3.5" /> {t("locations.hidden")}
              </span>
              <span className="text-muted-foreground block text-xs">
                {t("locations.hiddenHint")}
              </span>
            </span>
          </label>
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
