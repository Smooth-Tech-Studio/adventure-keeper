import { useEffect, useState } from "react";
import type { Item } from "@adventure-keeper/schemas";
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

function uid(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `i${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (item: Item) => void;
}

/** Minimal "add an item to my inventory" popup used in the live session. */
export function AddInventoryDialog({ open, onOpenChange, onAdd }: Props) {
  const { t } = useTranslation(["characters", "common"]);
  const [name, setName] = useState("");
  const [lore, setLore] = useState("");
  const [consumable, setConsumable] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName("");
      setLore("");
      setConsumable(false);
      setQuantity(1);
      setError(null);
    }
  }, [open]);

  function submit() {
    if (!name.trim()) {
      setError(t("items.nameRequired"));
      return;
    }
    onAdd({
      id: uid(),
      name: name.trim(),
      lore: lore.trim() || undefined,
      consumable,
      quantity: consumable ? Math.max(1, Math.round(quantity) || 1) : 1,
    });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("addItem.title")}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="add-item-name">{t("items.name")}</Label>
            <Input
              id="add-item-name"
              autoFocus
              value={name}
              placeholder={t("addItem.placeholder")}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
            />
            {error && <p className="text-destructive text-sm">{error}</p>}
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="add-item-consumable"
              checked={consumable}
              onCheckedChange={(v) => setConsumable(v === true)}
            />
            <Label htmlFor="add-item-consumable" className="font-normal">
              {t("items.consumable")}
            </Label>
          </div>

          {consumable && (
            <div className="grid w-28 gap-1.5">
              <Label htmlFor="add-item-qty">{t("items.quantity")}</Label>
              <Input
                id="add-item-qty"
                type="number"
                min={1}
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))}
              />
            </div>
          )}

          <div className="grid gap-1.5">
            <Label htmlFor="add-item-lore">{t("items.lore")}</Label>
            <Textarea
              id="add-item-lore"
              rows={3}
              value={lore}
              onChange={(e) => setLore(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            {t("common:actions.cancel")}
          </Button>
          <Button type="button" onClick={submit}>
            {t("common:actions.add")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
