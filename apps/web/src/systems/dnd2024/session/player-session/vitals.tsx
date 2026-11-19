import { useState } from "react";
import { MinusIcon, PlusIcon, SparklesIcon } from "lucide-react";
import type { Dnd2024Character } from "@adventure-keeper/schemas";
import {
  ABILITIES,
  ABILITY_ABBR,
  formatDistance,
  getClass,
} from "@adventure-keeper/system-dnd2024";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { CharacterSheet } from "@/components/character/character-sheet";
import { CropIcon } from "@/components/character/crop-icon";
import { initials, signed } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { WithId } from "@/lib/collections";

/**
 * Hit points with one − and one +. The − takes temporary hit points first,
 * then hit points (the rule for temporary HP); the + heals, up to the maximum.
 */
export function HpStepper({
  current,
  max,
  temp,
  onHitPoints,
  onTemp,
  size = "md",
  onValueClick,
}: {
  current: number;
  max: number;
  temp: number;
  onHitPoints: (value: number) => void;
  onTemp: (value: number) => void;
  size?: "sm" | "md" | "lg";
  /** The number opens a pad (damage, healing, temp HP) instead of being typed in. */
  onValueClick?: () => void;
}) {
  const { t } = useTranslation("session", { keyPrefix: "hud" });
  const clamp = (v: number) => Math.max(0, Math.min(max, v));
  const big = size === "lg";
  const small = size === "sm";
  const button = big ? "size-12" : small ? "size-8" : "size-10";
  return (
    <div className="bg-muted/40 inline-flex items-center overflow-hidden rounded-xl border">
      <button
        type="button"
        aria-label={t("minusHp")}
        onClick={() => (temp > 0 ? onTemp(temp - 1) : onHitPoints(clamp(current - 1)))}
        className={cn("hover:bg-accent grid place-items-center", button)}
      >
        <MinusIcon className={small ? "size-4" : "size-5"} />
      </button>
      {onValueClick ? (
        <button
          type="button"
          onClick={onValueClick}
          aria-label={t("hpPad", { current, max })}
          className="flex items-baseline gap-0.5 px-1 decoration-dotted underline-offset-4 hover:underline"
        >
          <span
            className={cn(
              "font-extrabold tabular-nums",
              big ? "text-2xl" : small ? "text-base" : "text-xl",
            )}
          >
            {current}
          </span>
          <span className="text-muted-foreground text-xs">/ {max}</span>
        </button>
      ) : (
        <label className="flex items-baseline gap-0.5 px-1">
          <span className="sr-only">{t("hpValue")}</span>
          <input
            type="number"
            inputMode="numeric"
            value={current}
            onChange={(e) => onHitPoints(clamp(Number(e.target.value) || 0))}
            className={cn(
              "w-12 bg-transparent text-right font-extrabold tabular-nums outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none",
              big ? "text-2xl" : small ? "text-base" : "text-xl",
            )}
          />
          <span className="text-muted-foreground text-xs">/ {max}</span>
        </label>
      )}
      <button
        type="button"
        aria-label={t("plusHp")}
        onClick={() => onHitPoints(clamp(current + 1))}
        className={cn("hover:bg-accent grid place-items-center", button)}
      >
        <PlusIcon className={small ? "size-4" : "size-5"} />
      </button>
    </div>
  );
}

/** Temporary hit points: a chip, set in a small popover (rarely changed). */
export function TempHpButton({
  temp,
  onTemp,
  short = false,
}: {
  temp: number;
  onTemp: (value: number) => void;
  short?: boolean;
}) {
  const { t } = useTranslation("session", { keyPrefix: "sheet.hud" });
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={t("tempHpEdit", { value: temp })}
          className={cn(
            "rounded-full border border-dashed px-2.5 py-0.5 text-xs font-semibold tabular-nums",
            temp > 0
              ? "border-sky-400 bg-sky-400/10 text-sky-500 dark:text-sky-300"
              : "text-muted-foreground",
          )}
        >
          {temp > 0
            ? `+${temp}${short ? "" : ` ${t("tempHp")}`}`
            : short
              ? "+0"
              : `+ ${t("tempHp")}`}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-56">
        <div className="text-sm font-medium">{t("tempHpTitle")}</div>
        <p className="text-muted-foreground mt-1 text-xs">{t("tempHpHint")}</p>
        <div className="mt-3 flex items-center justify-center gap-3">
          <Button
            type="button"
            size="icon"
            variant="outline"
            aria-label={t("minusTemp")}
            disabled={temp <= 0}
            onClick={() => onTemp(Math.max(0, temp - 1))}
          >
            <MinusIcon />
          </Button>
          <span className="w-10 text-center text-xl font-bold tabular-nums">{temp}</span>
          <Button
            type="button"
            size="icon"
            variant="outline"
            aria-label={t("plusTemp")}
            onClick={() => onTemp(temp + 1)}
          >
            <PlusIcon />
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** Hit points in red, temporary hit points after them in blue. */
export function HpBar({
  current,
  max,
  temp,
  className,
}: {
  current: number;
  max: number;
  temp: number;
  className?: string;
}) {
  const total = Math.max(1, max + temp);
  return (
    <div className={cn("bg-muted flex h-2 overflow-hidden rounded-full", className)}>
      <div
        className="bg-destructive transition-[width]"
        style={{ width: `${(Math.max(0, current) / total) * 100}%` }}
      />
      <div
        className="bg-sky-400 transition-[width]"
        style={{ width: `${(temp / total) * 100}%` }}
      />
    </div>
  );
}

/** Armour class, initiative, speed, passive Perception: the numbers asked for most. */
export function KeyStats({
  character,
  className,
}: {
  character: Dnd2024Character;
  className?: string;
}) {
  const { t } = useTranslation("session", { keyPrefix: "sheet.hud" });
  const armorClass = character.armorClass ?? 10 + character.abilityModifiers.dex;
  const stats = [
    { label: t("ac"), value: armorClass, hint: t("acHint") },
    {
      label: t("init"),
      value: signed(character.initiativeBonus ?? character.abilityModifiers.dex),
      hint: t("initHint"),
    },
    { label: t("speed"), value: formatDistance(character.speed ?? 30), hint: t("speedHint") },
    { label: t("pp"), value: character.passivePerception, hint: t("ppHint") },
  ];
  return (
    <dl className={cn("grid grid-cols-4", className)}>
      {stats.map((stat) => (
        <Tooltip key={stat.label}>
          <TooltipTrigger asChild>
            <div className="cursor-help py-1 text-center">
              <dd className="text-lg font-bold tabular-nums">{stat.value}</dd>
              <dt className="text-muted-foreground text-[10px] font-medium tracking-wide uppercase">
                {stat.label}
              </dt>
            </div>
          </TooltipTrigger>
          <TooltipContent>{stat.hint}</TooltipContent>
        </Tooltip>
      ))}
    </dl>
  );
}

/** Portrait, name and class; a tap opens the full sheet. */
export function CharacterIdentity({
  character,
  size = 40,
}: {
  character: WithId<Dnd2024Character>;
  size?: number;
}) {
  const { t } = useTranslation("session", { keyPrefix: "sheet.hud" });
  const [open, setOpen] = useState(false);
  const klass = getClass(character.classId);
  return (
    <>
      <button
        type="button"
        className="hover:bg-accent -m-1 flex min-w-0 flex-1 items-center gap-2.5 rounded-lg p-1 text-left"
        onClick={() => setOpen(true)}
        aria-label={t("openSheet")}
      >
        <CropIcon
          imageUrl={character.imageUrl}
          crop={character.imageCrop}
          color={character.color}
          fallback={initials(character.name)}
          size={size}
        />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold">{character.name}</span>
          <span className="text-muted-foreground block truncate text-xs">
            {t("level", { level: character.level ?? 1 })}
            {klass ? ` · ${klass.name}` : ""}
          </span>
        </span>
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] max-w-5xl overflow-y-auto xl:max-w-6xl">
          <DialogHeader className="sr-only">
            <DialogTitle>{character.name}</DialogTitle>
          </DialogHeader>
          <CharacterSheet character={character} />
        </DialogContent>
      </Dialog>
    </>
  );
}

/**
 * Heroic Inspiration. Held → a glowing amber pill so the player can't miss it;
 * not held → a discreet icon (still a toggle).
 */
export function InspirationToggle({ active, onToggle }: { active: boolean; onToggle: () => void }) {
  const { t } = useTranslation("session", { keyPrefix: "sheet.hud" });
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          size={active ? "sm" : "icon"}
          variant={active ? "default" : "ghost"}
          className={cn(
            "shrink-0",
            active
              ? "h-7 gap-1 border border-amber-300 bg-amber-400 px-2 text-xs font-semibold text-amber-950 shadow-[0_0_12px_2px_rgba(251,191,36,0.65)] hover:bg-amber-300 hover:text-amber-950"
              : "text-muted-foreground size-8",
          )}
          aria-label={t("inspiration")}
          aria-pressed={active}
          onClick={onToggle}
        >
          <SparklesIcon
            className={cn("size-4", active && "fill-amber-950/30 motion-safe:animate-pulse")}
          />
          {active && t("inspired")}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{active ? t("inspirationOn") : t("inspirationOff")}</TooltipContent>
    </Tooltip>
  );
}

/** The six abilities, modifier first: what the header shows above the tabs. */
export function AbilityScores({
  character,
  className,
}: {
  character: Dnd2024Character;
  className?: string;
}) {
  return (
    <dl className={cn("grid grid-cols-6 gap-1", className)}>
      {ABILITIES.map((ability) => (
        <div key={ability} className="bg-muted/40 rounded-lg border px-1 py-1 text-center">
          <dt className="text-muted-foreground text-[10px] font-medium uppercase">
            {ABILITY_ABBR[ability]}
          </dt>
          <dd className="text-sm font-bold tabular-nums">
            {signed(character.abilityModifiers[ability])}
          </dd>
          <dd className="text-muted-foreground text-[10px] tabular-nums">
            {character.adjustedAbilityScores[ability]}
          </dd>
        </div>
      ))}
    </dl>
  );
}
