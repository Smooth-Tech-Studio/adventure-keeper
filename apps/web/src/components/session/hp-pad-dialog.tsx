import { useState } from "react";
import { DeleteIcon } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Props {
  /** Whose hit points; `null` closes the pad. */
  target: { name: string; current: number; max: number; temp?: number } | null;
  onClose: () => void;
  onHitPoints: (value: number) => void;
  /** Absent for creatures without temporary hit points (enemies). */
  onTemp?: (value: number) => void;
}

/**
 * A number pad for the GM: type the damage once (« 7 ») instead of pressing −
 * seven times. Damage takes temporary hit points first; temporary hit points
 * don't stack — the higher value stays.
 */
export function HpPadDialog({ target, onClose, onHitPoints, onTemp }: Props) {
  const { t } = useTranslation("session", { keyPrefix: "hpPad" });
  const [amount, setAmount] = useState("");

  function close() {
    setAmount("");
    onClose();
  }

  function apply(kind: "damage" | "heal" | "temp") {
    const n = Number(amount) || 0;
    if (!target || n <= 0) return close();
    const temp = target.temp ?? 0;
    if (kind === "damage") {
      const fromTemp = Math.min(temp, n);
      if (fromTemp > 0) onTemp?.(temp - fromTemp);
      if (n > fromTemp) onHitPoints(Math.max(0, target.current - (n - fromTemp)));
    } else if (kind === "heal") {
      onHitPoints(Math.min(target.max, target.current + n));
    } else {
      onTemp?.(Math.max(temp, n));
    }
    close();
  }

  const key = (k: string) =>
    setAmount((a) => (k === "back" ? a.slice(0, -1) : (a + k).replace(/^0+/, "").slice(0, 3)));

  return (
    <Dialog open={target !== null} onOpenChange={(open) => !open && close()}>
      <DialogContent className="max-w-xs" id="hp-pad">
        <DialogHeader>
          <DialogTitle>{target?.name}</DialogTitle>
          <DialogDescription>
            {t("current", { current: target?.current ?? 0, max: target?.max ?? 0 })}
            {target?.temp ? ` · ${t("temp", { value: target.temp })}` : ""}
          </DialogDescription>
        </DialogHeader>
        <output className="block text-center text-4xl font-black tabular-nums" aria-live="polite">
          {amount || "0"}
        </output>
        <div className="grid grid-cols-3 gap-1.5">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "back"].map((k) =>
            k === "" ? (
              <span key="gap" />
            ) : (
              <Button
                key={k}
                type="button"
                variant="outline"
                className="h-11 text-lg font-bold"
                aria-label={k === "back" ? t("erase") : k}
                onClick={() => key(k)}
              >
                {k === "back" ? <DeleteIcon /> : k}
              </Button>
            ),
          )}
        </div>
        <div className="flex gap-1.5">
          <Button
            type="button"
            variant="destructive"
            className="flex-1"
            onClick={() => apply("damage")}
          >
            {t("damage")}
          </Button>
          <Button
            type="button"
            className="flex-1 bg-emerald-600 text-white hover:bg-emerald-600/90"
            onClick={() => apply("heal")}
          >
            {t("heal")}
          </Button>
          {onTemp && (
            <Button type="button" variant="outline" onClick={() => apply("temp")}>
              {t("tempButton")}
            </Button>
          )}
        </div>
        <p className="text-muted-foreground text-xs">{t(onTemp ? "hint" : "hintNoTemp")}</p>
      </DialogContent>
    </Dialog>
  );
}
