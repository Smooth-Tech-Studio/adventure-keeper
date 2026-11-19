import { useState } from "react";
import { ArrowRightIcon } from "lucide-react";
import { ZERO_MONEY, type Money } from "@adventure-keeper/schemas";
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
import {
  COINS,
  addCoins,
  formatPurse,
  fromCopper,
  missingCopper,
  spendCoins,
} from "@/systems/dnd2024/lib/money";

export type PurseSumMode = "add" | "spend";

/**
 * A sum to add to the purse or to spend from it, coin by coin: « 50 po 5 pa »,
 * then Valider. The result is shown before it is applied; spending makes change
 * (1 po → 10 pa), and a sum the whole purse cannot cover is refused with what
 * is missing.
 */
export function PurseSumDialog({
  mode,
  money,
  onOpenChange,
  onApply,
}: {
  /** `null` when closed. */
  mode: PurseSumMode | null;
  money: Money;
  onOpenChange: (open: boolean) => void;
  onApply: (money: Money) => void;
}) {
  const { t } = useTranslation("session", { keyPrefix: "sheet.bag.sum" });
  const [sum, setSum] = useState<Money>(ZERO_MONEY);
  const empty = COINS.every(({ key }) => sum[key] === 0);
  const result = mode === "spend" ? spendCoins(money, sum) : addCoins(money, sum);
  const missing = mode === "spend" ? missingCopper(money, sum) : 0;

  function close() {
    setSum(ZERO_MONEY);
    onOpenChange(false);
  }

  return (
    <Dialog open={mode !== null} onOpenChange={(open) => (open ? onOpenChange(true) : close())}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{mode === "spend" ? t("spendTitle") : t("addTitle")}</DialogTitle>
          <DialogDescription>{mode === "spend" ? t("spendHint") : t("addHint")}</DialogDescription>
        </DialogHeader>
        <form
          id="purse-sum"
          onSubmit={(event) => {
            event.preventDefault();
            if (empty || !result) return;
            onApply(result);
            close();
          }}
        >
          <CoinFields idPrefix="purse-sum" value={sum} onChange={setSum} />
        </form>
        <div className="bg-muted/60 flex flex-wrap items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm tabular-nums">
          <span>{formatPurse(money)}</span>
          <ArrowRightIcon className="text-muted-foreground size-4" />
          {result ? (
            <span className="font-semibold">{formatPurse(result)}</span>
          ) : (
            <span role="alert" className="text-destructive font-medium">
              {t("missing", { amount: formatPurse(fromCopper(missing)) })}
            </span>
          )}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={close}>
            {t("cancel")}
          </Button>
          <Button type="submit" form="purse-sum" disabled={empty || !result}>
            {t("apply")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** One number per coin, platinum to copper — a sum to add, spend or give. */
export function CoinFields({
  idPrefix,
  value,
  onChange,
}: {
  idPrefix: string;
  value: Money;
  onChange: (value: Money) => void;
}) {
  return (
    <div className="grid grid-cols-5 gap-2">
      {COINS.map(({ key, label, short }) => (
        <div key={key} className="grid gap-1 text-center">
          <Label htmlFor={`${idPrefix}-${key}`} className="justify-center text-xs" title={label}>
            {short}
          </Label>
          <Input
            id={`${idPrefix}-${key}`}
            type="number"
            min={0}
            inputMode="numeric"
            aria-label={label}
            className="px-1 text-center tabular-nums"
            value={value[key] === 0 ? "" : String(value[key])}
            onChange={(event) =>
              onChange({
                ...value,
                [key]: Math.max(0, Math.round(Number(event.target.value) || 0)),
              })
            }
          />
        </div>
      ))}
    </div>
  );
}
