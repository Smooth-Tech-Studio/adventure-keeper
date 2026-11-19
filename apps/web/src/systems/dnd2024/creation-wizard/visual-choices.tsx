import { Fragment, useState } from "react";
import {
  BackpackIcon,
  CheckIcon,
  LockIcon,
  PackageIcon,
  SearchIcon,
  ShieldIcon,
  SwordIcon,
  WrenchIcon,
  type LucideIcon,
} from "lucide-react";
import {
  ABILITY_SUMMARY,
  ABILITIES,
  ABILITY_ABBR,
  ABILITY_LABELS,
  SKILL_ABILITY,
  SKILL_SUMMARY,
  SKILL_LABELS,
  SPELL_SCHOOL_LABELS,
  castingTimeLabel,
  getClass,
  spellcastingAbility,
  type Ability,
  startingEquipmentById,
  type AbilityScoreBlock,
  type ChoiceDef,
  type ChoicePick,
  type Skill,
  type SpellDef,
} from "@adventure-keeper/system-dnd2024";
import { useTranslation } from "react-i18next";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { signed } from "@/lib/format";
import type { ChoiceCatalogs } from "@/systems/dnd2024/lib/choices";
import { spellHueStyle } from "@/systems/dnd2024/lib/spell-hue";
import { cn } from "@/lib/utils";

/**
 * The choices that read better as objects than as a list: starting packages
 * side by side, spells as cards dealt into a hand, skills under the ability
 * they use, sizes as silhouettes. `ChoiceRenderer` picks one of these from the
 * shape of the choice; anything else keeps the generic cards / list.
 */

interface VisualProps {
  def: ChoiceDef;
  pool: string[];
  values: string[];
  onChange: (values: string[]) => void;
  catalogs: ChoiceCatalogs;
}

/** Toggle `value`, keeping at most `def.count` picks; a single pick swaps. */
function toggle(def: ChoiceDef, values: string[], value: string): string[] {
  if (values.includes(value)) return values.filter((kept) => kept !== value);
  if (def.count === 1) return [value];
  return values.length < def.count ? [...values, value] : values;
}

// --- Starting packages ---------------------------------------------------------

/** The kinds of package items, in display order; labels are `wizard:visual.kinds.<kind>`. */
const KINDS = ["armor", "weapon", "tool", "gear", "pack"] as const;

const KIND_ICONS: Record<(typeof KINDS)[number], LucideIcon> = {
  armor: ShieldIcon,
  weapon: SwordIcon,
  tool: WrenchIcon,
  gear: PackageIcon,
  pack: BackpackIcon,
};

/** « Paquetage lourd » ou « Paquetage léger » ou l'or : the options face to face. */
export function KitVersus({
  values,
  onChange,
  catalogs,
  owner,
  dexModifier,
  picks = [],
}: VisualProps & {
  owner: string;
  dexModifier?: number | null;
  /** Every pick so far: a package item can stand for a tool chosen elsewhere. */
  picks?: readonly ChoicePick[];
}) {
  const { t } = useTranslation("wizard", { keyPrefix: "visual" });
  const options = startingEquipmentById(owner)?.options ?? [];
  /** « Dés » once the tool is chosen, else what is still to choose. */
  const chosenTool = (choiceId: string, ownChoices: readonly ChoiceDef[]) => {
    const value = picks.find((pick) => pick.choiceId === choiceId)?.values[0];
    if (value) return catalogs.tools?.find((tool) => tool.id === value)?.name ?? value;
    const own = ownChoices.find((choice) => choice.id === choiceId);
    return own ? t("toChooseBelow", { label: own.label }) : t("toolAbove");
  };
  const nameOf = (kind: string, id: string) => {
    const rows =
      kind === "weapon"
        ? catalogs.weapons
        : kind === "armor"
          ? catalogs.armors
          : kind === "tool"
            ? catalogs.tools
            : kind === "gear"
              ? catalogs.gear
              : catalogs.packs;
    return rows?.find((row) => row.id === id)?.name ?? id;
  };
  const packContents = (id: string) =>
    catalogs.packs
      ?.find((pack) => pack.id === id)
      ?.contents.map((entry) => {
        const name = catalogs.gear?.find((row) => row.id === entry.gearId)?.name ?? entry.gearId;
        return entry.qty > 1 ? `${name} ×${entry.qty}` : name;
      })
      .join(", ");

  return (
    <div
      className="grid items-stretch gap-3 max-lg:!grid-cols-1"
      style={{
        gridTemplateColumns: options
          .map((option) => (option.items.length ? "minmax(0,1fr)" : "minmax(0,.75fr)"))
          .join(" auto "),
      }}
    >
      {options.map((option, index) => {
        const selected = values.includes(option.id);
        const armor = option.items
          .filter((item) => item.kind === "armor" && item.id)
          .map((item) => catalogs.armors?.find((row) => row.id === item.id))
          .find((row) => row && row.category !== "shield");
        const shield = option.items.some((item) => item.kind === "armor" && item.id === "shield");
        const dex = armor?.addsDex
          ? armor.maxDex != null
            ? ` + Dex (max ${armor.maxDex})`
            : " + Dex"
          : "";
        const total =
          armor && dexModifier != null
            ? (armor.baseAc ?? 10) +
              (armor.addsDex
                ? armor.maxDex != null
                  ? Math.min(armor.maxDex, dexModifier)
                  : dexModifier
                : 0) +
              (shield ? 2 : 0)
            : null;

        return (
          <Fragment key={option.id}>
            {index > 0 && (
              <span className="text-muted-foreground type-heading self-center justify-self-center">
                {t("or")}
              </span>
            )}
            <button
              type="button"
              aria-pressed={selected}
              onClick={() => onChange(selected ? [] : [option.id])}
              className={cn(
                "bg-card flex min-w-0 flex-col gap-3 rounded-2xl border p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md",
                selected && "ring-primary ring-2 ring-offset-2 ring-offset-background",
                option.items.length === 0 && "items-center justify-center text-center",
              )}
            >
              {option.items.length === 0 ? (
                <>
                  <span className="type-heading">{t("buyAll")}</span>
                  <span className="type-figure">{t("gold", { count: option.gold })}</span>
                  <span className="text-muted-foreground text-xs">{t("shopLater")}</span>
                  {selected && <Badge className="bg-emerald-600">{t("chosen")}</Badge>}
                </>
              ) : (
                <>
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="type-heading">{option.label}</span>
                    {selected && <Badge className="bg-emerald-600">{t("chosen")}</Badge>}
                  </span>
                  {armor && (
                    <span className="bg-muted self-start rounded-full border px-2 py-0.5 text-xs">
                      {t("acLine", { value: armor.baseAc })}
                      {dex}
                      {shield ? " + 2" : ""}
                      {total != null ? ` = ${total}` : ""}
                    </span>
                  )}
                  {KINDS.map((kind) => {
                    const items = option.items.filter((item) => item.kind === kind);
                    if (items.length === 0) return null;
                    const Icon = KIND_ICONS[kind];
                    return (
                      <span key={kind} className="flex flex-col gap-1 border-t pt-2 text-sm">
                        <span className="text-primary flex items-center gap-1.5 text-xs font-semibold tracking-wide uppercase">
                          <Icon className="size-3.5" />
                          {t(`kinds.${kind}`)}
                        </span>
                        {items.map((item, itemIndex) => (
                          <span key={itemIndex}>
                            {item.fromChoice
                              ? chosenTool(item.fromChoice, option.choices ?? [])
                              : nameOf(kind, item.id ?? "")}
                            {item.qty && item.qty > 1 ? ` ×${item.qty}` : ""}
                            {kind === "pack" && item.id && (
                              <span className="text-muted-foreground block text-xs">
                                {packContents(item.id)}
                              </span>
                            )}
                          </span>
                        ))}
                      </span>
                    );
                  })}
                  <span className="type-heading mt-auto">
                    {t("plusGold", { count: option.gold })}
                  </span>
                </>
              )}
            </button>
          </Fragment>
        );
      })}
    </div>
  );
}

// --- Spells ----------------------------------------------------------------------

/** A spell as a playing card: school and level, the four facts, its summary. */
export function SpellCardFace({ spell }: { spell: SpellDef }) {
  const { t } = useTranslation("wizard", { keyPrefix: "visual" });
  const components = (["v", "s", "m"] as const)
    .filter((key) => spell.components[key])
    .map((key) => key.toUpperCase())
    .join(", ");
  return (
    <>
      <span className="type-label wizard-art flex justify-between gap-2 px-3 py-2">
        <span>{SPELL_SCHOOL_LABELS[spell.school]}</span>
        <span>{spell.level === 0 ? t("cantrip") : t("spellLevel", { level: spell.level })}</span>
      </span>
      <span className="type-heading px-3 pt-2">{spell.name}</span>
      <span className="text-muted-foreground grid grid-cols-2 gap-x-2.5 gap-y-1 border-b px-3 py-2 text-xs">
        <span>
          {t("castingTime")}
          <span className="font-medium text-foreground block text-xs">
            {castingTimeLabel(spell.castingTime)}
          </span>
        </span>
        <span>
          {t("range")}
          <span className="font-medium text-foreground block text-xs">{spell.range}</span>
        </span>
        <span>
          {t("components")}
          <span className="font-medium text-foreground block text-xs">
            {components || t("none")}
          </span>
        </span>
        <span>
          {t("duration")}
          <span className="font-medium text-foreground block text-xs">{spell.duration}</span>
        </span>
      </span>
      <span className="flex-1 px-3 py-2 text-sm leading-snug">{spell.summary}</span>
      {(spell.concentration || spell.ritual) && (
        <span className="flex gap-1 px-3 pb-3">
          {spell.concentration && <Badge variant="outline">{t("concentration")}</Badge>}
          {spell.ritual && <Badge variant="outline">{t("ritual")}</Badge>}
        </span>
      )}
    </>
  );
}

/** The spells on offer as cards; the picked ones sit in a « hand » above. */
export function SpellHand({
  def,
  pool,
  values,
  onChange,
  catalogs,
  granted = [],
}: VisualProps & {
  /**
   * Spells a feature, the species or the lineage grants: shown first, already
   * picked and locked, the reason on hover. They are outside the hand's count.
   */
  granted?: { id: string; reason: string }[];
}) {
  const { t } = useTranslation("wizard", { keyPrefix: "visual" });
  const [search, setSearch] = useState("");
  const spellOf = (id: string) => catalogs.spells?.find((spell) => spell.id === id);
  const full = values.length >= def.count;
  const cantrips = pool.some((id) => spellOf(id)?.level === 0);
  const query = search.trim().toLowerCase();
  const shown = pool.filter(
    (id) => query === "" || (spellOf(id)?.name ?? id).toLowerCase().includes(query),
  );

  if (!catalogs.spells) return <p className="text-muted-foreground text-sm">{t("loading")}</p>;

  return (
    <div className="flex flex-col gap-3">
      <div className="bg-muted/50 flex flex-wrap gap-2.5 rounded-xl border border-dashed p-3">
        <span className="type-label w-full">
          {t("hand", { picked: values.length, count: def.count })}
        </span>
        {Array.from({ length: def.count }, (_, index) => {
          const spell = values[index] ? spellOf(values[index]) : undefined;
          return spell ? (
            <button
              key={spell.id}
              type="button"
              title={t("putBack")}
              onClick={() => onChange(values.filter((kept) => kept !== spell.id))}
              style={spellHueStyle(spell)}
              className="bg-card flex min-h-[4.5rem] w-40 flex-col overflow-hidden rounded-lg border text-left shadow-sm"
            >
              <span className="wizard-art h-2" />
              <span className="px-2.5 pt-1.5 font-medium">{spell.name}</span>
              <span className="text-muted-foreground px-2.5 pb-2 text-xs">
                {SPELL_SCHOOL_LABELS[spell.school]}
                {t("removeTag")}
              </span>
            </button>
          ) : (
            <span
              key={index}
              className="text-muted-foreground grid min-h-[4.5rem] w-40 place-items-center rounded-lg border-[1.5px] border-dashed text-xs"
            >
              {cantrips ? t("cantrip") : t("spell")} {def.count > 1 ? index + 1 : ""}
            </span>
          );
        })}
      </div>

      {pool.length > 12 && (
        <div className="relative">
          <SearchIcon className="text-muted-foreground absolute top-2.5 left-2.5 size-4" />
          <Input
            className="pl-8"
            placeholder={t("searchSpells", { count: pool.length })}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
      )}

      <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-3">
        {granted.map(({ id, reason }) => {
          const spell = spellOf(id);
          if (!spell) return null;
          return (
            <Tooltip key={id}>
              <TooltipTrigger asChild>
                <div
                  tabIndex={0}
                  aria-label={`${spell.name} — ${reason}`}
                  style={spellHueStyle(spell)}
                  className="bg-card ring-offset-background relative flex min-h-64 cursor-help flex-col overflow-hidden rounded-xl border text-left shadow-sm ring-2 ring-emerald-600 ring-offset-2"
                >
                  <SpellCardFace spell={spell} />
                  <span className="flex items-center gap-1 px-3 pb-3 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                    <LockIcon className="size-3.5" /> {t("grantedTag")}
                  </span>
                </div>
              </TooltipTrigger>
              <TooltipContent className="max-w-64">{reason}</TooltipContent>
            </Tooltip>
          );
        })}
        {shown.map((id) => {
          const spell = spellOf(id);
          if (!spell) return null;
          const selected = values.includes(id);
          return (
            <button
              key={id}
              type="button"
              aria-pressed={selected}
              disabled={!selected && full && def.count > 1}
              onClick={() => onChange(toggle(def, values, id))}
              style={spellHueStyle(spell)}
              className={cn(
                "bg-card flex min-h-64 flex-col overflow-hidden rounded-xl border text-left shadow-sm transition hover:-translate-y-1 hover:-rotate-[.6deg] disabled:pointer-events-none disabled:opacity-40",
                selected && "ring-2 ring-emerald-600 ring-offset-2 ring-offset-background",
              )}
            >
              <SpellCardFace spell={spell} />
            </button>
          );
        })}
      </div>
    </div>
  );
}

// --- Skills ----------------------------------------------------------------------

/** One row per ability, the skills it drives on the right. */
export function SkillRows({
  def,
  pool,
  values,
  onChange,
  scores,
  proficiencyBonus,
}: VisualProps & { scores?: AbilityScoreBlock | null; proficiencyBonus: number }) {
  const { t } = useTranslation("wizard", { keyPrefix: "visual" });
  const full = values.length >= def.count;
  const rows = ABILITIES.map((ability) => ({
    ability,
    skills: pool.filter((skill) => SKILL_ABILITY[skill as Skill] === ability),
  })).filter((row) => row.skills.length > 0);

  return (
    <div className="flex flex-col">
      {rows.map(({ ability, skills }) => {
        const modifier = scores ? Math.floor((scores[ability] - 10) / 2) : null;
        return (
          <div
            key={ability}
            className="grid grid-cols-1 gap-1.5 border-t py-3 first:border-t-0 first:pt-0 @xl:grid-cols-[9rem_minmax(0,1fr)] @xl:gap-4"
          >
            <div className="flex flex-row justify-between pt-0 @xl:flex-col @xl:justify-start @xl:pt-2">
              <span className="font-medium">{ABILITY_LABELS[ability]}</span>
              <span className="text-muted-foreground text-xs tabular-nums">
                {ABILITY_ABBR[ability]}
                {scores ? t("scoreMod", { score: scores[ability], mod: signed(modifier!) }) : ""}
              </span>
            </div>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(13rem,1fr))] gap-2">
              {skills.map((skill) => {
                const selected = values.includes(skill);
                return (
                  <button
                    key={skill}
                    type="button"
                    aria-pressed={selected}
                    disabled={!selected && full && def.count > 1}
                    onClick={() => onChange(toggle(def, values, skill))}
                    className={cn(
                      "hover:bg-accent flex flex-col gap-0.5 rounded-lg border px-3 py-2 text-left transition-colors disabled:opacity-45",
                      selected && "border-primary bg-accent ring-primary ring-1",
                    )}
                  >
                    <span className="flex items-center justify-between gap-2 text-sm font-medium">
                      {SKILL_LABELS[skill as Skill]}
                      {selected && (
                        <span className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                          <CheckIcon className="size-3.5" />
                          {modifier != null && signed(modifier + proficiencyBonus)}
                        </span>
                      )}
                    </span>
                    <span className="text-muted-foreground text-xs leading-snug">
                      {SKILL_SUMMARY[skill as Skill]}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// --- Ability-score improvement -------------------------------------------------

/**
 * « Amélioration de caractéristique »: two +1 tokens dropped on the six
 * abilities, both on the same one for +2. `scores` already counts the tokens
 * placed, so the cap of 20 reads straight off it.
 */
export function AbilityIncrease({
  def,
  values,
  onChange,
  scores,
}: VisualProps & { scores?: AbilityScoreBlock | null }) {
  const { t } = useTranslation("wizard", { keyPrefix: "visual" });
  const left = def.count - values.length;
  const placed = (ability: string) => values.filter((value) => value === ability).length;

  function add(ability: string) {
    if (left > 0 && (scores?.[ability as keyof AbilityScoreBlock] ?? 0) < 20) {
      onChange([...values, ability]);
    }
  }
  function remove(ability: string) {
    const index = values.lastIndexOf(ability);
    if (index >= 0) onChange(values.filter((_, at) => at !== index));
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="text-muted-foreground flex items-center gap-2 text-sm">
        {t("tokens")}
        {Array.from({ length: def.count }, (_, index) => (
          <span
            key={index}
            className={cn(
              "rounded-full border-2 border-dashed px-2.5 py-0.5 font-medium tabular-nums",
              index < left ? "border-primary text-primary" : "opacity-30",
            )}
          >
            +1
          </span>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2 @xl:grid-cols-6">
        {ABILITIES.map((ability) => {
          const count = placed(ability);
          const score = scores?.[ability];
          const capped = score != null && score >= 20;
          return (
            <div
              key={ability}
              className={cn(
                "bg-card flex flex-col items-center gap-1 rounded-xl border px-1.5 py-2.5",
                count > 0 && "border-primary bg-accent",
              )}
            >
              <span className="text-muted-foreground text-xs font-medium tracking-wider">
                {ABILITY_ABBR[ability]}
              </span>
              <span className="type-title tabular-nums">{score ?? "–"}</span>
              <span className="text-muted-foreground text-xs tabular-nums">
                {score != null ? signed(Math.floor((score - 10) / 2)) : " "}
              </span>
              <div className="flex min-h-6 items-center gap-1">
                {Array.from({ length: count }, (_, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => remove(ability)}
                    aria-label={t("removePoint", { ability: ABILITY_LABELS[ability] })}
                    className="bg-primary text-primary-foreground rounded-full px-1.5 text-xs font-medium tabular-nums"
                  >
                    +1
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => add(ability)}
                disabled={left === 0 || capped}
                aria-label={t("addPoint", { ability: ABILITY_LABELS[ability] })}
                className="hover:bg-accent text-muted-foreground w-full rounded-md border text-xs disabled:opacity-40"
              >
                {capped ? t("max20") : "+1"}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// --- Size ------------------------------------------------------------------------

/** How tall each size draws; its height is `wizard:visual.sizes.<size>`. */
const SIZE_SCALE: Record<string, number> = { small: 0.6, medium: 1 };

function Silhouette({ scale }: { scale: number }) {
  return (
    <svg viewBox="0 0 70 140" width="70" height="140" aria-hidden>
      <line x1="0" y1="139" x2="70" y2="139" stroke="currentColor" strokeOpacity=".3" />
      <g transform={`translate(35 139) scale(${scale}) translate(-35 -139)`} fill="currentColor">
        <circle cx="35" cy="16" r="12" />
        <path d="M17 36 Q35 28 53 36 L58 84 L49 84 L47 138 L38 138 L35 96 L32 138 L23 138 L21 84 L12 84 Z" />
      </g>
    </svg>
  );
}

/** Small or Medium, drawn to scale against each other. */
export function SizePicker({
  def,
  pool,
  values,
  onChange,
  labelOf,
}: VisualProps & { labelOf: (value: string) => string }) {
  const { t } = useTranslation("wizard", { keyPrefix: "visual" });
  return (
    <div className="grid grid-cols-2 gap-3 sm:max-w-md">
      {pool.map((value) => {
        const selected = values.includes(value);
        const scale = SIZE_SCALE[value] ?? 1;
        return (
          <button
            key={value}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(toggle(def, values, value))}
            className={cn(
              "bg-card flex flex-col items-center gap-2 rounded-2xl border p-4 shadow-sm",
              selected
                ? "text-foreground ring-primary ring-2 ring-offset-2 ring-offset-background"
                : "text-muted-foreground",
            )}
          >
            <Silhouette scale={scale} />
            <span className="text-foreground type-heading inline-flex items-center gap-1">
              {labelOf(value)}
              {selected && <CheckIcon className="size-4" />}
            </span>
            <span className="text-xs">
              {value === "small" || value === "medium" ? t(`sizes.${value}`) : ""}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// --- Spellcasting ability -------------------------------------------------------

/** « de magicien », « d'ensorceleur » — the French elision, used by the French text only. */
function ofClass(name: string): string {
  const lower = name.toLowerCase();
  return /^[aeiouéèêh]/.test(lower) ? `d'${lower}` : `de ${lower}`;
}

/**
 * Intelligence, Wisdom or Charisma for spells a species or a feat grants. Each
 * card says what the ability is, whether the class already casts with it, and
 * the character's score — or the class's suggestion while scores are unknown.
 * The best pick is marked: the class's own casting ability, else the highest.
 */
export function SpellAbilityPicker({
  def,
  pool,
  values,
  onChange,
  scores,
  classId,
}: VisualProps & { scores?: AbilityScoreBlock | null; classId?: string }) {
  const { t, i18n } = useTranslation("wizard", { keyPrefix: "visual" });
  const klass = classId ? getClass(classId) : undefined;
  const casting = classId ? spellcastingAbility(classId) : null;
  const abilities = pool as Ability[];
  const valueOf = (ability: Ability) => scores?.[ability] ?? klass?.suggestedScores[ability] ?? 0;
  const recommended =
    casting && abilities.includes(casting)
      ? casting
      : [...abilities].sort((a, b) => valueOf(b) - valueOf(a))[0];

  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(16rem,1fr))] gap-3">
      {abilities.map((ability) => {
        const selected = values.includes(ability);
        const score = scores?.[ability];
        return (
          <button
            key={ability}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(toggle(def, values, ability))}
            className={cn(
              "hover:bg-accent flex flex-col gap-2 rounded-xl border p-4 text-left transition-colors",
              selected && "border-primary bg-accent ring-primary ring-1",
            )}
          >
            <span className="flex items-center justify-between gap-2">
              <span className="type-heading">{ABILITY_LABELS[ability]}</span>
              {selected ? (
                <CheckIcon className="size-4 text-emerald-600 dark:text-emerald-400" />
              ) : (
                ability === recommended && <Badge variant="secondary">{t("recommended")}</Badge>
              )}
            </span>
            <span className="text-muted-foreground text-xs leading-snug">
              {ABILITY_SUMMARY[ability]}
            </span>
            <span className="flex flex-col gap-0.5 text-xs">
              {klass && casting === ability && (
                <span>
                  {t("alreadyClass", {
                    // French elides (« de magicien », « d'ensorceleur »); English just names it.
                    ofClass:
                      i18n.language === "fr" ? ofClass(klass.name) : klass.name.toLowerCase(),
                  })}
                </span>
              )}
              {score != null ? (
                <span>{t("yourScore", { score, mod: signed(Math.floor((score - 10) / 2)) })}</span>
              ) : (
                klass && (
                  <span className="text-muted-foreground">
                    {t("suggested", { value: klass.suggestedScores[ability] })}
                  </span>
                )
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}
