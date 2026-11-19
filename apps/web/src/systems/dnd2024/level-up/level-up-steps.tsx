import type { ReactNode } from "react";
import {
  ABILITIES,
  ABILITY_LABELS,
  SKILL_LABELS,
  cantripsKnown,
  classFeatures,
  hitPointGain,
  invocationsKnown,
  preparedSpellsCount,
  skillExpertiseCount,
  subclassFeatures,
  weaponMasteryCount,
  type CharacterDerived,
  type ChoiceDef,
  type ClassDef,
} from "@adventure-keeper/system-dnd2024";
import { useTranslation } from "react-i18next";

import type { FormState } from "@/systems/dnd2024/character-form/state";
import { NamedLine } from "@/systems/dnd2024/creation-wizard/entity-carousel";
import { Panel } from "@/systems/dnd2024/creation-wizard/fixed-substeps";
import { signed } from "@/lib/format";
import { findSpell, useSpells } from "@/systems/dnd2024/lib/spells";
import { cn } from "@/lib/utils";
import { tr } from "@/i18n";

/** « 4 / 3 » — the slots per spell level, or the Pact Magic slots. */
function slotsText(derived: CharacterDerived): string {
  if (derived.pactMagic) {
    return tr("wizard:levelUp.slotsPact", derived.pactMagic);
  }
  const levels = Object.keys(derived.spellSlots)
    .map(Number)
    .sort((a, b) => a - b);
  return levels.length ? levels.map((level) => derived.spellSlots[level]).join(" / ") : "—";
}

/** A count that grows with the level, or `null` when it does not move. */
function growth(label: string, from: number, to: number): Increase | null {
  return to !== from ? [label, from, to] : null;
}

type Increase = [label: string, from: ReactNode, to: ReactNode];

/** One row per spell level whose slots change: « Emplacements de niv. 2 : 0 → 2 ». */
function slotIncreases(before: CharacterDerived, after: CharacterDerived): Increase[] {
  if (after.pactMagic) {
    return slotsText(before) === slotsText(after)
      ? []
      : [[tr("wizard:levelUp.slotsPactLabel"), slotsText(before), slotsText(after)]];
  }
  const levels = [...new Set([...Object.keys(before.spellSlots), ...Object.keys(after.spellSlots)])]
    .map(Number)
    .sort((a, b) => a - b);
  return levels
    .map((level) => [level, before.spellSlots[level] ?? 0, after.spellSlots[level] ?? 0] as const)
    .filter(([, from, to]) => from !== to)
    .map(([level, from, to]) => [tr("wizard:levelUp.slotsLevel", { level }), from, to]);
}

/** « 12 → 19 », the new value in the colour of what the level brings. */
function Change({ from, to }: { from: ReactNode; to: ReactNode }) {
  return from === to ? (
    <>{to}</>
  ) : (
    <>
      <span className="text-muted-foreground">{from} → </span>
      <span className="font-semibold text-emerald-600 dark:text-emerald-400">{to}</span>
    </>
  );
}

/** The read-only first screen: what the new level hands over by itself. */
export function LevelGainsStep({
  before,
  after,
  state,
  fromLevel,
  klass,
  subclassId,
  upcoming,
  hitPointsChosen,
}: {
  before: CharacterDerived | null;
  after: CharacterDerived | null;
  state: FormState;
  fromLevel: number;
  klass: ClassDef;
  subclassId?: string;
  /** The screens that follow, by their rail label. */
  upcoming: string[];
  /** Once the hit points step is done, the new maximum is known; until then, a range. */
  hitPointsChosen: boolean;
}) {
  const { t } = useTranslation("wizard", { keyPrefix: "levelUp" });
  const to = state.level;
  const features = [
    ...classFeatures(klass.id, to).filter((feature) => feature.level === to),
    ...(subclassId
      ? subclassFeatures(subclassId, to).filter((feature) => feature.level === to)
      : []),
  ];
  const counts = [
    ...(before && after ? slotIncreases(before, after) : []),
    growth(t("cantrips"), cantripsKnown(klass.id, fromLevel), cantripsKnown(klass.id, to)),
    growth(
      t("prepared"),
      preparedSpellsCount(klass.id, fromLevel),
      preparedSpellsCount(klass.id, to),
    ),
    growth(t("invocations"), invocationsKnown(klass.id, fromLevel), invocationsKnown(klass.id, to)),
    growth(
      t("masteriesCount"),
      weaponMasteryCount(klass.id, fromLevel),
      weaponMasteryCount(klass.id, to),
    ),
    growth(
      t("expertiseCount"),
      skillExpertiseCount(klass.id, fromLevel),
      skillExpertiseCount(klass.id, to),
    ),
  ].filter((row): row is Increase => row !== null);

  // The new maximum is only known once the die is settled: until then, what it
  // may come to — the lowest roll to the highest, everything else included.
  let maxHp: ReactNode = after?.maxHitPoints ?? "—";
  if (!hitPointsChosen && before && after) {
    const con = after.abilityModifiers.con;
    const others = after.maxHitPoints - before.maxHitPoints - hitPointGain(klass.hitDie, con);
    const base = before.maxHitPoints + others;
    maxHp = `${base + hitPointGain(klass.hitDie, con, 1)}–${base + hitPointGain(klass.hitDie, con, klass.hitDie)}`;
  }
  const tiles: [string, ReactNode, ReactNode][] = [
    [hitPointsChosen ? t("maxHp") : t("maxHpPending"), before?.maxHitPoints ?? "—", maxHp],
    [t("proficiency"), signed(before?.proficiencyBonus ?? 0), signed(after?.proficiencyBonus ?? 0)],
    [t("hitDice"), `${fromLevel}d${klass.hitDie}`, `${to}d${klass.hitDie}`],
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-3 gap-2.5">
        {tiles.map(([label, from, next]) => (
          <div
            key={label}
            className="bg-card flex flex-col items-center rounded-xl border px-2 py-3"
          >
            <span className="text-2xl font-semibold tabular-nums">
              <Change from={from} to={next} />
            </span>
            <span className="text-muted-foreground text-[11px] tracking-wider uppercase">
              {label}
            </span>
          </div>
        ))}
      </div>
      <Panel title={t("newFeatures")}>
        {features.length > 0 ? (
          features.map((feature) => (
            <NamedLine key={feature.name} name={feature.name} text={feature.summary} />
          ))
        ) : (
          <p className="text-muted-foreground text-sm">{t("noFeature")}</p>
        )}
      </Panel>
      {counts.length > 0 && (
        <Panel title={t("increases")}>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-sm">
            {counts.map(([label, from, to]) => (
              <div key={label} className="contents">
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="text-right tabular-nums">
                  <Change from={from} to={to} />
                </dd>
              </div>
            ))}
          </dl>
        </Panel>
      )}
      {upcoming.length > 0 && (
        <Panel title={t("upcoming")}>
          <ol className="flex flex-wrap gap-1.5">
            {upcoming.map((label) => (
              <li key={label} className="bg-muted rounded-full border px-2.5 py-0.5 text-xs">
                {label}
              </li>
            ))}
          </ol>
        </Panel>
      )}
    </div>
  );
}

/** The last screen: the sheet before and after, and what was picked on the way. */
export function LevelReview({
  before,
  after,
  beforeState,
  state,
  defs,
  labelOf,
}: {
  before: CharacterDerived | null;
  after: CharacterDerived | null;
  beforeState: FormState;
  state: FormState;
  /** The choices this level opened. */
  defs: ChoiceDef[];
  labelOf: (def: ChoiceDef, value: string) => string;
}) {
  const { t } = useTranslation("wizard", { keyPrefix: "levelUp" });
  const spells = useSpells();
  if (!before || !after) return null;

  const rows: [string, ReactNode, ReactNode][] = [
    [t("level"), beforeState.level, state.level],
    [t("maxHp"), before.maxHitPoints, after.maxHitPoints],
    [t("ac"), before.armorClass, after.armorClass],
    ...ABILITIES.filter(
      (ability) => before.adjustedAbilityScores[ability] !== after.adjustedAbilityScores[ability],
    ).map(
      (ability) =>
        [
          ABILITY_LABELS[ability],
          `${before.adjustedAbilityScores[ability]} (${signed(before.abilityModifiers[ability])})`,
          `${after.adjustedAbilityScores[ability]} (${signed(after.abilityModifiers[ability])})`,
        ] as [string, ReactNode, ReactNode],
    ),
    [t("proficiency"), signed(before.proficiencyBonus), signed(after.proficiencyBonus)],
    [t("passivePerception"), before.passivePerception, after.passivePerception],
  ];
  if (after.spellSaveDc != null) {
    rows.push(
      [t("spellDc"), before.spellSaveDc ?? "—", after.spellSaveDc],
      [t("spellAttack"), signed(before.spellAttackBonus ?? 0), signed(after.spellAttackBonus ?? 0)],
      [t("slotsShort"), slotsText(before), slotsText(after)],
      [t("cantrips"), beforeState.cantrips.length, state.cantrips.length],
      [t("prepared"), beforeState.spells.length, state.spells.length],
    );
  }

  const nameOf = (id: string) => (spells ? (findSpell(spells, id)?.name ?? id) : id);
  const added = [...state.cantrips, ...state.spells].filter(
    (id) => !beforeState.cantrips.includes(id) && !beforeState.spells.includes(id),
  );
  const removed = [...beforeState.cantrips, ...beforeState.spells].filter(
    (id) => !state.cantrips.includes(id) && !state.spells.includes(id),
  );
  const picks = defs.flatMap((def) => {
    const values = state.choices.find((pick) => pick.choiceId === def.id)?.values ?? [];
    return values.length
      ? [[def.label, values.map((value) => labelOf(def, value)).join(", ")]]
      : [];
  });
  const expertise = state.skillExpertise.filter(
    (skill) => !beforeState.skillExpertise.includes(skill),
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-card overflow-x-auto rounded-xl border">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-muted-foreground border-b text-left text-xs">
              <th className="px-3 py-2 font-medium" />
              <th className="px-3 py-2 font-medium">{t("levelN", { level: beforeState.level })}</th>
              <th className="px-3 py-2 font-medium">{t("levelN", { level: state.level })}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([label, from, to]) => {
              const changed = String(from) !== String(to);
              return (
                <tr
                  key={label}
                  className={cn("border-b last:border-b-0", changed && "bg-emerald-500/10")}
                >
                  <td className="px-3 py-2">{label}</td>
                  <td className="px-3 py-2 tabular-nums">{from}</td>
                  <td
                    className={cn(
                      "px-3 py-2 tabular-nums",
                      changed && "font-semibold text-emerald-700 dark:text-emerald-400",
                    )}
                  >
                    {to}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {(picks.length > 0 || expertise.length > 0) && (
        <Panel title={t("choices")}>
          {picks.map(([label, value]) => (
            <NamedLine key={label} name={label} text={value} />
          ))}
          {expertise.length > 0 && (
            <NamedLine
              name={t("expertiseCount")}
              text={expertise.map((skill) => SKILL_LABELS[skill]).join(", ")}
            />
          )}
        </Panel>
      )}
      {(added.length > 0 || removed.length > 0) && (
        <Panel title={t("spellsPanel")}>
          {added.length > 0 && <NamedLine name={t("added")} text={added.map(nameOf).join(", ")} />}
          {removed.length > 0 && (
            <NamedLine name={t("removed")} text={removed.map(nameOf).join(", ")} />
          )}
        </Panel>
      )}
    </div>
  );
}
