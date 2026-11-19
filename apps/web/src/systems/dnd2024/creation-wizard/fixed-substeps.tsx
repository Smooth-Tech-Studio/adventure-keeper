import { CheckIcon, DiamondIcon, StarIcon } from "lucide-react";
import {
  ALIGNMENTS,
  ALIGNMENT_LABELS,
  ALIGNMENT_SUMMARY,
  CREATURE_SIZE_LABELS,
  DAMAGE_KIND_LABELS,
  EPIC_BOON_LEVEL,
  allLanguages,
  subclassLabel,
  SUBCLASS_LEVEL,
  asiLevels,
  SKILL_LABELS,
  classFeatures,
  classOptionChoiceId,
  classOptionChoices,
  formatDistance,
  getClassOption,
  getFeat,
  getSubclass,
  grantedLanguages,
  speciesTraitsFor,
  subclassFeatures,
  type Alignment,
  type CharacterDerived,
  type ClassDef,
  type CreatureSize,
  type ClassFeatureDef,
  type LanguageDef,
  type SpeciesDef,
} from "@adventure-keeper/system-dnd2024";
import { useTranslation } from "react-i18next";

import { Textarea } from "@/components/ui/textarea";
import { LEVELS, type FormState, type SetForm } from "@/systems/dnd2024/character-form/state";
import { FactList, NamedLine } from "@/systems/dnd2024/creation-wizard/entity-carousel";
import {
  armorTrainingText,
  weaponTrainingText,
} from "@/systems/dnd2024/creation-wizard/entity-facts";
import { languagesToPick, chosenLanguages } from "@/systems/dnd2024/creation-wizard/substeps";
import { useWeaponCatalog } from "@/systems/dnd2024/lib/equipment";
import { featureUsesText } from "@/systems/dnd2024/lib/feature-uses";
import { cn } from "@/lib/utils";
import { currentLanguage } from "@/i18n";

/**
 * The sub-steps that are not rules choices: who the character is, what the
 * class and species already give, alignment, languages and backstory.
 */

export function Panel({
  title,
  children,
  className,
}: {
  title?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("bg-card flex flex-col gap-3 rounded-xl border p-4", className)}>
      {title && <h3 className="type-heading flex flex-wrap items-center gap-2">{title}</h3>}
      {children}
    </section>
  );
}

// --- Name and level ------------------------------------------------------------

const TIERS = [
  { key: "local", span: 4, to: 4 },
  { key: "realm", span: 6, to: 10 },
  { key: "masters", span: 6, to: 16 },
  { key: "world", span: 4, to: 20 },
] as const;

export function IdentityStep({
  state,
  set,
  klass,
  species,
  showErrors,
}: {
  state: FormState;
  set: SetForm;
  klass: ClassDef;
  species?: SpeciesDef;
  showErrors: boolean;
}) {
  const { t } = useTranslation("wizard", { keyPrefix: "fixed" });
  const asi = asiLevels(klass.id);
  const mark = (level: number) =>
    level === SUBCLASS_LEVEL ? (
      <DiamondIcon className="mx-auto size-3 fill-current" />
    ) : level === EPIC_BOON_LEVEL ? (
      <StarIcon className="mx-auto size-3 fill-current" />
    ) : asi.includes(level) ? (
      "+"
    ) : (
      ""
    );
  const unlocks = [
    ...(state.level >= SUBCLASS_LEVEL
      ? [t("unlockSubclass", { label: subclassLabel(klass.id), level: SUBCLASS_LEVEL })]
      : []),
    ...asi.filter((level) => level <= state.level).map((level) => t("unlockAsi", { level })),
    ...(state.level >= EPIC_BOON_LEVEL ? [t("unlockEpic", { level: EPIC_BOON_LEVEL })] : []),
  ];
  const tier = TIERS.findIndex((entry) => state.level <= entry.to);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col items-center gap-2 px-4 pt-4 text-center">
        <label htmlFor="wizard-name" className="type-label">
          {t("name")}
        </label>
        <input
          id="wizard-name"
          autoComplete="off"
          placeholder={t("namePlaceholder")}
          value={state.name}
          onChange={(event) => set("name", event.target.value)}
          aria-invalid={showErrors && !state.name.trim()}
          className="focus:border-primary placeholder:text-muted-foreground/40 w-full max-w-xl border-0 border-b-2 bg-transparent type-figure py-1.5 text-center outline-none aria-invalid:border-destructive"
        />
        <p className="text-muted-foreground text-sm">
          {klass.name}
          {species ? ` · ${species.name}` : ""}
          {t("nameHint")}
        </p>
        {showErrors && !state.name.trim() && (
          <p className="text-destructive text-sm">{t("nameRequired")}</p>
        )}
      </div>

      <Panel
        title={
          <span className="flex items-baseline gap-2">
            {t("startLevel")}
            <span className="type-figure">{state.level}</span>
          </span>
        }
      >
        <div
          className="grid grid-cols-10 gap-1 sm:grid-cols-20"
          role="radiogroup"
          aria-label={t("startLevel")}
        >
          {LEVELS.map((level) => (
            <button
              key={level}
              type="button"
              role="radio"
              aria-checked={state.level === level}
              aria-label={t("level", { level })}
              onClick={() => set("level", level)}
              className={cn(
                "h-9 min-w-0 rounded-md border text-xs tabular-nums transition-colors",
                level < state.level && "bg-muted",
                state.level === level &&
                  "bg-primary text-primary-foreground border-primary font-medium",
              )}
            >
              {level}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-10 gap-1 text-center text-xs font-medium text-emerald-600 sm:grid-cols-20 dark:text-emerald-400">
          {LEVELS.map((level) => (
            <span key={level}>{mark(level)}</span>
          ))}
        </div>
        <div className="text-muted-foreground grid grid-cols-[4fr_6fr_6fr_4fr] gap-1 text-xs max-sm:hidden">
          {TIERS.map((entry, index) => (
            <span
              key={entry.key}
              className={cn("border-t-2 pt-1", index === tier && "border-primary text-foreground")}
            >
              {t(`tiers.${entry.key}`)}
            </span>
          ))}
        </div>
        <p className="text-muted-foreground flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs">
          <DiamondIcon className="size-3 fill-current" />
          {t("legendSubclass", { subclass: subclassLabel(klass.id).toLowerCase() })}
          <span aria-hidden>·</span>+ {t("legendAsi")}
          <span aria-hidden>·</span>
          <StarIcon className="size-3 fill-current" />
          {t("legendEpic")}
        </p>
        <div className="flex flex-wrap gap-1.5">
          {unlocks.length > 0 ? (
            unlocks.map((unlock) => (
              <span key={unlock} className="bg-muted rounded-full border px-2.5 py-0.5 text-xs">
                {unlock}
              </span>
            ))
          ) : (
            <span className="text-muted-foreground text-xs">{t("levelOne")}</span>
          )}
        </div>
      </Panel>
    </div>
  );
}

// --- Read-only recaps ----------------------------------------------------------

/**
 * Features under their level, each with what it gives at `level`: its uses per
 * rest, and when that number grows.
 */
/** What the character picked for a feature: « Gardien » for « Ordre primitif ». */
interface FeatureChoice {
  value: string;
  /** What the pick does, when it says more than the feature (a class option). */
  text?: string;
}

function FeaturesByLevel({
  features,
  level,
  chosen = () => undefined,
}: {
  features: ClassFeatureDef[];
  level: number;
  chosen?: (feature: ClassFeatureDef) => FeatureChoice | undefined;
}) {
  const { t } = useTranslation("wizard", { keyPrefix: "fixed" });
  const levels = [...new Set(features.map((feature) => feature.level))];
  return (
    <div className="flex flex-col gap-3">
      {levels.map((at) => (
        <section key={at} className="grid gap-1.5">
          <h3 className="type-label">{t("level", { level: at })}</h3>
          {features
            .filter((feature) => feature.level === at)
            .map((feature) => {
              const pick = chosen(feature);
              return (
                <div key={feature.id} className="grid gap-0.5">
                  {pick ? (
                    // The player's own pick, rather than every option of the feature.
                    <NamedLine
                      name={t("featureChoice", { feature: feature.name, choice: pick.value })}
                      text={pick.text ?? feature.summary}
                    />
                  ) : (
                    <NamedLine name={feature.name} text={feature.summary} />
                  )}
                  {feature.uses && (
                    <p className="text-xs text-muted-foreground">
                      {featureUsesText(feature.uses, Math.max(level, at))}
                    </p>
                  )}
                </div>
              );
            })}
        </section>
      ))}
    </div>
  );
}

export function ClassFeaturesStep({
  klass,
  level,
  subclassId,
  state,
}: {
  klass: ClassDef;
  level: number;
  subclassId?: string;
  /** The picks so far: a feature already settled shows what was chosen. */
  state?: Pick<FormState, "choices" | "skillExpertise" | "weaponMasteries">;
}) {
  const { t } = useTranslation("wizard", { keyPrefix: "fixed" });
  const weapons = useWeaponCatalog(Boolean(state?.weaponMasteries.length));
  const picked = (choiceId: string) =>
    state?.choices.find((entry) => entry.choiceId === choiceId)?.values ?? [];
  // Feature ids carry the French name whatever the language (`fighter:1:Style de combat`).
  const chosen = (feature: ClassFeatureDef): FeatureChoice | undefined => {
    if (!state) return undefined;
    const option = classOptionChoices(klass.id).find(
      (choice) => choice.level === feature.level && choice.label === feature.name,
    );
    if (option) {
      const value = getClassOption(picked(classOptionChoiceId(option))[0] ?? "");
      return value && { value: value.name, text: value.summary };
    }
    if (feature.id.endsWith(":Style de combat")) {
      const feat = getFeat(picked(`class:${klass.id}:fighting-style`)[0] ?? "");
      return feat && { value: feat.name, text: feat.summary };
    }
    if (feature.id.endsWith(":Expertise") && state.skillExpertise.length > 0) {
      return { value: state.skillExpertise.map((skill) => SKILL_LABELS[skill]).join(", ") };
    }
    if (feature.id.endsWith(":Bottes d'arme") && state.weaponMasteries.length > 0) {
      const name = (id: string) => weapons?.find((weapon) => weapon.id === id)?.name ?? id;
      return { value: state.weaponMasteries.map(name).join(", ") };
    }
    return undefined;
  };
  const acquired = classFeatures(klass.id, level);
  // The next three levels that bring something, told in full: what is coming.
  const later = classFeatures(klass.id, 20).filter((feature) => feature.level > level);
  const nextLevels = [...new Set(later.map((feature) => feature.level))].slice(0, 3);
  const upcoming = later.filter((feature) => nextLevels.includes(feature.level));
  const subclass = subclassId ? getSubclass(subclassId) : undefined;
  return (
    <div className="flex flex-col gap-4">
      <Panel>
        <FeaturesByLevel features={acquired} level={level} chosen={chosen} />
      </Panel>
      {subclass && (
        <Panel title={subclass.name}>
          {subclassFeatures(subclass.id, level).map((feature) => (
            <NamedLine key={feature.name} name={feature.name} text={feature.summary} />
          ))}
        </Panel>
      )}
      {upcoming.length > 0 && (
        <Panel title={t("upcoming")}>
          <div className="text-muted-foreground">
            <FeaturesByLevel features={upcoming} level={level} />
          </div>
        </Panel>
      )}
      <Panel title={t("proficiencies")}>
        <FactList
          rows={[
            [t("armor"), armorTrainingText(klass)],
            [t("weapons"), weaponTrainingText(klass)],
          ]}
        />
      </Panel>
    </div>
  );
}

export function SpeciesTraitsStep({
  species,
  lineage,
  size,
  derived,
}: {
  species: SpeciesDef;
  /** The lineage picked, if any: its trait tells only that one. */
  lineage?: string;
  /** The size picked, for a species that offers two. */
  size?: CreatureSize;
  derived: CharacterDerived | null;
}) {
  const { t } = useTranslation("wizard", { keyPrefix: "fixed" });
  const rows: [string, React.ReactNode][] = [
    [
      t("size"),
      // Before the scores exist there is no derived block: the pick, else the species'.
      CREATURE_SIZE_LABELS[
        derived?.size ?? size ?? (Array.isArray(species.size) ? species.size[0] : species.size)
      ],
    ],
    [t("speed"), formatDistance(derived?.speed ?? species.speed)],
  ];
  const darkvision = derived?.darkvision ?? species.darkvision;
  if (darkvision > 0) rows.push([t("darkvision"), formatDistance(darkvision)]);
  const resistances = derived?.resistances ?? species.resistances ?? [];
  if (resistances.length)
    rows.push([t("resistances"), resistances.map((kind) => DAMAGE_KIND_LABELS[kind]).join(", ")]);
  return (
    <div className="flex flex-col gap-4">
      <Panel>
        {speciesTraitsFor(species.id, lineage).map((trait) => (
          <NamedLine key={trait.id} name={trait.name} text={trait.summary} />
        ))}
      </Panel>
      <Panel title={t("profile")}>
        <FactList rows={rows} />
      </Panel>
    </div>
  );
}

// --- Alignment -------------------------------------------------------------------

const ETHICS = ["L", "N", "C"] as const;
const MORALS = ["G", "N", "E"] as const;

/** The classic 3 × 3 chart: law to chaos across, good to evil down. */
export function AlignmentGrid({
  value,
  onChange,
}: {
  value: Alignment | "";
  onChange: (value: Alignment) => void;
}) {
  const { t } = useTranslation("wizard", { keyPrefix: "fixed" });
  const idOf = (ethic: string, moral: string) =>
    (ethic === "N" && moral === "N" ? "N" : `${ethic}${moral}`) as Alignment;
  return (
    <div className="grid grid-cols-[2.5rem_repeat(3,minmax(0,1fr))] gap-2 sm:grid-cols-[4rem_repeat(3,minmax(0,1fr))]">
      <span />
      {ETHICS.map((key) => (
        <span key={key} className="type-label text-center">
          {t(`ethics.${key}`)}
        </span>
      ))}
      {MORALS.map((moral) => (
        <div key={moral} className="contents">
          <span className="type-label grid place-items-center text-center">
            {t(`morals.${moral}`)}
          </span>
          {ETHICS.map((ethic) => {
            const id = idOf(ethic, moral);
            if (!ALIGNMENTS.includes(id)) return <span key={ethic} />;
            const selected = value === id;
            return (
              <button
                key={ethic}
                type="button"
                aria-pressed={selected}
                onClick={() => onChange(id)}
                className={cn(
                  "hover:bg-accent relative flex min-h-28 flex-col items-center justify-center gap-1 rounded-xl border p-3 text-center transition-colors",
                  selected && "border-primary bg-accent ring-primary ring-1",
                )}
              >
                {selected && (
                  <CheckIcon className="absolute top-2 right-2 size-4 text-emerald-600 dark:text-emerald-400" />
                )}
                <span className="font-medium">{ALIGNMENT_LABELS[id]}</span>
                <span className="text-muted-foreground text-xs leading-snug">
                  {ALIGNMENT_SUMMARY[id]}
                </span>
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// --- Languages -------------------------------------------------------------------

/**
 * Every language as a card. Those the species or class grant are already
 * ticked and locked — they are known, not chosen — and do not count against
 * the two the player adds.
 */
export function LanguagePicker({
  state,
  set,
  showErrors,
}: {
  state: FormState;
  set: SetForm;
  showErrors: boolean;
}) {
  const { t } = useTranslation("wizard", { keyPrefix: "fixed" });
  const granted = new Map(
    grantedLanguages({
      speciesId: state.speciesId || undefined,
      classId: state.classId || undefined,
    }).map((entry) => [entry.id, entry.source]),
  );
  const chosen = chosenLanguages(state);
  const toPick = languagesToPick(state);
  const full = chosen.length >= toPick;
  const byGrant = (a: LanguageDef, b: LanguageDef) =>
    (granted.has(a.id) ? 0 : 1) - (granted.has(b.id) ? 0 : 1) ||
    a.name.localeCompare(b.name, currentLanguage());

  function toggle(language: LanguageDef) {
    set(
      "languages",
      chosen.includes(language.id)
        ? chosen.filter((id) => id !== language.id)
        : full
          ? chosen
          : [...chosen, language.id],
    );
  }

  const card = (language: LanguageDef) => {
    const source = granted.get(language.id);
    const selected = Boolean(source) || chosen.includes(language.id);
    return (
      <button
        key={language.id}
        type="button"
        aria-pressed={selected}
        disabled={Boolean(source) || (!selected && full)}
        onClick={() => toggle(language)}
        className={cn(
          "hover:bg-accent flex flex-col gap-0.5 rounded-lg border px-3 py-2 text-left transition-colors disabled:cursor-default",
          selected && "border-primary bg-accent ring-primary ring-1",
          !selected && full && "opacity-45",
        )}
      >
        <span className="flex items-center justify-between gap-2 text-sm font-medium">
          {language.name}
          {selected && <CheckIcon className="size-4 text-emerald-600 dark:text-emerald-400" />}
        </span>
        <span className="text-muted-foreground text-xs leading-snug">
          {source ? t("known", { source }) : language.summary}
        </span>
      </button>
    );
  };

  const standard = allLanguages()
    .filter((language) => language.kind === "standard")
    .sort(byGrant);
  const rare = allLanguages()
    .filter((language) => language.kind !== "standard")
    .sort(byGrant);
  return (
    <div className="flex flex-col gap-4">
      <Panel
        className={cn(showErrors && chosen.length !== toPick && "border-destructive")}
        title={
          <>
            {t("standardLanguages")}
            <span
              className={cn(
                "rounded-full border px-2 text-xs tabular-nums",
                chosen.length === toPick && "border-emerald-600 bg-emerald-600 text-white",
              )}
            >
              {t("toPick", { picked: chosen.length, count: toPick })}
            </span>
          </>
        }
      >
        <div className="grid grid-cols-[repeat(auto-fill,minmax(13rem,1fr))] gap-2">
          {standard.map(card)}
        </div>
      </Panel>
      <Panel title={t("rareLanguages")}>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(13rem,1fr))] gap-2">
          {rare.map(card)}
        </div>
      </Panel>
    </div>
  );
}

export function LoreStep({ state, set }: { state: FormState; set: SetForm }) {
  const { t } = useTranslation("wizard", { keyPrefix: "fixed" });
  return (
    <Panel>
      <Textarea
        id="wizard-lore"
        rows={8}
        placeholder={t("lorePlaceholder")}
        value={state.lore}
        onChange={(event) => set("lore", event.target.value)}
      />
      <p className="text-muted-foreground mt-1 text-xs">{t("loreMarkdownHint")}</p>
      <p className="text-muted-foreground text-xs">{t("loreLater")}</p>
    </Panel>
  );
}
