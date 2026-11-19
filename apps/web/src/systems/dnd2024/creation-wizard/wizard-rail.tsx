import type { ReactNode } from "react";
import { CheckIcon, SaveIcon } from "lucide-react";
import {
  ABILITIES,
  ABILITY_ABBR,
  SKILL_LABELS,
  formatDistance,
  getLanguage,
  proficiencyBonus,
  type CharacterDerived,
  type ClassDef,
  type Skill,
  type SpeciesDef,
} from "@adventure-keeper/system-dnd2024";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import type { FormState } from "@/systems/dnd2024/character-form/state";
import { CREATION_STEPS } from "@/systems/dnd2024/creation-wizard/steps";
import type { Substep } from "@/systems/dnd2024/creation-wizard/substeps";
import { signed } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * The left column: the five steps, the current one opened on its sub-steps,
 * then a live summary of the character, and the draft button pinned at the
 * bottom. On a phone it shrinks to a row of steps.
 */

export interface RailSubstep {
  /** Only the key and the rail label are read. */
  sub: Pick<Substep, "key" | "nav">;
  value: string;
  done: boolean;
  reachable: boolean;
}

interface Props {
  /** The steps listed down the rail; the creation's five by default. */
  steps?: readonly { id: string; label: string }[];
  /** Small heading above the steps. */
  heading?: string;
  /**
   * What sits at the bottom of the rail. The creation's draft button by
   * default; a flow that saves in one go passes its own.
   */
  footer?: ReactNode;
  stepIndex: number;
  subIndex: number;
  /** Sub-steps of the current step, with their state. */
  substeps: RailSubstep[];
  /** Placeholder shown before the entity is picked (« Options de la classe »). */
  pending?: string;
  stepValue: (index: number) => string;
  stepDone: (index: number) => boolean;
  stepReachable: (index: number) => boolean;
  onGoto: (stepIndex: number, subIndex: number) => void;
  state: FormState;
  derived: CharacterDerived | null;
  klass?: ClassDef;
  species?: SpeciesDef;
  skills: Skill[];
  feats: string[];
  languages: string[];
  onSaveDraft?: () => void;
  onCancel: () => void;
  saving: boolean;
  savedAt?: string | null;
  /** No account yet: the draft button sends the player to sign up instead. */
  guest?: boolean;
}

export function WizardRail(props: Props) {
  return (
    <GuidedRail
      {...props}
      steps={props.steps ?? CREATION_STEPS}
      summary={<Summary {...props} />}
      footer={props.footer ?? <DraftFooter {...props} />}
    />
  );
}

/** What any guided flow's rail needs: its steps, and what to show under them. */
export interface GuidedRailProps {
  steps: readonly { id: string; label: string }[];
  heading?: string;
  stepIndex: number;
  subIndex: number;
  substeps: RailSubstep[];
  pending?: string;
  stepValue: (index: number) => string;
  stepDone: (index: number) => boolean;
  stepReachable: (index: number) => boolean;
  onGoto: (stepIndex: number, subIndex: number) => void;
  /** Under the steps, on a large screen: a live summary of what is being made. */
  summary?: ReactNode;
  /** Pinned at the bottom of the rail, on a large screen. */
  footer?: ReactNode;
}

/**
 * The left column of a guided flow — the character creation and level-up,
 * the campaign and adventure creation: the steps, the current one opened on
 * its sub-steps, a summary, and a footer pinned at the bottom. On a phone it
 * shrinks to a row of steps.
 */
export function GuidedRail(props: GuidedRailProps) {
  const { t } = useTranslation("wizard", { keyPrefix: "rail" });
  const { stepIndex, subIndex, substeps, onGoto, steps } = props;
  return (
    <aside className="bg-card flex flex-col border-b lg:sticky lg:top-14 lg:h-[calc(100svh-3.5rem)] lg:overflow-y-auto lg:border-r lg:border-b-0 text-sm">
      <div className="flex flex-col gap-5 p-4 lg:pb-0">
        <span className="type-label max-lg:hidden">{props.heading ?? t("heading")}</span>
        <ol className="flex gap-1 overflow-x-auto lg:flex-col lg:gap-0 lg:overflow-visible">
          {steps.map((step, index) => {
            const active = index === stepIndex;
            const done = !active && props.stepDone(index);
            const value = props.stepValue(index);
            return (
              <li key={step.id} className="relative shrink-0">
                <button
                  type="button"
                  disabled={!active && !props.stepReachable(index)}
                  aria-current={active ? "step" : undefined}
                  onClick={() => onGoto(index, 0)}
                  className="hover:bg-accent flex w-full items-start gap-2.5 rounded-lg px-1.5 py-2 text-left disabled:cursor-default disabled:hover:bg-transparent"
                >
                  <span
                    className={cn(
                      "bg-card z-10 grid size-6.5 shrink-0 place-items-center rounded-full border text-xs font-medium tabular-nums",
                      active && "bg-primary text-primary-foreground border-primary",
                      done && "border-emerald-600 bg-emerald-600 text-white",
                    )}
                  >
                    {done ? <CheckIcon className="size-3.5" /> : index + 1}
                  </span>
                  <span className="min-w-0 whitespace-nowrap lg:whitespace-normal">
                    <span
                      className={cn(
                        "block text-sm font-medium",
                        !active && !done && "text-muted-foreground font-medium",
                      )}
                    >
                      {step.label}
                    </span>
                    {value && !active && (
                      <span className="text-muted-foreground block text-xs max-lg:hidden">
                        {value}
                      </span>
                    )}
                  </span>
                </button>

                {active && (
                  <ol className="ml-[1.1rem] flex flex-col gap-px border-l border-dashed pl-3 max-lg:hidden">
                    {substeps.map((entry, index) => {
                      const current = index === subIndex;
                      return (
                        <li key={entry.sub.key}>
                          <button
                            type="button"
                            disabled={!current && !entry.reachable}
                            onClick={() => onGoto(stepIndex, index)}
                            className={cn(
                              "text-muted-foreground hover:bg-accent hover:text-foreground flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm disabled:cursor-default disabled:opacity-55 disabled:hover:bg-transparent",
                              entry.done && "text-foreground",
                              current && "bg-accent text-foreground font-medium",
                            )}
                          >
                            <span
                              className={cn(
                                "size-2 shrink-0 rounded-full border-[1.5px]",
                                entry.done && !current && "border-emerald-600 bg-emerald-600",
                                current && "border-primary bg-primary",
                              )}
                            />
                            <span className="min-w-0 truncate">{entry.sub.nav}</span>
                            {entry.value && !current && (
                              <span className="ml-auto max-w-28 truncate text-xs font-normal">
                                {entry.value}
                              </span>
                            )}
                          </button>
                        </li>
                      );
                    })}
                    {props.pending && (
                      <li className="text-muted-foreground flex items-center gap-2 px-2 py-1.5 text-sm opacity-55">
                        <span className="size-2 shrink-0 rounded-full border-[1.5px]" />
                        {props.pending}
                      </li>
                    )}
                  </ol>
                )}
              </li>
            );
          })}
        </ol>

        {props.summary}
      </div>

      {props.footer && (
        <div className="bg-card sticky bottom-0 mt-auto flex flex-col gap-1.5 border-t p-4 max-lg:hidden">
          {props.footer}
        </div>
      )}
    </aside>
  );
}

function DraftFooter(props: Props) {
  const { t } = useTranslation("wizard", { keyPrefix: "rail" });
  return (
    <>
      <Button type="button" variant="outline" onClick={props.onSaveDraft} disabled={props.saving}>
        <SaveIcon /> {props.guest ? t("guestSave") : t("saveDraft")}
      </Button>
      <span className="text-muted-foreground text-center text-xs">
        {props.guest
          ? t("guestNote")
          : props.savedAt
            ? t("savedAt", { time: props.savedAt })
            : t("autosave")}
      </span>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="text-muted-foreground h-7 self-center text-xs"
        onClick={props.onCancel}
      >
        {t("cancel")}
      </Button>
    </>
  );
}

function Summary({ state, derived, klass, species, skills, feats, languages }: Props) {
  const { t } = useTranslation("wizard", { keyPrefix: "rail" });
  const pending = <span className="text-muted-foreground">—</span>;
  const vital = (label: string, value: React.ReactNode) => (
    <div className="rounded-lg border px-1.5 py-2 text-center">
      <span className="type-heading block tabular-nums">{value ?? pending}</span>
      <span className="type-label">{label}</span>
    </div>
  );
  const darkvision = derived?.darkvision ?? species?.darkvision ?? 0;
  const rows: [string, React.ReactNode][] = [
    [t("hitDice"), klass ? `${state.level}d${klass.hitDie}` : pending],
    [t("proficiency"), signed(proficiencyBonus(state.level))],
    [t("speed"), species ? formatDistance(derived?.speed ?? species.speed) : pending],
  ];
  // A species without darkvision simply has no line for it.
  if (!species || darkvision > 0)
    rows.push([t("darkvision"), species ? formatDistance(darkvision) : pending]);
  rows.push(
    [t("passivePerception"), derived ? derived.passivePerception : pending],
    [
      t("saves"),
      klass ? klass.savingThrows.map((ability) => ABILITY_ABBR[ability]).join(", ") : pending,
    ],
  );

  const tags = (title: string, values: string[], empty: string) => (
    <div className="flex flex-col gap-1.5">
      <span className="type-label">{title}</span>
      <div className="flex flex-wrap gap-1">
        {values.length > 0 ? (
          values.map((value) => (
            <span key={value} className="bg-muted rounded-full border px-2 py-0.5 text-xs">
              {value}
            </span>
          ))
        ) : (
          <span className="text-muted-foreground text-xs">{empty}</span>
        )}
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-4 max-lg:hidden">
      <div className="flex flex-col gap-2">
        <span className="type-label">{t("summary")}</span>
        <span className="type-heading">{state.name || t("untitled")}</span>
        <div className="grid grid-cols-3 gap-1.5">
          {vital(t("maxHp"), derived?.maxHitPoints)}
          {vital(t("ac"), derived?.armorClass)}
          {vital(t("initiative"), derived ? signed(derived.initiativeBonus) : undefined)}
        </div>
        <div className="grid grid-cols-6 gap-1">
          {ABILITIES.map((ability) => {
            const score = derived?.adjustedAbilityScores[ability];
            return (
              <div key={ability} className="bg-muted rounded-md py-1 text-center">
                <span className="text-muted-foreground block text-xs">{ABILITY_ABBR[ability]}</span>
                <span className="font-medium text-sm tabular-nums">{score ?? "–"}</span>
                <span className="text-muted-foreground block text-xs tabular-nums">
                  {derived ? signed(derived.abilityModifiers[ability]) : " "}
                </span>
              </div>
            );
          })}
        </div>
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-sm">
          {rows.map(([label, value]) => (
            <div key={label} className="contents">
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="text-right tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>
      </div>
      {tags(
        t("skills"),
        skills.map((skill) => SKILL_LABELS[skill]),
        t("noSkills"),
      )}
      {feats.length > 0 && tags(t("feats"), feats, "")}
      {tags(
        t("languagesLabel"),
        languages.map((id) => getLanguage(id)?.name ?? id),
        "",
      )}
    </div>
  );
}
