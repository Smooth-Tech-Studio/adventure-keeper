import { PlusIcon, XIcon } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CoinFields } from "@/systems/dnd2024/session/player-sheet/purse-sum-dialog";
import type { PlannedLootDraft } from "@/lib/planned-loot";

/**
 * « Butin prévu » of an enemy or a location: objects (name, quantity) and
 * coins, found again in the session's « Donner du butin ».
 */
export function PlannedLootField({
  idPrefix,
  value,
  onChange,
}: {
  idPrefix: string;
  value: PlannedLootDraft;
  onChange: (value: PlannedLootDraft) => void;
}) {
  const { t } = useTranslation("adventures", { keyPrefix: "plannedLoot" });
  const setItem = (index: number, patch: Partial<PlannedLootDraft["items"][number]>) =>
    onChange({
      ...value,
      items: value.items.map((line, at) => (at === index ? { ...line, ...patch } : line)),
    });

  return (
    <fieldset className="grid gap-2">
      <legend className="text-xs font-medium">{t("title")}</legend>
      <p className="text-muted-foreground -mt-1 text-xs">{t("hint")}</p>
      {value.items.map((line, index) => (
        <div key={index} className="flex items-center gap-1.5">
          <Input
            aria-label={t("itemName")}
            placeholder={t("itemPlaceholder")}
            maxLength={120}
            value={line.name}
            onChange={(event) => setItem(index, { name: event.target.value })}
          />
          <Input
            type="number"
            min={1}
            inputMode="numeric"
            aria-label={t("quantity")}
            className="w-16 shrink-0 text-center tabular-nums"
            value={line.quantity}
            onChange={(event) => setItem(index, { quantity: event.target.value })}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 shrink-0"
            aria-label={t("removeItem")}
            onClick={() =>
              onChange({ ...value, items: value.items.filter((_, at) => at !== index) })
            }
          >
            <XIcon className="size-3.5" />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="self-start"
        onClick={() => onChange({ ...value, items: [...value.items, { name: "", quantity: "1" }] })}
      >
        <PlusIcon /> {t("addItem")}
      </Button>
      <CoinFields
        idPrefix={`${idPrefix}-loot`}
        value={value.money}
        onChange={(money) => onChange({ ...value, money })}
      />
    </fieldset>
  );
}
