import { useState, type ComponentProps, type ReactNode } from "react";
import { PlusIcon, SearchIcon, SparklesIcon } from "lucide-react";
import type {
  AdventureParticipant,
  AdventureParticipantPlayerUpdate,
  Dnd2024Character,
} from "@adventure-keeper/schemas";
import type { DicePool, SpellDef } from "@adventure-keeper/system-dnd2024";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pips } from "@/systems/dnd2024/session/player-sheet/pips";
import { useStoredFlag } from "@/hooks/use-stored-flag";
import { signed } from "@/lib/format";
import {
  combatSpells,
  initiativeModifier,
  initiativeRoll,
  limitedFeatures,
  saveRows,
  searchSkills,
  skillRows,
  weaponActions,
  type RollSpec,
} from "@/systems/dnd2024/lib/player-actions";
import { useSpells } from "@/systems/dnd2024/lib/spells";
import { cn } from "@/lib/utils";

const ECONOMY = ["action", "bonus", "reaction", "move"] as const;
type Economy = (typeof ECONOMY)[number];

function SectionTitle({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <h3 className="text-muted-foreground flex-1 text-xs font-semibold tracking-wide uppercase">
        {children}
      </h3>
      {aside}
    </div>
  );
}

/** One line to tap: what it is on the left, what it rolls on the right. */
function RollRow({
  title,
  subtitle,
  value,
  tag,
  onClick,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  value: ReactNode;
  tag?: ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className="hover:bg-accent/60 flex w-full items-center gap-3 px-3 py-2.5 text-left disabled:cursor-default disabled:hover:bg-transparent"
    >
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="truncate text-sm font-semibold">{title}</span>
          {tag}
        </span>
        {subtitle && (
          <span className="text-muted-foreground block truncate text-xs">{subtitle}</span>
        )}
      </span>
      <span className="text-muted-foreground shrink-0 text-sm font-semibold whitespace-nowrap tabular-nums">
        {value}
      </span>
    </button>
  );
}

/** A pill to tap: « Utiliser », « ✦ Disponible »… */
function Chip({ children, tone, ...props }: ComponentProps<"button"> & { tone?: "on" | "used" }) {
  return (
    <button
      type="button"
      className={cn(
        "bg-muted/40 shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap disabled:cursor-default",
        tone === "on" && "border-amber-400/60 bg-amber-400/10 text-amber-700 dark:text-amber-200",
        tone === "used" && "line-through opacity-45",
      )}
      {...props}
    >
      {children}
    </button>
  );
}

function Tag({ children, tone }: { children: ReactNode; tone?: "concentration" }) {
  return (
    <span
      className={cn(
        "rounded border px-1.5 text-[10px] font-semibold uppercase",
        tone === "concentration"
          ? "border-violet-400/50 text-violet-600 dark:text-violet-300"
          : "text-muted-foreground",
      )}
    >
      {children}
    </span>
  );
}

/** 2024: DC 10 or half the damage taken, whichever is higher, up to 30. */
const concentrationDc = (damage: number) => Math.min(30, Math.max(10, Math.floor(damage / 2)));

/**
 * The spell the character is concentrating on, above the sheet's tabs: any
 * damage — temporary hit points included, they are damage taken all the same —
 * calls for a Constitution save, whose DC it gives and which a tap rolls;
 * « Rompre » ends it.
 */
export function ConcentrationBanner({
  character,
  participant,
  pool,
  onParticipantStateChange,
  onRoll,
}: {
  character: Dnd2024Character;
  participant: AdventureParticipant;
  /** Current hit points and temporary hit points, watched for damage. */
  pool: { hitPoints: number; temp: number };
  onParticipantStateChange: (patch: AdventureParticipantPlayerUpdate) => void;
  onRoll: (spec: RollSpec) => void;
}) {
  const { t } = useTranslation("session", { keyPrefix: "player.concentrating" });
  const concentration = participant.concentration;
  const [damage, setDamage] = useState<number | null>(null);
  const [hintSeen, setHintSeen] = useStoredFlag("session-concentration-hint-seen", false);
  const [seen, setSeen] = useState(pool);
  if (pool.hitPoints !== seen.hitPoints || pool.temp !== seen.temp) {
    setSeen(pool);
    // What either pool lost while concentrating: the save is due (several hits add up).
    const lost = Math.max(0, seen.hitPoints - pool.hitPoints) + Math.max(0, seen.temp - pool.temp);
    if (concentration && lost > 0) setDamage((damage ?? 0) + lost);
  }
  if (!concentration) return null;

  const con = saveRows(character).find((row) => row.ability === "con")!;
  function end() {
    setDamage(null);
    onParticipantStateChange({ concentration: null });
  }
  return (
    <section
      className={cn(
        "flex flex-col gap-2 rounded-xl border px-3 py-2.5 text-sm",
        damage ? "border-amber-500/60 bg-amber-500/10" : "border-violet-400/50 bg-violet-500/5",
      )}
      aria-live="polite"
    >
      <div className="flex items-center gap-2">
        <span className="min-w-0 flex-1">
          {t("on")} <b>{concentration.label}</b>
        </span>
        <Button type="button" size="sm" variant="outline" className="h-7" onClick={end}>
          {t("end")}
        </Button>
      </div>
      {damage ? (
        <div className="flex flex-col gap-1.5">
          <span className="text-amber-800 dark:text-amber-200">
            {t("damaged", { damage, dc: concentrationDc(damage) })}
          </span>
          <Button
            type="button"
            size="sm"
            className="w-full"
            onClick={() => {
              setDamage(null);
              onRoll({
                label: t("save", { dc: concentrationDc(damage) }),
                kind: "sauvegarde",
                bonus: con.modifier,
                ctx: { character, saveAbility: "con" },
                dc: concentrationDc(damage),
                concentration: true,
              });
            }}
          >
            {t("roll", { modifier: signed(con.modifier) })}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="w-full"
            onClick={() => setDamage(null)}
          >
            {t("dismiss")}
          </Button>
        </div>
      ) : (
        !hintSeen && (
          <p className="text-muted-foreground flex items-center gap-2 text-xs">
            <span className="flex-1">{t("hint")}</span>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-6 px-2 text-xs"
              onClick={() => setHintSeen(true)}
            >
              {t("ok")}
            </Button>
          </p>
        )
      )}
    </section>
  );
}

/**
 * What a turn allows — action, bonus action, reaction, movement — ticked off as
 * the player uses them. Kept on this screen only; a new turn clears it.
 */
export function ActionEconomy({ turnKey }: { turnKey: string }) {
  const { t } = useTranslation("session", { keyPrefix: "player.economy" });
  const [used, setUsed] = useState<{ key: string; set: Set<Economy> }>({
    key: turnKey,
    set: new Set(),
  });
  // A new turn starts with everything available again.
  const current = used.key === turnKey ? used.set : new Set<Economy>();
  function toggle(item: Economy) {
    const next = new Set(current);
    if (next.has(item)) next.delete(item);
    else next.add(item);
    setUsed({ key: turnKey, set: next });
  }
  return (
    <section className="flex flex-col gap-2">
      <SectionTitle>{t("title")}</SectionTitle>
      <div className="flex flex-wrap gap-1.5">
        {ECONOMY.map((item) => (
          <button
            key={item}
            type="button"
            aria-pressed={current.has(item)}
            onClick={() => toggle(item)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-semibold",
              current.has(item) && "text-muted-foreground line-through opacity-50",
            )}
          >
            {t(item)}
          </button>
        ))}
      </div>
    </section>
  );
}

/**
 * « Jet d'initiative »: a tap rolls d20 + the modifier; the total waits on the
 * participant for the GM's combat setup, which fills it in.
 */
export function InitiativeRow({
  character,
  participant,
  onRoll,
}: {
  character: Dnd2024Character;
  participant: AdventureParticipant;
  onRoll: (spec: RollSpec) => void;
}) {
  const { t } = useTranslation("session", { keyPrefix: "player.initiative" });
  const rolled = participant.initiativeRoll;
  return (
    <section className="flex flex-col gap-2">
      <div className="bg-card overflow-hidden rounded-xl border">
        <RollRow
          title={t("title")}
          subtitle={rolled != null ? t("sent", { total: rolled }) : t("hint")}
          value={<span className="text-foreground">{signed(initiativeModifier(character))}</span>}
          onClick={() => onRoll(initiativeRoll(character))}
        />
      </div>
    </section>
  );
}

/** The weapon attacks: a tap opens the attack roll, then the damage. */
export function AttackList({
  character,
  onRoll,
}: {
  character: Dnd2024Character;
  onRoll: (spec: RollSpec) => void;
}) {
  const { t } = useTranslation("session", { keyPrefix: "player" });
  const attacks = weaponActions(character);
  return (
    <section className="flex flex-col gap-2">
      <SectionTitle>{t("attacks")}</SectionTitle>
      {attacks.length === 0 ? (
        <p className="text-muted-foreground text-sm">{t("noAttack")}</p>
      ) : (
        <div className="bg-card divide-y overflow-hidden rounded-xl border">
          {attacks.map((attack) => (
            <RollRow
              key={attack.id}
              title={attack.name}
              subtitle={attack.info}
              tag={attack.bonusAction && <Tag>{t("bonusAction")}</Tag>}
              value={
                <>
                  <span className="text-foreground">{signed(attack.attackBonus)}</span> ·{" "}
                  {attack.damageLabel}
                </>
              }
              onClick={() => onRoll(attack.roll)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

/** Spell slots by level, ticked off as they are spent. */
export function SpellSlots({
  character,
  participant,
  onParticipantStateChange,
}: {
  character: Dnd2024Character;
  participant: AdventureParticipant;
  onParticipantStateChange: (patch: AdventureParticipantPlayerUpdate) => void;
}) {
  const { t } = useTranslation("session", { keyPrefix: "sheet.spells" });
  const used = participant.spellSlotsUsed ?? {};
  const slots = character.spellSlots as Record<string, number> | undefined;
  const levels = Object.keys(slots ?? {})
    .map(Number)
    .filter((n) => (slots?.[String(n)] ?? 0) > 0)
    .sort((a, b) => a - b);
  const set = (key: string, value: number) =>
    onParticipantStateChange({ spellSlotsUsed: { ...used, [key]: value } });
  if (levels.length === 0 && !character.pactMagic) return null;
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
      {levels.map((level) => (
        <span key={level} className="flex items-center gap-1.5">
          <span className="text-muted-foreground">{t("slotLevel", { level })}</span>
          <Pips
            total={slots![String(level)]}
            filled={used[String(level)] ?? 0}
            label={t("slotsSpent", { level })}
            onChange={(value) => set(String(level), value)}
          />
        </span>
      ))}
      {character.pactMagic && (
        <span className="flex items-center gap-1.5">
          <span className="text-muted-foreground">
            {t("pact", { level: character.pactMagic.level })}
          </span>
          <Pips
            total={character.pactMagic.count}
            filled={used.pact ?? 0}
            label={t("pactSpent")}
            onChange={(value) => set("pact", value)}
          />
        </span>
      )}
    </div>
  );
}

/**
 * The spells a fight calls for, after the attacks: a tap rolls the spell
 * attack (its damage after a hit) or the damage. The full list is in « Sorts ».
 */
export function CombatSpellList({
  character,
  slots,
  onRoll,
  onCast,
}: {
  character: Dnd2024Character;
  slots: ReactNode;
  onRoll: (spec: RollSpec) => void;
  /** A spell of level 1+: pick its slot first (it spends it), then roll. */
  onCast: (spell: SpellDef) => void;
}) {
  const { t } = useTranslation("session", { keyPrefix: "player" });
  const catalogue = useSpells(true);
  if (!catalogue) return null;
  const spells = combatSpells(character, catalogue);
  if (spells.length === 0) return null;
  return (
    <section className="flex flex-col gap-2">
      <SectionTitle>{t("spells")}</SectionTitle>
      {slots}
      <div className="bg-card divide-y overflow-hidden rounded-xl border">
        {spells.map((spell) => (
          <RollRow
            key={spell.id}
            title={spell.name}
            subtitle={spell.info}
            tag={
              <>
                <Tag>
                  {spell.level === 0 ? t("cantrip") : t("spellLevel", { level: spell.level })}
                </Tag>
                {spell.concentration && <Tag tone="concentration">{t("concentration")}</Tag>}
              </>
            }
            value={spell.summary}
            onClick={
              spell.level > 0
                ? () => onCast(catalogue.find((s) => s.id === spell.id)!)
                : spell.roll
                  ? () => onRoll(spell.roll!)
                  : undefined
            }
          />
        ))}
      </div>
    </section>
  );
}

/**
 * The « Fiche » tab: saving throws, trained skills, then the others with a
 * search. A tap opens the roll, filled in.
 */
export function SheetChecks({
  character,
  onRoll,
}: {
  character: Dnd2024Character;
  onRoll: (spec: RollSpec) => void;
}) {
  const { t } = useTranslation("session", { keyPrefix: "player" });
  const [query, setQuery] = useState("");
  const saves = saveRows(character);
  const skills = skillRows(character);
  const trained = skills.filter((s) => s.proficient);
  const others = searchSkills(
    skills.filter((s) => !s.proficient),
    query,
  );
  const skillRoll = (row: (typeof skills)[number]): RollSpec => ({
    label: row.label,
    kind: "carac",
    bonus: row.modifier,
    ctx: { character, skill: row.skill },
  });
  return (
    <>
      <section className="flex flex-col gap-2">
        <SectionTitle>{t("saves")}</SectionTitle>
        <div className="bg-card grid grid-cols-2 divide-x divide-y overflow-hidden rounded-xl border sm:grid-cols-3">
          {saves.map((save) => (
            <RollRow
              key={save.ability}
              title={save.label}
              subtitle={
                save.proficient ? (
                  <span className="font-semibold text-(--char,var(--primary))">
                    {t("proficient")}
                  </span>
                ) : undefined
              }
              value={<span className="text-foreground">{signed(save.modifier)}</span>}
              onClick={() =>
                onRoll({
                  label: t("saveOf", { ability: save.label }),
                  kind: "sauvegarde",
                  bonus: save.modifier,
                  ctx: { character, saveAbility: save.ability },
                })
              }
            />
          ))}
        </div>
      </section>
      <section className="flex flex-col gap-2">
        <SectionTitle>{t("trainedSkills")}</SectionTitle>
        <div className="bg-card divide-y overflow-hidden rounded-xl border">
          {trained.map((skill) => (
            <RollRow
              key={skill.skill}
              title={skill.label}
              subtitle={skill.ability}
              value={<span className="text-foreground">{signed(skill.modifier)}</span>}
              onClick={() => onRoll(skillRoll(skill))}
            />
          ))}
        </div>
      </section>
      <section className="flex flex-col gap-2">
        <SectionTitle>{t("otherSkills")}</SectionTitle>
        <label className="relative">
          <SearchIcon className="text-muted-foreground absolute top-2.5 left-2.5 size-4" />
          <span className="sr-only">{t("searchSkill")}</span>
          <Input
            className="pl-8"
            placeholder={t("searchSkill")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <div className="bg-card divide-y overflow-hidden rounded-xl border">
          {others.length === 0 ? (
            <p className="text-muted-foreground px-3 py-2 text-sm">{t("noSkill")}</p>
          ) : (
            others.map((skill) => (
              <RollRow
                key={skill.skill}
                title={skill.label}
                subtitle={skill.ability}
                value={<span className="text-foreground">{signed(skill.modifier)}</span>}
                onClick={() => onRoll(skillRoll(skill))}
              />
            ))
          )}
        </div>
      </section>
    </>
  );
}

/**
 * « Capacités »: the features with uses per rest (a tap spends one — Second
 * Wind rolls its healing), heroic inspiration, and the hit dice.
 */
export function CapacityCard({
  character,
  participant,
  onParticipantStateChange,
  onRoll,
}: {
  character: Dnd2024Character;
  participant: AdventureParticipant;
  onParticipantStateChange: (patch: AdventureParticipantPlayerUpdate) => void;
  onRoll: (spec: RollSpec) => void;
}) {
  const { t } = useTranslation("session", { keyPrefix: "player.capacity" });
  const { t: tHud } = useTranslation("session", { keyPrefix: "sheet.hud" });
  const features = limitedFeatures(character);
  const spent = participant.featureUsesSpent ?? {};
  const setSpent = (id: string, value: number) =>
    onParticipantStateChange({ featureUsesSpent: { ...spent, [id]: value } });
  const inspired = participant.heroicInspiration ?? false;
  // One hit die per level; `hitDiceUsed` is what's been spent since the last long rest.
  const hitDiceTotal = character.level ?? 1;
  const hitDiceUsed = Math.min(hitDiceTotal, participant.hitDiceUsed ?? 0);
  const hitDiceLeft = hitDiceTotal - hitDiceUsed;
  return (
    <section className="flex flex-col gap-2">
      <SectionTitle>{t("title")}</SectionTitle>
      <div className="bg-card divide-y overflow-hidden rounded-xl border">
        {features.map((feature) => {
          // Défense patiente counts on the Credo's points.
          const countId = feature.spends?.id ?? feature.id;
          const used = Math.min(feature.max, spent[countId] ?? 0);
          const left = feature.max - used;
          return (
            <div key={feature.id} className="flex items-center gap-2.5 px-3 py-2.5">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">{feature.name}</span>
                <span
                  className="text-muted-foreground block truncate text-xs"
                  title={feature.summary}
                >
                  {feature.summary}
                </span>
              </span>
              {feature.spends ? null : feature.max > 10 ? (
                // A pool of points (Credo, Imposition des mains): a count, not dots.
                <span className="flex shrink-0 items-center gap-1 text-sm tabular-nums">
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                    disabled={used === 0}
                    aria-label={t("restore", { name: feature.name })}
                    onClick={() => setSpent(countId, used - 1)}
                  >
                    <PlusIcon className="size-3.5" />
                  </button>
                  <b>{left}</b>
                  <span className="text-muted-foreground text-xs">/ {feature.max}</span>
                </span>
              ) : (
                feature.max > 1 && (
                  <Pips
                    total={feature.max}
                    filled={used}
                    label={t("spent", { name: feature.name })}
                    onChange={(value) => setSpent(countId, value)}
                  />
                )
              )}
              <Chip
                tone={left > 0 ? "on" : "used"}
                disabled={left === 0}
                onClick={() => {
                  setSpent(countId, used + 1);
                  if (feature.roll) onRoll(feature.roll);
                }}
                aria-label={t("use", { name: feature.name })}
              >
                {left > 0 ? t("useShort") : t("used")}
              </Chip>
              {left === 0 && feature.max === 1 && !feature.spends && (
                <button
                  type="button"
                  className="text-muted-foreground hover:text-foreground"
                  aria-label={t("restore", { name: feature.name })}
                  onClick={() => setSpent(feature.id, 0)}
                >
                  <PlusIcon className="size-3.5" />
                </button>
              )}
            </div>
          );
        })}
        <div className="flex items-center gap-2.5 px-3 py-2.5">
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold">{tHud("inspiration")}</span>
            <span className="text-muted-foreground block text-xs">{t("inspirationHint")}</span>
          </span>
          <Chip
            tone={inspired ? "on" : undefined}
            aria-pressed={inspired}
            onClick={() => onParticipantStateChange({ heroicInspiration: !inspired })}
          >
            {inspired ? (
              <>
                <SparklesIcon className="mr-1 inline size-3" />
                {t("available")}
              </>
            ) : (
              t("none")
            )}
          </Chip>
        </div>
        <div className="flex items-center gap-2.5 px-3 py-2.5">
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold">{t("hitDice")}</span>
            <span className="text-muted-foreground block text-xs">
              {t("hitDiceHint", { die: character.hitDie })}
            </span>
          </span>
          <button
            type="button"
            className="hover:bg-accent min-w-12 rounded-lg border px-2.5 py-1 text-sm font-bold tabular-nums disabled:opacity-50"
            disabled={hitDiceLeft <= 0}
            aria-label={tHud("spendHitDie")}
            title={tHud("spendHitDie")}
            onClick={() => {
              onParticipantStateChange({ hitDiceUsed: hitDiceUsed + 1 });
              onRoll({
                label: t("hitDie"),
                kind: "degats",
                bonus: character.abilityModifiers.con,
                pool: { count: 1, die: `d${character.hitDie}` as DicePool["die"] },
                heal: true,
              });
            }}
          >
            {hitDiceLeft}/{hitDiceTotal}
          </button>
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground disabled:opacity-30"
            disabled={hitDiceUsed === 0}
            aria-label={tHud("recoverHitDie")}
            title={tHud("recoverHitDie")}
            onClick={() => onParticipantStateChange({ hitDiceUsed: hitDiceUsed - 1 })}
          >
            <PlusIcon className="size-3.5" />
          </button>
        </div>
      </div>
    </section>
  );
}
