import { useRef, useState } from "react";
import { Dice5Icon, MinusIcon, PlusIcon } from "lucide-react";
import type { AdventureParticipant } from "@adventure-keeper/schemas";
import { rollDicePool, scaleDicePool, type DicePool } from "@adventure-keeper/system-dnd2024";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { DiceTray, type TrayDie, type TrayRoll } from "@/components/session/dice-tray";
import type { DieKind } from "@/lib/die-mesh";
import { d20 } from "@/lib/dice";
import { signed } from "@/lib/format";
import type { RollSpec } from "@/systems/dnd2024/lib/player-actions";
import { autoRollSources, isD20Kind } from "@/systems/dnd2024/lib/roll-sources";
import { cn } from "@/lib/utils";

/** A roll as the history keeps it. */
export interface RollRecord {
  label: string;
  total: number;
  detail: string;
  /** A healing roll: the total goes back on the HP. */
  heal?: boolean;
  /** Temporary HP: the total replaces a smaller pool. */
  tempHp?: boolean;
  /** What was rolled — an initiative goes to the GM's next fight. */
  kind?: RollSpec["kind"];
  /** The DC the roll had to meet, if any: below it, the save failed. */
  dc?: number;
  /** A concentration save (see `RollSpec.concentration`). */
  concentration?: boolean;
  /** When, in ms since the epoch (a roll kept on the participant). */
  at?: number;
}

/** The free roll of the dice button: the player picks the dice. */
export interface FreeRollSpec extends RollSpec {
  free: true;
}

type Mode = "normal" | "adv" | "dis";
interface Result {
  total: number;
  face: number;
  crit: boolean;
  fumble: boolean;
  detail: string;
  /** The app's dice, kept on screen after the roll (none for typed dice). */
  dice?: TrayDie[];
}

const TRAY_KINDS = new Set(["d4", "d6", "d8", "d10", "d12", "d20"]);
const FREE_DICE = ["d4", "d6", "d8", "d10", "d12", "d20", "d100"] as const;
const SIDES: Record<string, number> = {
  d1: 1,
  d4: 4,
  d6: 6,
  d8: 8,
  d10: 10,
  d12: 12,
  d20: 20,
  d100: 100,
};
const poolLabel = (pool: DicePool) =>
  pool.die === "d1" ? String(pool.count) : `${pool.count}${pool.die}`;

/**
 * The roll sheet: a tap on an attack, a spell, a save or a skill opens it,
 * filled in. The player rolls the app's dice — the 3D tray stages them — or
 * types what their own dice show; the bonus is added and a natural 20 seen.
 * After an attack: « Touché → dégâts » opens the damage, doubled on a crit.
 */
export function RollSheet({
  spec,
  participant,
  wide,
  ownDice,
  onOwnDiceChange,
  history,
  onRolled,
  onOpen,
  onClose,
}: {
  spec: RollSpec | FreeRollSpec | null;
  /** The player's live state (exhaustion, concentration…); absent for a GM's monster roll. */
  participant?: AdventureParticipant;
  /** A computer: a centred dialog with the history beside it. */
  wide: boolean;
  /** « J'utilise mes propres dés »: typing comes first. */
  ownDice: boolean;
  onOwnDiceChange: (value: boolean) => void;
  history: RollRecord[];
  onRolled: (record: RollRecord) => void;
  /** Opens another roll (the damage after a hit). */
  onOpen: (spec: RollSpec) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation("session", { keyPrefix: "player.roll" });
  const open = spec !== null;
  const body = spec ? (
    <RollBody
      key={`${spec.label}-${spec.kind}-${spec.pool?.count}`}
      spec={spec}
      participant={participant}
      ownDice={ownDice}
      onOwnDiceChange={onOwnDiceChange}
      onRolled={onRolled}
      onOpen={onOpen}
      onClose={onClose}
    />
  ) : null;
  const historyList = (
    <div className="flex flex-col gap-1.5">
      <div className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
        {t("history")}
      </div>
      {history.length === 0 ? (
        <p className="text-muted-foreground text-sm">{t("noHistory")}</p>
      ) : (
        <ul className="flex max-h-64 flex-col gap-1 overflow-y-auto">
          {history.map((record, i) => (
            <li
              key={i}
              className="bg-muted/40 flex items-baseline gap-2 rounded-md px-2 py-1 text-xs"
            >
              <span className="min-w-0 flex-1 truncate">
                {record.label} <span className="text-muted-foreground">{record.detail}</span>
              </span>
              <b className="tabular-nums">{record.total}</b>
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  if (wide) {
    return (
      <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Dice5Icon className="size-5" /> {spec?.label}
            </DialogTitle>
            <DialogDescription className="sr-only">{t("title")}</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-[minmax(0,1fr)_14rem] gap-6">
            <div>{body}</div>
            {historyList}
          </div>
        </DialogContent>
      </Dialog>
    );
  }
  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{spec?.label}</SheetTitle>
          <SheetDescription className="sr-only">{t("title")}</SheetDescription>
        </SheetHeader>
        <SheetBody className="flex flex-col gap-4">
          {body}
          {historyList}
        </SheetBody>
      </SheetContent>
    </Sheet>
  );
}

function RollBody({
  spec,
  participant,
  ownDice,
  onOwnDiceChange,
  onRolled,
  onOpen,
  onClose,
}: {
  spec: RollSpec | FreeRollSpec;
  participant?: AdventureParticipant;
  ownDice: boolean;
  onOwnDiceChange: (value: boolean) => void;
  onRolled: (record: RollRecord) => void;
  onOpen: (spec: RollSpec) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation("session", { keyPrefix: "player.roll" });
  const free = "free" in spec;
  const [freePool, setFreePool] = useState<DicePool>(spec.pool ?? { count: 1, die: "d20" });
  const [freeBonus, setFreeBonus] = useState(spec.bonus);
  const kind = free
    ? freePool.die === "d20" && freePool.count === 1
      ? "carac"
      : "degats"
    : spec.kind;
  const d20Roll = isD20Kind(kind);
  const pool = free ? freePool : spec.pool;
  // A feature that grants advantage on this roll (Sens du danger…) ticks it.
  const [mode, setMode] = useState<Mode>(() =>
    !free && autoRollSources(spec.kind, participant, spec.ctx).some((x) => x.advantage)
      ? "adv"
      : "normal",
  );
  const [entry, setEntry] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [tray, setTray] = useState<TrayRoll | null>(null);
  const seq = useRef(0);

  // Situational modifiers the app knows (exhaustion, Bless, invocations…).
  const sources = free ? [] : autoRollSources(kind, participant, spec.ctx);
  const flat = (free ? freeBonus : spec.bonus) + sources.reduce((s, x) => s + (x.flat ?? 0), 0);
  // Champion: a critical hit on 19 (then 18) as well as 20.
  const critOn = kind === "attaque" ? (spec.ctx?.character?.critRange ?? 20) : 20;
  const extraDice = sources.flatMap((x) => (x.dice ? [{ pool: x.dice, label: x.label }] : []));
  const formula = `${d20Roll ? (mode === "normal" ? "d20" : "2d20") : pool ? poolLabel(pool) : ""}${flat ? ` ${signed(flat)}` : ""}${extraDice.map((d) => ` + ${poolLabel(d.pool)}`).join("")}`;

  // The tray may report a roll twice (on reveal, then on close): keep it once.
  const recorded = useRef(new Set<number>());
  function finish(next: Result, rollSeq?: number) {
    if (rollSeq !== undefined) {
      if (recorded.current.has(rollSeq)) return;
      recorded.current.add(rollSeq);
    }
    setResult(next);
    onRolled({
      label: spec.label,
      total: next.total,
      detail: next.detail,
      heal: spec.heal,
      tempHp: spec.tempHp,
      kind: free ? undefined : spec.kind,
      dc: free ? undefined : spec.dc,
      concentration: free ? undefined : spec.concentration,
    });
  }

  function rollApp() {
    const extras = extraDice.map((d) => ({ ...d, rolled: rollDicePool(d.pool) }));
    const extraTotal = extras.reduce((s, d) => s + d.rolled.total, 0);
    const trayDice: TrayDie[] = [];
    let next: Result;
    if (d20Roll) {
      const dice = mode === "normal" ? [d20()] : [d20(), d20()];
      const kept =
        mode === "adv" ? Math.max(...dice) : mode === "dis" ? Math.min(...dice) : dice[0];
      for (const v of dice)
        trayDice.push({ kind: "d20", value: v, faded: mode !== "normal" && v !== kept });
      next = {
        total: kept + flat + extraTotal,
        face: kept,
        crit: kept >= critOn,
        fumble: kept === 1,
        detail: `d20 (${dice.join(", ")})${flat ? ` ${signed(flat)}` : ""}${extras.map((d) => ` + ${poolLabel(d.pool)} (${d.rolled.rolls.join(", ")})`).join("")}`,
      };
    } else {
      const main = pool ? rollDicePool(pool) : { rolls: [], total: 0 };
      if (pool && TRAY_KINDS.has(pool.die)) {
        for (const v of main.rolls) trayDice.push({ kind: pool.die as DieKind, value: v });
      }
      next = {
        total: main.total + flat + extraTotal,
        face: main.rolls[0] ?? 0,
        crit: false,
        fumble: false,
        detail: `${pool ? `${poolLabel(pool)} (${main.rolls.join(", ")})` : ""}${flat ? ` ${signed(flat)}` : ""}${extras.map((d) => ` + ${poolLabel(d.pool)} (${d.rolled.rolls.join(", ")})`).join("")}`,
      };
    }
    for (const d of extras) {
      if (TRAY_KINDS.has(d.pool.die)) {
        for (const v of d.rolled.rolls) trayDice.push({ kind: d.pool.die as DieKind, value: v });
      }
    }
    // The dice stay on the result once the tray is gone.
    if (trayDice.length > 0) next.dice = trayDice;
    if (trayDice.length === 0) return finish(next);
    seq.current += 1;
    const rollSeq = seq.current;
    setTray({
      seq: rollSeq,
      label: spec.label,
      dice: trayDice,
      total: next.total,
      detail: next.detail,
      onReveal: () => finish(next, rollSeq),
    });
  }

  function rollTyped() {
    const value = Number(entry);
    const count = pool?.count ?? 1;
    const sides = SIDES[pool?.die ?? "d20"] ?? 20;
    const min = d20Roll ? 1 : count;
    const max = d20Roll ? 20 : count * sides;
    if (!Number.isInteger(value) || value < min || value > max) {
      setError(t("between", { min, max }));
      return;
    }
    setError(null);
    finish({
      total: value + flat,
      face: value,
      crit: d20Roll && value >= critOn,
      fumble: d20Roll && value === 1,
      detail: `${t("ownDiceShort")} · ${d20Roll ? `d20 (${value})` : `${pool ? poolLabel(pool) : ""} (${value})`}${flat ? ` ${signed(flat)}` : ""}`,
    });
  }

  // What the typed dice come to, as the player types: « 14 +5 = 19 ».
  const typedValue = entry.trim() === "" ? null : Number(entry);
  const preview = typedValue !== null && Number.isInteger(typedValue) ? typedValue + flat : null;
  const typing = (
    <div className="bg-muted/40 flex flex-col gap-3 rounded-xl border p-3">
      <label
        htmlFor="roll-entry"
        className="text-muted-foreground text-center text-xs font-semibold tracking-wide uppercase"
      >
        {d20Roll ? t("typedD20") : t("typedDice", { dice: pool ? poolLabel(pool) : "" })}
      </label>
      <div className="flex items-center justify-center gap-3 text-2xl font-black tabular-nums">
        <input
          id="roll-entry"
          inputMode="numeric"
          autoFocus={ownDice}
          value={entry}
          onChange={(e) => {
            setEntry(e.target.value);
            setError(null);
          }}
          onKeyDown={(e) => e.key === "Enter" && rollTyped()}
          placeholder={d20Roll ? "1–20" : "?"}
          className="bg-background h-14 w-24 rounded-lg border text-center text-3xl font-black tabular-nums"
        />
        {flat !== 0 && <span className="text-muted-foreground">{signed(flat)}</span>}
        <span className="text-muted-foreground">=</span>
        <span className={cn("min-w-12 text-center", preview === null && "text-muted-foreground")}>
          {preview ?? "?"}
        </span>
      </div>
      {error && <p className="text-destructive text-center text-xs">{error}</p>}
      <Button
        type="button"
        size="lg"
        className="w-full"
        disabled={preview === null}
        onClick={rollTyped}
      >
        {t("validate")}
      </Button>
    </div>
  );
  const appButton = (
    <Button type="button" size="lg" onClick={rollApp} className="w-full">
      <Dice5Icon /> {t("rollWith", { formula })}
    </Button>
  );

  // Second child of the same fragment in both views, so the tray stays mounted
  // when the result replaces the form — otherwise the dice roll a second time.
  const tray3d = <DiceTray roll={tray} onClose={() => setTray(null)} />;
  if (result) {
    const next = spec.next;
    return (
      <>
        <div className="flex flex-col gap-3">
          <div className="text-center">
            {result.dice && (
              // The dice rolled, as they landed (the discarded one of an advantage dimmed).
              <div className="mb-2 flex flex-wrap justify-center gap-1.5" aria-hidden>
                {result.dice.map((die, index) => (
                  <span
                    key={index}
                    className={cn(
                      "grid min-w-11 place-items-center rounded-lg border-2 px-1.5 py-1 tabular-nums",
                      die.faded && "opacity-35",
                    )}
                  >
                    <span className="text-muted-foreground text-[10px] font-semibold uppercase">
                      {die.kind}
                    </span>
                    <span className="text-lg font-black leading-none">{die.value}</span>
                  </span>
                ))}
              </div>
            )}
            <div
              className={cn(
                "text-5xl font-black tabular-nums",
                result.crit && "text-amber-400",
                result.fumble && "text-destructive",
              )}
            >
              {result.total}
            </div>
            <div className="text-muted-foreground mt-1 text-xs">{result.detail}</div>
            {result.crit && (
              <div className="mt-1 text-sm font-semibold text-amber-400">{t("crit")}</div>
            )}
            {result.fumble && (
              <div className="text-destructive mt-1 text-sm font-semibold">{t("fumble")}</div>
            )}
            {!free && spec.dc !== undefined && (
              <div
                className={cn(
                  "mt-1 text-sm font-semibold",
                  result.total >= spec.dc
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-destructive",
                )}
              >
                {result.total >= spec.dc
                  ? t("dcSuccess", { dc: spec.dc })
                  : t("dcFailure", { dc: spec.dc })}
              </div>
            )}
          </div>
          {spec.kind === "attaque" && next ? (
            <div className="flex gap-2">
              <Button
                type="button"
                className="flex-1 bg-amber-400 font-semibold text-amber-950 hover:bg-amber-300"
                onClick={() =>
                  onOpen({
                    ...next,
                    label: `${next.label} · ${result.crit ? t("critDamage") : t("damage")}`,
                    pool: next.pool && result.crit ? scaleDicePool(next.pool, 2) : next.pool,
                  })
                }
              >
                {t("hit", {
                  formula: next.pool
                    ? `${poolLabel(result.crit ? scaleDicePool(next.pool, 2) : next.pool)}${next.bonus ? signed(next.bonus) : ""}`
                    : signed(next.bonus),
                })}
              </Button>
              <Button type="button" variant="outline" onClick={onClose}>
                {t("miss")}
              </Button>
            </div>
          ) : (
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => setResult(null)}
              >
                {t("again")}
              </Button>
              <Button type="button" className="flex-1" onClick={onClose}>
                {t("ok")}
              </Button>
            </div>
          )}
        </div>
        {tray3d}
      </>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-4">
        {free && (
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-7 gap-1.5">
              {FREE_DICE.map((die) => (
                <button
                  key={die}
                  type="button"
                  aria-pressed={freePool.die === die}
                  onClick={() => setFreePool({ count: die === "d20" ? 1 : freePool.count, die })}
                  className={cn(
                    "rounded-lg border py-2 text-sm font-bold",
                    freePool.die === die &&
                      "border-(--char,var(--primary)) bg-(--char,var(--primary))/15",
                  )}
                >
                  {die}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center justify-center gap-4 text-sm">
              <Stepper
                label={t("count")}
                value={String(freePool.count)}
                onMinus={() => setFreePool({ ...freePool, count: Math.max(1, freePool.count - 1) })}
                onPlus={() => setFreePool({ ...freePool, count: Math.min(20, freePool.count + 1) })}
              />
              <Stepper
                label={t("bonus")}
                value={signed(freeBonus)}
                onMinus={() => setFreeBonus(freeBonus - 1)}
                onPlus={() => setFreeBonus(freeBonus + 1)}
              />
            </div>
          </div>
        )}
        <div className="text-center text-3xl font-black tabular-nums">{formula}</div>
        {sources.length > 0 && (
          <ul className="text-muted-foreground -mt-2 text-center text-xs">
            {sources.map((s) => (
              <li key={s.label}>
                {s.label}
                {s.flat ? ` ${signed(s.flat)}` : ""}
                {s.dice ? ` +${poolLabel(s.dice)}` : ""}
                {s.hint ? ` — ${s.hint}` : ""}
              </li>
            ))}
          </ul>
        )}
        {d20Roll && (
          <div className="flex justify-center gap-1.5">
            {(["dis", "normal", "adv"] as const).map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={mode === m}
                onClick={() => setMode(m)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-semibold",
                  mode === m &&
                    "border-amber-400 bg-amber-400/10 text-amber-600 dark:text-amber-200",
                )}
              >
                {t(`modes.${m}`)}
              </button>
            ))}
          </div>
        )}
        {/* One way at a time: the switch below picks the app's dice or one's own. */}
        {ownDice ? typing : appButton}
        <button
          type="button"
          role="switch"
          aria-checked={ownDice}
          onClick={() => onOwnDiceChange(!ownDice)}
          className="text-muted-foreground flex items-center gap-2 self-start text-xs"
        >
          <span
            className={cn(
              "relative h-4 w-7 rounded-full transition-colors",
              ownDice ? "bg-(--char,var(--primary))" : "bg-muted",
            )}
          >
            <span
              className={cn(
                "absolute top-0.5 size-3 rounded-full bg-white transition-all",
                ownDice ? "left-3.5" : "left-0.5",
              )}
            />
          </span>
          {t("ownDice")}
        </button>
      </div>
      {tray3d}
    </>
  );
}

function Stepper({
  label,
  value,
  onMinus,
  onPlus,
}: {
  label: string;
  value: string;
  onMinus: () => void;
  onPlus: () => void;
}) {
  return (
    <span className="flex items-center gap-2">
      <span className="text-muted-foreground text-xs">{label}</span>
      <span className="flex items-center rounded-lg border">
        <button
          type="button"
          aria-label={`${label} −`}
          onClick={onMinus}
          className="grid size-8 place-items-center"
        >
          <MinusIcon className="size-3.5" />
        </button>
        <span className="w-8 text-center font-semibold tabular-nums">{value}</span>
        <button
          type="button"
          aria-label={`${label} +`}
          onClick={onPlus}
          className="grid size-8 place-items-center"
        >
          <PlusIcon className="size-3.5" />
        </button>
      </span>
    </span>
  );
}
