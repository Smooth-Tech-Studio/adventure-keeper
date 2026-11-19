import { useCallback, useRef, useState } from "react";
import { Dice5Icon, MinusIcon, PlusIcon } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { CollapsibleCard } from "@/components/ui/collapsible-card";
import { Toggle } from "@/components/ui/toggle";
import { Die, type TrayDie } from "@/components/session/dice-tray";
import { DIE_SIDES, emphasisFor, type DieKind } from "@/lib/die-mesh";
import { rollDie } from "@/lib/dice";
import { cn } from "@/lib/utils";

const DIE_KINDS: DieKind[] = ["d4", "d6", "d8", "d10", "d12", "d20"];
/** Keeps the board readable and matches the big tray's own `MAX_DICE` budget. */
const MAX_QTY = 20;

interface Roll {
  /** Bumped on every roll so the dice remount and replay their animation. */
  seq: number;
  dice: TrayDie[];
  total: number;
}

/** Die size in the small in-block board, based on how many are showing at once. */
function boardDieSize(count: number): number {
  if (count >= 16) return 28;
  if (count >= 10) return 34;
  if (count >= 6) return 42;
  if (count >= 3) return 52;
  if (count > 1) return 64;
  return 80;
}

/**
 * Free-form dice roller — pick a die type and a quantity, hit *Lancer*, and the
 * little board plays the same tumbling animation as the full-screen tray, right
 * in place. Available to both players and the GM.
 *
 * Uncontrolled by default (remembers open/closed for this viewer). Pass
 * `open` / `onOpenChange` to drive it from a parent instead — e.g. the
 * player sheet's accordion, where only one block may be open at a time.
 */
export function DiceRollerBlock({
  className,
  open,
  onOpenChange,
}: {
  className?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const { t } = useTranslation("session", { keyPrefix: "dice" });
  const [kind, setKind] = useState<DieKind>("d20");
  const [qty, setQty] = useState(1);
  const [roll, setRoll] = useState<Roll | null>(null);
  const [settled, setSettled] = useState(0);
  const seqRef = useRef(0);
  const bumpSettled = useCallback(() => setSettled((n) => n + 1), []);

  const sides = DIE_SIDES[kind];
  const expr = `${qty}d${sides}`;
  const done = roll != null && settled >= roll.dice.length;

  function launch() {
    const rolls = Array.from({ length: qty }, () => rollDie(sides));
    const total = rolls.reduce((sum, n) => sum + n, 0);
    const dice: TrayDie[] = rolls.map((value) => ({ kind, value }));
    seqRef.current += 1;
    setSettled(0);
    setRoll({ seq: seqRef.current, dice, total });
  }

  const size = boardDieSize(roll?.dice.length ?? qty);

  return (
    <CollapsibleCard
      id="dice-roller-block"
      dense
      storageKey={open === undefined ? "dice-roller" : undefined}
      open={open}
      onOpenChange={onOpenChange}
      className={className}
      title={<span className="text-sm">{t("title")}</span>}
    >
      <div className="grid gap-3 text-xs">
        {/* Type de dé */}
        <div className="grid gap-1">
          <span className="text-muted-foreground">{t("kind")}</span>
          <div className="grid grid-cols-6 gap-1">
            {DIE_KINDS.map((k) => (
              <Toggle
                key={k}
                variant="outline"
                pressed={kind === k}
                onPressedChange={() => setKind(k)}
                className="h-auto w-full rounded-md border px-1 py-1.5 text-center text-xs font-medium"
              >
                {k}
              </Toggle>
            ))}
          </div>
        </div>

        {/* Quantité */}
        <div className="flex items-center justify-between gap-2">
          <span className="text-muted-foreground">{t("quantity")}</span>
          <span className="flex items-center gap-1">
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="size-6"
              aria-label={t("fewer")}
              disabled={qty <= 1}
              onClick={() => setQty((n) => Math.max(1, n - 1))}
            >
              <MinusIcon className="size-3" />
            </Button>
            <span className="w-8 text-center font-semibold tabular-nums">{qty}</span>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="size-6"
              aria-label={t("more")}
              disabled={qty >= MAX_QTY}
              onClick={() => setQty((n) => Math.min(MAX_QTY, n + 1))}
            >
              <PlusIcon className="size-3" />
            </Button>
          </span>
        </div>

        {/* Petit plateau — la même animation que le jet plein écran, en place */}
        <div className="bg-muted/40 flex min-h-36 flex-col items-center justify-center gap-2 rounded-md border p-2">
          {roll ? (
            <>
              <div className="flex flex-wrap items-center justify-center gap-1.5">
                {roll.dice.map((die, i) => (
                  <Die
                    key={i}
                    replayKey={roll.seq}
                    kind={die.kind}
                    value={die.value}
                    spinSeed={roll.seq * 1.7 + i * 2.3}
                    size={size}
                    emphasis={emphasisFor(die)}
                    faded={false}
                    onRest={bumpSettled}
                  />
                ))}
              </div>
              <div
                className={cn(
                  "text-center transition-opacity duration-300",
                  done ? "opacity-100" : "opacity-0",
                )}
              >
                <div className="text-2xl leading-tight font-bold tabular-nums">
                  <span className="text-muted-foreground">
                    {roll.dice.length > 1 ? `${roll.dice.map((d) => d.value).join(" + ")} = ` : ""}
                    {roll.total}
                  </span>
                </div>
              </div>
            </>
          ) : (
            <p className="text-muted-foreground text-center text-[11px]">{t("pick")}</p>
          )}
        </div>

        <Button type="button" size="sm" onClick={launch}>
          <Dice5Icon /> {t("roll", { expr })}
        </Button>
      </div>
    </CollapsibleCard>
  );
}
