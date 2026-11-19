import { useState, type ReactNode } from "react";
import { InfoIcon, PlusIcon, TrendingUpIcon, type LucideIcon } from "lucide-react";
import {
  MAX_LEVEL,
  levelForXp,
  xpForLevel,
  type Ability,
  type Skill,
} from "@adventure-keeper/system-dnd2024";
import { useTranslation } from "react-i18next";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { ItemTag } from "@/systems/dnd2024/lib/equipment-format";
import { signed } from "@/lib/format";
import { cn } from "@/lib/utils";
import { currentLanguage, tr } from "@/i18n";

/**
 * The sheet renders as a dashboard when it has room (`wide`) and as one
 * scrolling column on a phone or in a narrow dialog (`narrow`).
 */
export type SheetVariant = "wide" | "narrow";

/** 0 = untrained, 1 = proficient, 2 = expertise. */
export type Rank = 0 | 1 | 2;

export interface SheetSkill {
  skill: Skill;
  label: string;
  abbr: string;
  modifier: number;
  rank: Rank;
}

export interface SheetAbility {
  ability: Ability;
  label: string;
  abbr: string;
  score: number;
  modifier: number;
  save: number;
  saveProficient: boolean;
  skills: SheetSkill[];
}

export interface SheetVital {
  /** The tile's caption (« CA », « PV max », « PP »). */
  label: string;
  /** Spelled out, for a tooltip and screen readers. */
  title?: string;
  value: ReactNode;
  /** Small text after the value (« d6 »). */
  unit?: string;
  /** Tinted with the character colour: the numbers looked up first. */
  emphasis?: boolean;
  /** What the number already counts (« Vigilant +2 »): a discreet trace, opened on demand. */
  included?: string[];
}

export interface SheetAttack {
  key: string;
  name: string;
  toHit: string;
  damage: string;
  /** Damage type, ability, range… */
  notes: string;
  /** The weapon's mastery, when the character can use it (« Botte : Sape »). */
  mastery?: string;
}

/** « maîtrisée », "proficient" — a skill's rank, for screen readers. */
const rankLabel = (rank: Rank) => tr(`sheet:parts.ranks.${rank}`);

/**
 * A block of the sheet: an uppercase title with its icon, an action (a pencil)
 * on the right, then its body. `todo` outlines a block still to complete (the
 * review of the creation).
 */
export function SheetCard({
  title,
  icon: Icon,
  action,
  todo = false,
  className,
  children,
}: {
  title: ReactNode;
  icon?: LucideIcon;
  action?: ReactNode;
  todo?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Card
      className={cn(
        "gap-0 py-0",
        todo && "outline-2 outline-offset-2 outline-amber-500 outline-dashed",
        className,
      )}
    >
      <CardHeader className="flex items-center gap-2 px-3.5 pt-3">
        <CardTitle className="text-muted-foreground flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1 text-xs font-semibold tracking-wide uppercase">
          {Icon && <Icon className="size-3.5 shrink-0" />}
          {title}
        </CardTitle>
        {action}
      </CardHeader>
      <CardContent className="px-3.5 pt-2 pb-3 text-sm">{children}</CardContent>
    </Card>
  );
}

/** One row of a block, rules between rows; the last one sits on the block's padding. */
export const sheetRow = "border-b py-2 last:border-b-0 last:pb-0";

/** Hollow dot, filled dot, or filled and ringed for expertise. */
export function RankDot({ rank }: { rank: Rank }) {
  return (
    <>
      <span
        aria-hidden
        className={cn(
          "size-2 shrink-0 rounded-full border-[1.5px]",
          rank === 0 ? "border-muted-foreground/60" : "border-(--char) bg-(--char)",
          rank === 2 && "ring-offset-card ring-[1.5px] ring-(--char) ring-offset-2",
        )}
      />
      <span className="sr-only">{rankLabel(rank)}</span>
    </>
  );
}

/**
 * A skill row that opens its explanation. On a phone it also gives the ability
 * it rests on, and a trained skill's modifier takes the character's colour.
 */
export function SkillRow({
  skill,
  variant,
  onView,
}: {
  skill: SheetSkill;
  variant: SheetVariant;
  onView: (skill: Skill) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onView(skill.skill)}
      aria-label={tr("sheet:parts.skillLabel", {
        label: skill.label,
        modifier: signed(skill.modifier),
        rank: rankLabel(skill.rank),
      })}
      className={cn(
        "hover:bg-accent flex w-full items-center gap-2 rounded-md px-1 text-left transition-colors",
        variant === "wide" ? "py-0.5 text-sm" : "py-2",
      )}
    >
      <RankDot rank={skill.rank} />
      <span className={cn("min-w-0 flex-1", skill.rank === 0 && "text-muted-foreground")}>
        {skill.label}
        {variant === "narrow" && (
          <span className="text-muted-foreground ml-1.5 text-xs">{skill.abbr}</span>
        )}
      </span>
      <span
        className={cn(
          "min-w-[2.2em] text-right font-semibold tabular-nums",
          variant === "narrow" && skill.rank > 0 && "text-(--char)",
        )}
      >
        {signed(skill.modifier)}
      </span>
    </button>
  );
}

/** Wide layout: an ability with its saving throw and its skills underneath. */
export function AbilityBlock({
  ability,
  onViewSkill,
}: {
  ability: SheetAbility;
  onViewSkill: (skill: Skill) => void;
}) {
  const { t } = useTranslation("sheet", { keyPrefix: "parts" });
  return (
    <Card className="gap-2 p-3">
      <div className="flex items-center gap-3">
        <div className="bg-muted grid h-11 w-13 shrink-0 place-items-center rounded-lg text-2xl font-bold tabular-nums">
          {signed(ability.modifier)}
        </div>
        <div className="min-w-0">
          <div className="leading-tight font-semibold">{ability.label}</div>
          <div className="text-muted-foreground text-xs tabular-nums">
            {t("score", { score: ability.score })}
          </div>
        </div>
      </div>
      <ul className="grid gap-px">
        <li className="mb-0.5 flex items-center gap-2 border-b px-1 pb-1.5 text-sm">
          <RankDot rank={ability.saveProficient ? 1 : 0} />
          <span
            className={cn(
              "flex-1 font-semibold",
              !ability.saveProficient && "text-muted-foreground",
            )}
          >
            {t("save")}
          </span>
          <span className="min-w-[2.2em] text-right font-semibold tabular-nums">
            {signed(ability.save)}
          </span>
        </li>
        {ability.skills.map((skill) => (
          <li key={skill.skill}>
            <SkillRow skill={skill} variant="wide" onView={onViewSkill} />
          </li>
        ))}
        {ability.skills.length === 0 && (
          <li className="text-muted-foreground px-1 py-0.5 text-xs">{t("noSkill")}</li>
        )}
      </ul>
    </Card>
  );
}

/** Narrow layout: one tile per ability, the saving throw as a pill underneath. */
export function AbilityTile({ ability }: { ability: SheetAbility }) {
  const { t } = useTranslation("sheet", { keyPrefix: "parts" });
  return (
    <div className="bg-muted/40 grid justify-items-center gap-1 rounded-xl border px-1.5 pt-2 pb-1.5">
      <span className="text-muted-foreground text-[11px] font-semibold tracking-wide">
        {ability.abbr}
      </span>
      <span className="text-2xl leading-none font-bold tabular-nums">
        {signed(ability.modifier)}
      </span>
      <span className="text-muted-foreground text-xs tabular-nums">{ability.score}</span>
      <span
        className={cn(
          "rounded-full px-2 text-[11px] tabular-nums",
          ability.saveProficient
            ? "text-foreground bg-[color-mix(in_oklch,var(--char)_22%,var(--card))] font-semibold"
            : "bg-muted text-muted-foreground",
        )}
        title={ability.saveProficient ? t("saveProficient") : t("save")}
      >
        {t("saveShort", { value: signed(ability.save) })}
      </span>
    </div>
  );
}

/**
 * A key number: the value large, its caption under it. When the number already
 * counts a feat or a feature, a small mark opens the list (« Déjà compris »).
 */
export function VitalTile({ vital }: { vital: SheetVital }) {
  const { t } = useTranslation("sheet", { keyPrefix: "parts" });
  const tile = (
    <div
      title={vital.included?.length ? undefined : vital.title}
      className={cn(
        "bg-card relative grid content-center justify-items-center gap-0.5 rounded-xl border px-2 py-2.5 text-center",
        vital.emphasis &&
          "border-[color-mix(in_oklch,var(--char)_35%,var(--border))] bg-[color-mix(in_oklch,var(--char)_9%,var(--card))]",
      )}
    >
      <dd className="order-1 text-2xl leading-tight font-bold whitespace-nowrap tabular-nums">
        {vital.value}
        {vital.unit && <span className="text-base font-semibold">{vital.unit}</span>}
      </dd>
      <dt className="text-muted-foreground order-2 text-[10px] leading-tight font-semibold tracking-wide uppercase">
        {vital.label}
        {vital.title && <span className="sr-only"> ({vital.title})</span>}
      </dt>
      {vital.included?.length ? (
        <InfoIcon aria-hidden className="text-muted-foreground absolute top-1.5 right-1.5 size-3" />
      ) : null}
    </div>
  );
  if (!vital.included?.length) return tile;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          title={vital.title}
          className="grid rounded-xl text-left"
          aria-label={t("includedIn", { label: vital.title ?? vital.label })}
        >
          {tile}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 text-sm" align="start">
        <p className="font-semibold">{t("included")}</p>
        <ul className="text-muted-foreground mt-1 grid gap-0.5">
          {vital.included.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

/** What the attack lines already count (Archerie, Duel…), in one discreet line. */
export function IncludedLine({ items }: { items: string[] }) {
  const { t } = useTranslation("sheet", { keyPrefix: "parts" });
  if (items.length === 0) return null;
  return (
    <p className="text-muted-foreground mt-2 text-xs">
      {t("included")} {items.join(" · ")}
    </p>
  );
}

/** Uppercase caption above a group inside a section. */
export function SheetLabel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p
      className={cn(
        "text-muted-foreground text-[11px] font-semibold tracking-wide uppercase",
        className,
      )}
    >
      {children}
    </p>
  );
}

/**
 * Spell slots as dots, filled while available. Read-only here: they are ticked
 * off in a live session.
 */
export function SlotPips({ count, spent = 0 }: { count: number; spent?: number }) {
  const { t } = useTranslation("sheet", { keyPrefix: "parts" });
  return (
    <span
      className="inline-flex gap-1 align-middle"
      role="img"
      aria-label={t("slots", { count })}
      title={t("slots", { count })}
    >
      {Array.from({ length: count }, (_, index) => (
        <span
          key={index}
          className={cn(
            "size-2.5 rounded-full border-[1.5px] border-(--char)",
            index < count - spent && "bg-(--char)",
          )}
        />
      ))}
    </span>
  );
}

/** The mastery of a weapon, as a small badge next to its name. */
export function MasteryBadge({ children }: { children: ReactNode }) {
  return (
    <Badge
      variant="outline"
      className="border-amber-500/50 px-1.5 py-0 text-[11px] font-medium text-amber-700 dark:text-amber-300"
    >
      {children}
    </Badge>
  );
}

/**
 * A property, mastery or trait of an item. When it has a rule, a tap opens it
 * in a bubble (« Lourde : désavantage si la Force est inférieure à 13 »).
 */
export function ItemTagBadge({ tag }: { tag: ItemTag }) {
  const badge = (
    <Badge
      variant="outline"
      className={cn(
        "px-1.5 py-0 text-[11px] font-normal",
        tag.mastery && "border-amber-500/50 text-amber-700 dark:text-amber-300",
        tag.description && "cursor-help",
      )}
    >
      {tag.label}
    </Badge>
  );
  if (!tag.description) return badge;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" className="rounded-md">
          {badge}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 text-sm" align="start">
        <p className="font-semibold">{tag.label}</p>
        <p className="text-muted-foreground mt-0.5">{tag.description}</p>
      </PopoverContent>
    </Popover>
  );
}

/** One line per attack: name and mastery, damage underneath, the bonus to hit on the right. */
export function AttackList({ attacks }: { attacks: SheetAttack[] }) {
  return (
    <ul>
      {attacks.map((attack) => (
        <li key={attack.key} className={cn("flex items-baseline gap-3", sheetRow)}>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
              <span className="font-semibold">{attack.name}</span>
              {attack.mastery && <MasteryBadge>{attack.mastery}</MasteryBadge>}
            </div>
            <div className="text-muted-foreground text-xs">
              <span className="tabular-nums">{attack.damage}</span>
              {attack.notes && ` · ${attack.notes}`}
            </div>
          </div>
          <span className="font-semibold tabular-nums">{attack.toHit}</span>
        </li>
      ))}
    </ul>
  );
}

/**
 * Level, XP towards the next one, and the owner's XP / level-up controls — one
 * line under the identity: « Niveau 3 · 1 400 / 2 700 XP ━━━━━── [+ XP] [Niveau 4] ».
 */
export function Progression({
  level,
  xp,
  onSetExperience,
  onApplyLevel,
  hideXp = false,
  className,
}: {
  level: number;
  xp: number;
  /** Shown to a companion: the level only, not the XP behind it. */
  hideXp?: boolean;
  onSetExperience?: (xp: number) => void;
  onApplyLevel?: (level: number) => void;
  className?: string;
}) {
  const { t } = useTranslation("sheet", { keyPrefix: "parts" });
  const suggested = levelForXp(xp);
  const floor = xpForLevel(level);
  const next = level < MAX_LEVEL ? xpForLevel(level + 1) : null;
  const ratio = next === null ? 1 : Math.min(1, Math.max(0, (xp - floor) / (next - floor)));

  return (
    <div
      className={cn(
        "text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs",
        className,
      )}
    >
      <span className="flex items-center gap-1 whitespace-nowrap">
        {t("level")} <span className="text-foreground text-sm font-bold tabular-nums">{level}</span>
        {!hideXp && (
          <span className="flex items-center gap-1 tabular-nums">
            {" · "}
            {xp.toLocaleString(currentLanguage())}
            {next !== null && ` / ${next.toLocaleString(currentLanguage())}`} XP
          </span>
        )}
      </span>
      {/* The bar, then adding XP and the level-up right of it: one line, on a phone too. */}
      {!hideXp && (
        <span className="flex min-w-60 flex-1 items-center gap-2">
          <span
            role="progressbar"
            aria-label={t("progress")}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(ratio * 100)}
            className="bg-muted h-1.5 flex-1 overflow-hidden rounded-full"
          >
            <span
              className="block h-full rounded-full bg-(--char)"
              style={{ width: `${ratio * 100}%` }}
            />
          </span>
          {suggested > level && !onApplyLevel && (
            <span className="text-foreground font-medium whitespace-nowrap">
              {t("suggested", { level: suggested })}
            </span>
          )}
          {onSetExperience && <XpAdder xp={xp} onSave={onSetExperience} />}
          {onApplyLevel && level < MAX_LEVEL && (
            <Button
              type="button"
              size="sm"
              // Stands out once the XP reaches the next level.
              variant={suggested > level ? "default" : "outline"}
              className="h-7 px-2.5 text-xs"
              aria-label={t("levelUp", { level: level + 1 })}
              title={t("levelUp", { level: level + 1 })}
              onClick={() => onApplyLevel(level + 1)}
            >
              <TrendingUpIcon className="size-3.5" />
              {t("levelUpShort", { level: level + 1 })}
            </Button>
          )}
        </span>
      )}
    </div>
  );
}

/** « + XP »: an amount added to the total — a negative one takes it back. */
function XpAdder({ xp, onSave }: { xp: number; onSave: (xp: number) => void }) {
  const { t } = useTranslation("sheet", { keyPrefix: "parts" });
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const amount = Math.round(Number(draft) || 0);
  const total = Math.max(0, xp + amount);

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        if (next) setDraft("");
        setOpen(next);
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 px-2.5 text-xs"
          aria-label={t("addXp")}
          title={t("addXp")}
        >
          <PlusIcon className="size-3.5" /> XP
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64" align="end">
        <form
          className="grid gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            onSave(total);
            setOpen(false);
          }}
        >
          <label htmlFor="sheet-xp" className="text-sm font-medium">
            {t("addXp")}
          </label>
          <Input
            id="sheet-xp"
            type="number"
            inputMode="numeric"
            autoFocus
            placeholder="300"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
          />
          <p className="text-muted-foreground text-xs tabular-nums">
            {t("xpTotal", { total: total.toLocaleString(currentLanguage()) })}
          </p>
          <Button type="submit" size="sm" disabled={amount === 0}>
            {t("saveXp")}
          </Button>
        </form>
      </PopoverContent>
    </Popover>
  );
}
