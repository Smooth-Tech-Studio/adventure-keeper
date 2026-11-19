import { useState, type ReactNode } from "react";
import { DicesIcon, LockIcon, TriangleAlertIcon } from "lucide-react";
import {
  averageHitDie,
  hitPointGain,
  type HitPointMethod,
  type HitPointRoll,
} from "@adventure-keeper/system-dnd2024";
import { useTranslation } from "react-i18next";

import { DiceTray, type TrayRoll } from "@/components/session/dice-tray";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { rollDie } from "@/lib/dice";
import type { DieKind } from "@/lib/die-mesh";
import { signed } from "@/lib/format";
import { cn } from "@/lib/utils";

/** How a stored entry was settled; older sheets typed their roll in. */
const methodOf = (entry: HitPointRoll): HitPointMethod =>
  entry.method ?? (entry.roll === undefined ? "average" : "table");

/**
 * How each level beyond the first sets its hit points: the average, a roll on
 * the 3D tray, or the result of a die rolled at the table, typed in. One card
 * per level: the three ways side by side, then what the die gives, with and
 * without Constitution.
 *
 * Nothing is picked for the player, and the first choice is **final**: the
 * other two lock, so one cannot roll again until the result pleases. A
 * warning says so before choosing.
 *
 * Shared by the creation (every level up to the starting one) and the
 * level-up (the new level only), both final; and by the sheet editor, where a
 * mistake is fixed, so nothing locks there (`final={false}`).
 */
export function HitPointRollsField({
  hitDie,
  conModifier,
  levels,
  rolls,
  onChange,
  final = true,
}: {
  hitDie: number;
  conModifier: number;
  /** The levels to ask about, each 2 or more. */
  levels: number[];
  rolls: HitPointRoll[];
  onChange: (rolls: HitPointRoll[]) => void;
  /** The first choice locks the others (creation, level-up). */
  final?: boolean;
}) {
  const [tray, setTray] = useState<TrayRoll | null>(null);
  /** What is being typed for « Jet à la table », by level, before it is confirmed. */
  const [typed, setTyped] = useState<Record<number, string>>({});
  const { t } = useTranslation("characters", { keyPrefix: "hp" });
  const average = averageHitDie(hitDie);
  const con = conModifier >= 0 ? `+ ${conModifier}` : `− ${-conModifier}`;

  function settle(level: number, method: HitPointMethod, roll?: number) {
    // Final: a level already settled is never written again.
    if (final && rolls.some((entry) => entry.level === level)) return;
    const entry: HitPointRoll = roll === undefined ? { level, method } : { level, roll, method };
    const others = rolls.filter((row) => row.level !== level);
    onChange([...others, entry].sort((a, b) => a.level - b.level));
  }

  function rollFor(level: number) {
    const value = rollDie(hitDie);
    settle(level, "roll", value);
    setTray({
      seq: Date.now(),
      label: t("trayLabel", { level }),
      dice: [{ kind: `d${hitDie}` as DieKind, value }],
      total: hitPointGain(hitDie, conModifier, value),
      detail: `d${hitDie} ${value} ${con} (Constitution)`,
    });
  }

  /** The typed die, if it is a face of the die. */
  const typedFace = (level: number) => {
    const value = Number(typed[level]);
    return typed[level] && Number.isInteger(value) && value >= 1 && value <= hitDie
      ? value
      : undefined;
  };

  return (
    <div className="flex flex-col gap-3">
      {final && levels.some((level) => !rolls.some((entry) => entry.level === level)) && (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-xl border-2 border-amber-500 bg-amber-500/15 px-4 py-3 text-sm font-medium text-amber-900 dark:text-amber-100"
        >
          <TriangleAlertIcon className="mt-0.5 size-5 shrink-0" />
          <span>{t("finalWarning")}</span>
        </p>
      )}
      {levels.map((level) => {
        const entry = rolls.find((row) => row.level === level);
        // On a sheet, a level with nothing recorded has the average (older sheets).
        const method = entry ? methodOf(entry) : final ? undefined : "average";
        const locked = final && method !== undefined;
        const die = method === "average" ? average : entry?.roll;
        return (
          <div key={level} className="bg-card flex flex-col gap-3 rounded-xl border p-4">
            {levels.length > 1 && <span className="font-medium">{t("level", { level })}</span>}
            <div className="grid gap-2 sm:grid-cols-3">
              <Option
                selected={method === "average"}
                locked={locked}
                title={t("averageTitle")}
                hint={t("averageHint")}
                onSelect={() => settle(level, "average")}
              >
                {average}
              </Option>
              <Option
                selected={method === "roll"}
                locked={locked}
                title={t("rollTitle")}
                hint={t("rollHint", { die: hitDie })}
                onSelect={() => rollFor(level)}
              >
                {method === "roll" && entry?.roll !== undefined ? (
                  entry.roll
                ) : (
                  <DicesIcon className="text-muted-foreground size-7" />
                )}
              </Option>
              <Option
                selected={method === "table"}
                locked={locked}
                title={t("tableTitle")}
                hint={t("tableHint", { die: hitDie })}
              >
                {final && method === "table" ? (
                  entry?.roll
                ) : (
                  <span className="flex items-center gap-1.5">
                    <Input
                      type="number"
                      min={1}
                      max={hitDie}
                      inputMode="numeric"
                      disabled={locked}
                      aria-label={t("rollLabel", { level })}
                      className="type-title h-10 w-16 text-center"
                      value={typed[level] ?? (method === "table" ? String(entry?.roll ?? "") : "")}
                      onChange={(event) => {
                        const text = event.target.value;
                        setTyped((current) => ({ ...current, [level]: text }));
                        // Not final: a valid face applies at once, as before.
                        const value = Number(text);
                        if (!final && Number.isInteger(value) && value >= 1 && value <= hitDie)
                          settle(level, "table", value);
                      }}
                      onKeyDown={(event) => {
                        const face = typedFace(level);
                        if (event.key === "Enter" && face !== undefined)
                          settle(level, "table", face);
                      }}
                    />
                    {final && (
                      <Button
                        type="button"
                        size="sm"
                        disabled={locked || typedFace(level) === undefined}
                        onClick={() => settle(level, "table", typedFace(level))}
                      >
                        {t("confirm")}
                      </Button>
                    )}
                  </span>
                )}
              </Option>
            </div>
            {die === undefined ? (
              <p className="text-muted-foreground text-sm">{t("chooseOne")}</p>
            ) : (
              <>
                <div className="bg-muted/50 grid grid-cols-2 gap-2 rounded-lg p-3 text-center">
                  <div className="flex flex-col">
                    <span className="type-label">{t("withoutCon")}</span>
                    <span className="type-title text-muted-foreground tabular-nums">{die}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="type-label">
                      {t("withCon", { modifier: signed(conModifier) })}
                    </span>
                    <span className="type-figure text-emerald-600 tabular-nums dark:text-emerald-400">
                      {t("gain", { value: hitPointGain(hitDie, conModifier, die) })}
                    </span>
                  </div>
                </div>
                {final && (
                  <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
                    <LockIcon className="size-3.5" /> {t("locked")}
                  </p>
                )}
              </>
            )}
          </div>
        );
      })}
      <DiceTray roll={tray} onClose={() => setTray(null)} />
    </div>
  );
}

/**
 * One of the three ways, as a card: what it is, its value, a word on it. Once
 * a way is chosen the others grey out and stop answering.
 */
function Option({
  selected,
  locked,
  title,
  hint,
  onSelect,
  children,
}: {
  selected: boolean;
  locked: boolean;
  title: string;
  hint: string;
  /** Absent for the table roll, which is confirmed by its own button. */
  onSelect?: () => void;
  children: ReactNode;
}) {
  const disabled = locked && !selected;
  const clickable = onSelect !== undefined && !locked;
  return (
    <div
      role={onSelect ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      aria-pressed={onSelect ? selected : undefined}
      aria-disabled={onSelect ? locked : undefined}
      onClick={clickable ? onSelect : undefined}
      onKeyDown={(event) => {
        if (!clickable || event.target !== event.currentTarget) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect();
        }
      }}
      className={cn(
        "flex flex-col items-center gap-1 rounded-lg border px-3 py-3 text-center transition-colors",
        clickable && "hover:bg-accent cursor-pointer",
        selected ? "border-primary bg-primary/10" : "border-input",
        disabled && "opacity-40 grayscale",
      )}
    >
      <span className="text-sm font-medium">{title}</span>
      <span className="type-figure grid h-10 place-items-center tabular-nums">{children}</span>
      <span className="text-muted-foreground text-xs">{hint}</span>
    </div>
  );
}
