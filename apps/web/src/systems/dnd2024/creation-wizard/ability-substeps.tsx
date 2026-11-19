import { useState, type DragEvent } from "react";
import { CheckIcon, DicesIcon, MinusIcon, PlusIcon, RotateCcwIcon, StarIcon } from "lucide-react";
import {
  ABILITIES,
  ABILITY_LABELS,
  ABILITY_METHODS,
  ABILITY_METHOD_LABELS,
  ABILITY_SUMMARY,
  POINT_BUY_BUDGET,
  STANDARD_ARRAY,
  SKILL_LABELS,
  evaluatePointBuy,
  methodAssignsFromPool,
  pointBuyCost,
  rollAbilityScore,
  type Ability,
  type AbilityMethod,
  type BackgroundDef,
  type CharacterDerived,
  type ClassDef,
} from "@adventure-keeper/system-dnd2024";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EMPTY_BONUSES, EMPTY_SCORES } from "@/systems/dnd2024/components/ability-scores";
import type { FormState, SetForm } from "@/systems/dnd2024/character-form/state";
import { Panel } from "@/systems/dnd2024/creation-wizard/fixed-substeps";
import { DiceTray, type TrayRoll } from "@/components/session/dice-tray";
import { signed } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Step 4, cut in four: the method, the six values, the background's bonuses,
 * then what follows from them. Values and bonuses are **tokens** placed on the
 * six abilities — click a token then an ability, or drag it there.
 */

const modOf = (score: number) => Math.floor((score - 10) / 2);

export function MethodStep({
  method,
  onChange,
  onConfirm,
}: {
  method: AbilityMethod;
  onChange: (method: AbilityMethod) => void;
  /** A double click picks the method and moves on. */
  onConfirm?: () => void;
}) {
  const { t } = useTranslation("wizard", { keyPrefix: "abilities" });
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(14rem,1fr))] gap-2.5">
      {ABILITY_METHODS.map((option) => (
        <button
          key={option}
          type="button"
          aria-pressed={method === option}
          onClick={() => onChange(option)}
          onDoubleClick={() => {
            onChange(option);
            onConfirm?.();
          }}
          className={cn(
            "hover:bg-accent flex flex-col gap-1.5 rounded-xl border p-4 text-left transition-colors",
            method === option && "border-primary bg-accent ring-primary ring-1",
          )}
        >
          <span className="flex items-center justify-between font-medium">
            {ABILITY_METHOD_LABELS[option]}
            {method === option && (
              <CheckIcon className="size-4 text-emerald-600 dark:text-emerald-400" />
            )}
          </span>
          <span className="text-muted-foreground text-xs leading-snug">
            {t(`hints.${option}`, { budget: POINT_BUY_BUDGET })}
          </span>
        </button>
      ))}
    </div>
  );
}

// --- Tokens & slots ----------------------------------------------------------

interface Token {
  value: number;
  /** Position in the tray, so two identical tokens stay distinct. */
  index: number;
}

function TokenTray({
  tokens,
  label,
  selected,
  onSelect,
}: {
  tokens: number[];
  label: (value: number) => string;
  selected: Token | null;
  onSelect: (token: Token | null) => void;
}) {
  const { t } = useTranslation("wizard", { keyPrefix: "abilities" });
  return (
    <div className="bg-muted/50 flex min-h-16 flex-wrap items-center gap-2.5 rounded-xl px-3.5 py-2.5">
      {tokens.map((value, index) => {
        const active = selected?.index === index;
        return (
          <button
            key={index}
            type="button"
            draggable
            onDragStart={(event) => event.dataTransfer.setData("text/plain", String(value))}
            aria-pressed={active}
            onClick={() => onSelect(active ? null : { value, index })}
            className={cn(
              "border-primary bg-card grid size-13 cursor-grab place-items-center rounded-full border-2 type-title tabular-nums shadow-sm transition-transform",
              active && "bg-primary text-primary-foreground -translate-y-1",
            )}
          >
            {label(value)}
          </button>
        );
      })}
      <span className="text-muted-foreground text-xs">
        {tokens.length === 0 ? t("trayDone") : selected ? t("traySelected") : t("trayIdle")}
      </span>
    </div>
  );
}

function AbilitySlot({
  ability,
  primary,
  shown,
  control,
  footer,
  targeted,
  disabled,
  onClick,
  onDrop,
}: {
  ability: Ability;
  primary: boolean;
  shown: string | null;
  control?: React.ReactNode;
  footer: React.ReactNode;
  targeted: boolean;
  disabled?: boolean;
  onClick?: () => void;
  onDrop?: (value: number) => void;
}) {
  const [over, setOver] = useState(false);
  const dropProps = onDrop
    ? {
        onDragOver: (event: DragEvent) => {
          event.preventDefault();
          setOver(true);
        },
        onDragLeave: () => setOver(false),
        onDrop: (event: DragEvent) => {
          event.preventDefault();
          setOver(false);
          const value = Number(event.dataTransfer.getData("text/plain"));
          if (Number.isFinite(value)) onDrop(value);
        },
      }
    : {};
  const { t } = useTranslation("wizard", { keyPrefix: "abilities" });
  const body = (
    <>
      <span className="text-sm font-medium">
        {ABILITY_LABELS[ability]}
        {primary && (
          <span className="ml-1 inline-flex items-center gap-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
            <StarIcon className="size-3 fill-current" />
            {t("primary")}
          </span>
        )}
      </span>
      {control ?? (
        <span
          className={cn(
            "row-span-2 grid size-15 place-items-center rounded-full border-2 border-dashed type-title tabular-nums",
            shown !== null && "border-primary border-solid",
          )}
        >
          {shown}
        </span>
      )}
      <span className="text-muted-foreground text-xs leading-snug">{ABILITY_SUMMARY[ability]}</span>
      <span className="text-muted-foreground col-span-2 mt-auto flex justify-between gap-2 text-xs tabular-nums">
        {footer}
      </span>
    </>
  );
  const className = cn(
    "bg-card grid min-h-32 grid-cols-[1fr_auto] content-start gap-x-3 gap-y-1 rounded-xl border p-3.5 text-left",
    targeted && !disabled && "border-primary border-dashed",
    over && "bg-accent",
    disabled && "opacity-45",
  );
  return onClick ? (
    <button
      type="button"
      className={className}
      disabled={disabled}
      onClick={onClick}
      {...dropProps}
    >
      {body}
    </button>
  ) : (
    <div className={className}>{body}</div>
  );
}

// --- Values ------------------------------------------------------------------

export function ValuesStep({
  state,
  set,
  klass,
  method,
  rolled,
  setRolled,
}: {
  state: FormState;
  set: SetForm;
  klass?: ClassDef;
  method: AbilityMethod;
  rolled: number[];
  setRolled: (rolled: number[]) => void;
}) {
  const { t } = useTranslation("wizard", { keyPrefix: "abilities" });
  const [selected, setSelected] = useState<Token | null>(null);
  const [tray, setTray] = useState<TrayRoll | null>(null);
  const fromPool = methodAssignsFromPool(method);
  const pool = method === "standardArray" ? [...STANDARD_ARRAY] : rolled;

  // Tokens still in the tray: the pool minus what sits on an ability.
  const free = [...pool].sort((a, b) => b - a);
  for (const ability of ABILITIES) {
    const value = state.base[ability];
    const index = value === null ? -1 : free.indexOf(value);
    if (index >= 0) free.splice(index, 1);
  }

  function place(ability: Ability, value: number) {
    set("base", { ...state.base, [ability]: value });
    setSelected(null);
  }

  function rollOne() {
    const { rolls, droppedIndex, total } = rollAbilityScore();
    setRolled([...rolled, total]);
    setTray({
      seq: rolled.length + 1,
      label: t("rollLabel", { index: rolled.length + 1 }),
      dice: rolls.map((value, index) => ({
        kind: "d6" as const,
        value,
        faded: index === droppedIndex,
      })),
      total,
      detail: t("rollDetail", { rolls: rolls.join(" · "), dropped: rolls[droppedIndex] }),
    });
  }

  const pointBuy =
    method === "pointBuy" && ABILITIES.every((ability) => state.base[ability] !== null)
      ? evaluatePointBuy(state.base as Record<Ability, number>)
      : null;

  return (
    <div className="flex flex-col gap-4">
      {method === "roll" && (
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" size="sm" onClick={rollOne} disabled={rolled.length >= 6}>
            <DicesIcon /> {t("roll")}
          </Button>
          <span className="rounded-full border px-2 text-xs tabular-nums">{rolled.length} / 6</span>
          {rolled.length > 0 && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                setRolled([]);
                set("base", { ...EMPTY_SCORES });
              }}
            >
              <RotateCcwIcon /> {t("rerollAll")}
            </Button>
          )}
        </div>
      )}
      {fromPool && (pool.length > 0 || method !== "roll") && (
        <TokenTray tokens={free} label={String} selected={selected} onSelect={setSelected} />
      )}
      {method === "pointBuy" && (
        <p className="text-sm">
          <span
            className={cn(
              "rounded-full border px-2.5 py-0.5 text-xs font-medium tabular-nums",
              pointBuy?.withinBudget
                ? "border-emerald-600 bg-emerald-600 text-white"
                : "bg-destructive border-destructive text-white",
            )}
          >
            {t("points", { total: pointBuy?.total ?? 0, budget: POINT_BUY_BUDGET })}
          </span>
          <span className="text-muted-foreground ml-2 text-xs">
            {t("cost")}{" "}
            {[8, 9, 10, 11, 12, 13, 14, 15]
              .map((score) => `${score}→${pointBuyCost(score)}`)
              .join(", ")}
          </span>
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 @3xl:grid-cols-3">
        {ABILITIES.map((ability) => {
          const value = state.base[ability];
          const footer = (
            <>
              <span>{t("suggested", { value: klass ? klass.suggestedScores[ability] : "–" })}</span>
              <span>
                {t("mod")}{" "}
                <span className="font-medium text-foreground">
                  {value === null ? "–" : signed(modOf(value))}
                </span>
              </span>
            </>
          );
          const primary = klass?.primaryAbility.includes(ability) ?? false;

          if (method === "pointBuy") {
            const score = value ?? 8;
            return (
              <AbilitySlot
                key={ability}
                ability={ability}
                primary={primary}
                shown={null}
                targeted={false}
                footer={footer}
                control={
                  <span className="row-span-2 flex items-center gap-1.5">
                    <Button
                      type="button"
                      size="icon"
                      variant="outline"
                      className="size-7"
                      aria-label={t("lower", { ability: ABILITY_LABELS[ability] })}
                      disabled={score <= 8}
                      onClick={() => set("base", { ...state.base, [ability]: score - 1 })}
                    >
                      <MinusIcon />
                    </Button>
                    <span className="type-title w-7 text-center tabular-nums">{score}</span>
                    <Button
                      type="button"
                      size="icon"
                      variant="outline"
                      className="size-7"
                      aria-label={t("raise", { ability: ABILITY_LABELS[ability] })}
                      disabled={score >= 15}
                      onClick={() => set("base", { ...state.base, [ability]: score + 1 })}
                    >
                      <PlusIcon />
                    </Button>
                  </span>
                }
              />
            );
          }
          if (method === "manual") {
            return (
              <AbilitySlot
                key={ability}
                ability={ability}
                primary={primary}
                shown={null}
                targeted={false}
                footer={footer}
                control={
                  <Input
                    type="number"
                    min={3}
                    max={20}
                    aria-label={ABILITY_LABELS[ability]}
                    className="type-heading row-span-2 h-12 w-18 text-center"
                    value={value ?? ""}
                    onChange={(event) => {
                      const parsed = Number.parseInt(event.target.value, 10);
                      set("base", {
                        ...state.base,
                        [ability]: Number.isFinite(parsed)
                          ? Math.min(20, Math.max(3, parsed))
                          : null,
                      });
                    }}
                  />
                }
              />
            );
          }
          return (
            <AbilitySlot
              key={ability}
              ability={ability}
              primary={primary}
              shown={value === null ? null : String(value)}
              targeted={selected !== null}
              footer={footer}
              onClick={() => {
                if (selected) place(ability, selected.value);
                else if (value !== null) set("base", { ...state.base, [ability]: null });
                // An empty slot with no token picked takes the best one left.
                else if (free.length > 0) place(ability, free[0]);
              }}
              onDrop={(dropped) => place(ability, dropped)}
            />
          );
        })}
      </div>

      {/* The suggested scores are a standard-array spread, which also costs the
          full point-buy budget: valid for every method but the dice. */}
      {method !== "roll" && klass && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="self-start"
          onClick={() => set("base", { ...klass.suggestedScores })}
        >
          {t("useSuggested", { class: klass.name })}
        </Button>
      )}
      <DiceTray roll={tray} onClose={() => setTray(null)} />
    </div>
  );
}

// --- Background bonuses ------------------------------------------------------

type BonusMode = "21" | "111";

export function BonusStep({
  state,
  set,
  klass,
  background,
}: {
  state: FormState;
  set: SetForm;
  klass?: ClassDef;
  background?: BackgroundDef;
}) {
  const { t } = useTranslation("wizard", { keyPrefix: "abilities" });
  const placed = ABILITIES.filter((ability) => state.bonuses[ability]);
  const [mode, setMode] = useState<BonusMode>(() => (placed.length === 3 ? "111" : "21"));
  const [selected, setSelected] = useState<Token | null>(null);
  const allowed = background?.abilityOptions ?? [];
  const values = placed.map((ability) => state.bonuses[ability]);
  const free =
    mode === "21"
      ? [2, 1].filter((value) => !values.includes(value))
      : Array(Math.max(0, 3 - placed.length)).fill(1);

  function place(ability: Ability, value: number) {
    if (!allowed.includes(ability)) return;
    const next = { ...state.bonuses };
    if (mode === "21") {
      for (const other of ABILITIES) if (next[other] === value) next[other] = 0;
      next[ability] = value;
    } else if (!next[ability] && placed.length < 3) {
      next[ability] = 1;
    }
    set("bonuses", next);
    setSelected(null);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-1.5">
        {(["21", "111"] as const).map((option) => (
          <Button
            key={option}
            type="button"
            size="sm"
            className="rounded-full"
            variant={mode === option ? "default" : "outline"}
            aria-pressed={mode === option}
            onClick={() => {
              setMode(option);
              setSelected(null);
              set("bonuses", { ...EMPTY_BONUSES });
            }}
          >
            {option === "21" ? "+2 / +1" : "+1 / +1 / +1"}
          </Button>
        ))}
      </div>
      <TokenTray
        tokens={free}
        label={(value) => `+${value}`}
        selected={selected}
        onSelect={setSelected}
      />
      <div className="grid grid-cols-2 gap-3 @3xl:grid-cols-3">
        {ABILITIES.map((ability) => {
          const base = state.base[ability];
          const bonus = state.bonuses[ability] || 0;
          const total = base === null ? null : base + bonus;
          const offered = allowed.includes(ability);
          return (
            <AbilitySlot
              key={ability}
              ability={ability}
              primary={klass?.primaryAbility.includes(ability) ?? false}
              shown={bonus ? `+${bonus}` : null}
              targeted={selected !== null}
              // A bonus left by another background stays clickable, to take it back.
              disabled={!offered && !bonus}
              footer={
                offered ? (
                  <>
                    <span>
                      {base ?? "–"}
                      {bonus ? ` + ${bonus}` : ""}
                    </span>
                    <span>
                      {t("total")}{" "}
                      <span className="font-medium text-foreground">{total ?? "–"}</span>
                      {total !== null && ` (${signed(modOf(total))})`}
                    </span>
                  </>
                ) : (
                  <>
                    <span>
                      {t("notOffered", { background: background?.name ?? t("theBackground") })}
                    </span>
                    <span>{total ?? "–"}</span>
                  </>
                )
              }
              onClick={() => {
                if (selected) place(ability, selected.value);
                else if (bonus) set("bonuses", { ...state.bonuses, [ability]: 0 });
                else if (free.length > 0) place(ability, free[0]);
              }}
              onDrop={(dropped) => place(ability, dropped)}
            />
          );
        })}
      </div>
    </div>
  );
}

// --- Recap -------------------------------------------------------------------

export function RecapStep({
  derived,
  klass,
  level,
}: {
  derived: CharacterDerived | null;
  klass: ClassDef;
  level: number;
}) {
  const { t } = useTranslation("wizard", { keyPrefix: "abilities" });
  if (!derived) {
    return <p className="text-muted-foreground text-sm">{t("fillFirst")}</p>;
  }
  return (
    <div className="flex flex-col gap-4">
      {/* The six numbers that follow, all as tiles; the saving throws are on the sheet. */}
      <div className="grid grid-cols-3 gap-2.5">
        {[
          [t("maxHp"), derived.maxHitPoints],
          [t("ac"), derived.armorClass],
          [t("proficiency"), signed(derived.proficiencyBonus)],
          [t("initiative"), signed(derived.initiativeBonus)],
          [t("passivePerception"), derived.passivePerception],
          [t("hitDice"), `${level}d${klass.hitDie}`],
        ].map(([label, value]) => (
          <div
            key={label}
            className="bg-card flex flex-col items-center rounded-xl border px-2 py-3 text-center"
          >
            <span className="type-figure">{value}</span>
            <span className="type-label">{label}</span>
          </div>
        ))}
      </div>
      <Panel title={t("proficientSkills")}>
        <div className="flex flex-wrap gap-1.5">
          {derived.proficientSkills.map((skill) => (
            <span key={skill} className="bg-muted rounded-full border px-2.5 py-0.5 text-xs">
              {SKILL_LABELS[skill]} {signed(derived.skillModifiers[skill])}
            </span>
          ))}
        </div>
      </Panel>
    </div>
  );
}
