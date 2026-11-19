import type { ReactNode } from "react";
import {
  ABILITY_LABELS,
  SPELL_SAVE_OUTCOME_LABELS,
  SPELL_SCHOOL_LABELS,
  SPELL_SCHOOL_SUMMARY,
  castingTimeLabel,
  getClass,
  spellDamageSummary,
  type Ability,
  type SpellDef,
} from "@adventure-keeper/system-dnd2024";
import { useTranslation } from "react-i18next";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { signed } from "@/lib/format";
import { tr } from "@/i18n";

/** The caster's numbers, when the card is shown from a statted sheet. */
export interface SpellCardCaster {
  saveDc: number | null;
  attackBonus: number | null;
  /** Character level — drives cantrip damage scaling on the card. */
  level?: number;
  /** Feeds the "how it's calculated" tooltip on the attack bonus / save DC. */
  proficiencyBonus?: number;
  spellcastingAbility?: Ability | null;
}

/** V / S / M, each with a one-line reminder of what it demands. */
const COMPONENT_LETTERS: Record<"v" | "s" | "m", string> = { v: "V", s: "S", m: "M" };
const componentHint = (key: "v" | "s" | "m") => tr(`characters:spellCard.components.${key}`);

function SpellComponentsValue({ spell }: { spell: SpellDef }) {
  const present = (["v", "s", "m"] as const).filter((key) => spell.components[key]);
  if (present.length === 0) return <>{tr("characters:spellCard.none")}</>;
  return (
    <>
      {present.map((key, index) => (
        <span key={key}>
          {index > 0 && ", "}
          <Explained hint={componentHint(key)}>{COMPONENT_LETTERS[key]}</Explained>
        </span>
      ))}
    </>
  );
}

/** Offensive spells force a defence; buffs / heals / summons don't. */
function isOffensiveSpell(spell: SpellDef): boolean {
  return (
    Boolean(spell.attackRoll) ||
    Boolean(spell.save) ||
    (spell.damage != null && spell.damage.kind !== "heal")
  );
}

/** The caster's spellcasting modifier, backed out of whichever stat we were given. */
function spellcastingModifier(caster?: SpellCardCaster): number | null {
  if (caster?.proficiencyBonus == null) return null;
  if (caster.attackBonus != null) return caster.attackBonus - caster.proficiencyBonus;
  if (caster.saveDc != null) return caster.saveDc - 8 - caster.proficiencyBonus;
  return null;
}

/** Plain-language breakdown of the spell attack bonus / save DC formula. */
function formulaHint(caster: SpellCardCaster | undefined, kind: "attack" | "dc"): string {
  const prof = caster?.proficiencyBonus;
  const ability = caster?.spellcastingAbility;
  const mod = spellcastingModifier(caster);
  const lead = tr(
    kind === "attack" ? "characters:spellCard.leadAttack" : "characters:spellCard.leadDc",
  );
  if (prof != null && ability != null && mod != null) {
    return tr("characters:spellCard.formula", {
      lead,
      prof: signed(prof),
      ability: ABILITY_LABELS[ability],
      mod: signed(mod),
    });
  }
  return tr("characters:spellCard.formulaGeneric", { lead });
}

/** Text with a dotted underline that reveals a short explanation on hover / focus. */
function Explained({ children, hint }: { children: ReactNode; hint: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="cursor-help underline decoration-dotted underline-offset-2">
          {children}
        </span>
      </TooltipTrigger>
      <TooltipContent>{hint}</TooltipContent>
    </Tooltip>
  );
}

/**
 * How the spell resolves against a target, split in two: what the **caster**
 * does (a spell attack roll, or nothing — the spell just lands) and what the
 * **target** does (a saving throw with its outcome, or nothing). Only shown for
 * offensive spells; a plain attack roll / a save that negates are the ordinary
 * cases and still stated, for symmetry.
 */
function resolutionRows(
  spell: SpellDef,
  caster?: SpellCardCaster,
): { label: string; value: ReactNode }[] {
  if (!isOffensiveSpell(spell)) return [];

  let casterValue: ReactNode;
  if (spell.attackRoll) {
    const bonus = caster?.attackBonus;
    casterValue =
      bonus != null ? (
        <>
          {tr("characters:spellCard.attackRoll")} (
          <Explained hint={formulaHint(caster, "attack")}>{signed(bonus)}</Explained>)
        </>
      ) : (
        tr("characters:spellCard.attackRoll")
      );
  } else {
    casterValue = tr("characters:spellCard.automatic");
  }

  let targetValue: ReactNode;
  if (spell.save) {
    const dc = caster?.saveDc;
    targetValue = (
      <>
        {tr("characters:spellCard.saveOf", { ability: ABILITY_LABELS[spell.save.ability] })}
        {dc != null && (
          <>
            {" "}
            ({tr("characters:spellCard.dc")}{" "}
            <Explained hint={formulaHint(caster, "dc")}>{dc}</Explained>)
          </>
        )}{" "}
        — {SPELL_SAVE_OUTCOME_LABELS[spell.save.onSuccess]}
      </>
    );
  } else {
    targetValue = tr("characters:spellCard.noSave");
  }

  return [
    { label: tr("characters:spellCard.casterRow"), value: casterValue },
    { label: tr("characters:spellCard.targetRow"), value: targetValue },
  ];
}

function Row({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div>
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="font-medium">{value}</dd>
      {hint && <dd className="text-muted-foreground text-xs">{hint}</dd>}
    </div>
  );
}

/**
 * The spell "card" — the metadata we can legitimately show. The full
 * descriptive effect stays in the rulebook.
 */
export function SpellCard({ spell, caster }: { spell: SpellDef; caster?: SpellCardCaster }) {
  const { t } = useTranslation("characters", { keyPrefix: "spellCard" });
  const levelLabel = spell.level === 0 ? t("cantrip") : t("levelN", { level: spell.level });
  const duration = spell.concentration
    ? t("concentrationDuration", { duration: spell.duration.toLowerCase() })
    : spell.duration;
  const damage = spellDamageSummary(spell, { characterLevel: caster?.level });

  return (
    <div className="grid gap-4">
      <div>
        <h3 className="text-lg font-semibold">{spell.name}</h3>
        <p className="text-muted-foreground text-sm">
          {levelLabel} · {SPELL_SCHOOL_LABELS[spell.school]}
        </p>
      </div>

      {spell.summary && <p className="text-sm">{spell.summary}</p>}

      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
        <Row
          label={t("school")}
          value={
            <>
              {SPELL_SCHOOL_LABELS[spell.school]}
              <span className="text-muted-foreground block text-xs leading-snug">
                {SPELL_SCHOOL_SUMMARY[spell.school]}
              </span>
            </>
          }
        />
        <Row label={t("castingTime")} value={castingTimeLabel(spell.castingTime)} />
        <Row label={t("range")} value={spell.range} />
        <Row label={t("componentsLabel")} value={<SpellComponentsValue spell={spell} />} />
        <Row label={t("duration")} value={duration} />
        <Row label={t("concentration")} value={spell.concentration ? t("yes") : t("no")} />
        <Row label={t("ritualLabel")} value={spell.ritual ? t("yes") : t("no")} />
        {damage && (
          <Row
            label={damage.label}
            value={damage.dice}
            hint={[damage.scaling, damage.note].filter(Boolean).join(" · ") || undefined}
          />
        )}
        {resolutionRows(spell, caster).map((row) => (
          <Row key={row.label} label={row.label} value={row.value} />
        ))}
      </dl>

      <p className="text-muted-foreground text-xs">
        {t("classes", { classes: spell.classes.map((id) => getClass(id)?.name ?? id).join(", ") })}
      </p>
      <p className="text-muted-foreground text-xs">
        {spell.ritual ? t("ritual") : t("notRitual")} {t("fullText")}
      </p>
    </div>
  );
}
