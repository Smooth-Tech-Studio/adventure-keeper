import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { CheckIcon, ChevronLeftIcon, ChevronRightIcon, InfoIcon, Undo2Icon } from "lucide-react";
import {
  ABILITY_ABBR,
  allClasses,
  CLASS_COMPLEXITY_LABELS,
  CREATURE_SIZE_LABELS,
  DAMAGE_KIND_LABELS,
  SKILL_LABELS,
  subclassLabel,
  allBackgrounds,
  allSpecies,
  backgroundStartingEquipment,
  classFeatures,
  formatDistance,
  getFeat,
  getLanguage,
  getLineage,
  grantedLanguages,
  isSpellcaster,
  speciesFeatures,
  speciesOptionLabel,
  speciesSizes,
  startingEquipmentChoice,
  subclassesFor,
  type Ability,
  type BackgroundDef,
  type ClassComplexity,
  type ClassDef,
  type SpeciesDef,
} from "@adventure-keeper/system-dnd2024";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { circularOffset, hueStyle } from "@/systems/dnd2024/creation-wizard/entity-facts";
import {
  armorTrainingText,
  classRole,
  weaponTrainingText,
  type ClassRole,
} from "@/systems/dnd2024/creation-wizard/entity-facts";
import type { CreationEntity } from "@/systems/dnd2024/creation-wizard/steps";
import { choiceValueSummary, type ChoiceCatalogs } from "@/systems/dnd2024/lib/choices";
import { packNameOf } from "@/systems/dnd2024/lib/pack-labels";
import { compareText } from "@/lib/sort";
import { cn } from "@/lib/utils";
import { useSwipe } from "@/hooks/use-swipe";
import { tr } from "@/i18n";

/**
 * Steps 1 to 3 open on a carousel: one card at a time, nearly the height of the
 * screen, its neighbours set back on each side.
 *
 * Every line on a card is **derived from the rules data** — hit die, saving
 * throws, traits, the origin feat — so nothing here needs keeping in sync, and
 * nothing from the rulebook is reproduced.
 */
interface Props {
  entity: CreationEntity;
  /** The id already chosen, if any — the carousel opens on it. */
  value: string;
  onChoose: (id: string) => void;
  catalogs: ChoiceCatalogs;
  /** Classes only: which family the deck shows (the menu sits by the title). */
  filter?: ClassFilter;
}

interface CardEntry {
  id: string;
  name: string;
  blurb: string;
  /** An illustration from the pack; without one, the tint and the initial. */
  imageUrl?: string;
  pack?: string;
  role?: ClassRole;
  complexity?: ClassComplexity;
  /** What decides: short enough to fit without scrolling. */
  front: ReactNode;
  /** The detail, on the back of the card. */
  back: ReactNode;
}

const abbr = (abilities: readonly Ability[]) =>
  abilities.map((ability) => ABILITY_ABBR[ability]).join(" / ");

/** `"all"`, a play style, or a « prise en main » level (`"complexity:low"`…). */
export type ClassFilter = "all" | ClassRole | `complexity:${ClassComplexity}`;

/** The filter groups; labels are `wizard:cards.filters.<key>`. */
const FILTER_GROUPS: { key: string; options: { id: ClassFilter; key: string }[] }[] = [
  {
    key: "style",
    options: [
      { id: "martial", key: "martial" },
      { id: "caster", key: "caster" },
      { id: "hybrid", key: "hybrid" },
    ],
  },
  {
    key: "handling",
    options: [
      { id: "complexity:low", key: "low" },
      { id: "complexity:average", key: "average" },
      { id: "complexity:high", key: "high" },
    ],
  },
];

function matches(entry: CardEntry, filter: ClassFilter): boolean {
  if (filter === "all") return true;
  if (filter.startsWith("complexity:")) return entry.complexity === filter.slice(11);
  return entry.role === filter;
}

export function EntityCarousel({ entity, value, onChoose, catalogs, filter = "all" }: Props) {
  // The cards copy names and texts: rebuilt when the language changes.
  const { i18n } = useTranslation();
  const all = useMemo(
    () => entries(entity, catalogs),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [entity, catalogs, i18n.language],
  );
  const list = all.filter((entry) => matches(entry, filter));

  // Opens on the chosen card, else on the first of the deck.
  const [focusId, setFocusId] = useState(() => value || all[0]?.id);
  const focus = Math.max(
    0,
    list.findIndex((entry) => entry.id === focusId),
  );
  const current = list[focus];
  /** Only the centre card turns over; any move puts it back on its front. */
  const [flipped, setFlipped] = useState(false);

  /** Where the deck stood before the last move: a card that wraps around jumps, it does not slide. */
  const [previousFocusId, setPreviousFocusId] = useState(focusId);
  const previousFocus = list.findIndex((entry) => entry.id === previousFocusId);

  function focusOn(id: string) {
    setPreviousFocusId(current?.id);
    setFocusId(id);
    setFlipped(false);
  }

  function move(delta: number) {
    if (list.length === 0) return;
    focusOn(list[(focus + delta + list.length) % list.length].id);
  }

  /**
   * A letter jumps to the next card whose name starts with it (« e » : Elfe,
   * then Ensorceleur…), accents aside, as in a native list.
   */
  function jump(letter: string) {
    const start = (name: string) =>
      name.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().startsWith(letter);
    for (let step = 1; step <= list.length; step += 1) {
      const entry = list[(focus + step) % list.length];
      if (start(entry.name)) return focusOn(entry.id);
    }
  }

  // Arrows browse, a letter jumps, Space turns the card over, Enter picks —
  // unless a field has the focus.
  const flip = () => setFlipped((value) => !value);
  const handlers = useRef({ move, jump, flip, choose: () => current && onChoose(current.id) });
  useEffect(() => {
    handlers.current = { move, jump, flip, choose: () => current && onChoose(current.id) };
  });
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [role='dialog']")) return;
      if (event.key === "ArrowRight") handlers.current.move(1);
      else if (event.key === "ArrowLeft") handlers.current.move(-1);
      else if (event.key === " " && !target?.closest("button, a")) handlers.current.flip();
      else if (event.key === "Enter" && !target?.closest("button, a")) handlers.current.choose();
      else if (
        event.key.length === 1 &&
        /\p{L}/u.test(event.key) &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey
      ) {
        handlers.current.jump(event.key.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase());
      } else return;
      event.preventDefault();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // A swipe moves one card: on a phone, and with the mouse too.
  const swipe = useSwipe((direction) => move(direction));

  return (
    // Grows into whatever height the screen leaves: no gap under the cards.
    <div className="flex flex-1 flex-col gap-3">
      <div
        className="relative min-h-[28rem] flex-1 touch-pan-y overflow-hidden [perspective:1400px]"
        {...swipe}
      >
        {list.map((entry, index) => {
          // The deck loops: past the last card comes the first one again.
          const offset = circularOffset(index, focus, list.length);
          const before =
            previousFocus < 0 ? offset : circularOffset(index, previousFocus, list.length);
          // A card going round from one end to the other would fly across the
          // stage: it jumps to its new place instead.
          const wraps = Math.abs(offset - before) > 2;
          const distance = Math.abs(offset);
          const active = offset === 0;
          // Percentages of the card's own width: no measuring needed.
          const shift = active ? 0 : Math.sign(offset) * (62 + (distance - 1) * 32);
          const scale = active ? 1 : Math.max(0.7, 0.86 - (distance - 1) * 0.08);
          return (
            <div
              key={entry.id}
              aria-hidden={!active}
              onClick={active ? undefined : () => focusOn(entry.id)}
              className={cn(
                "absolute top-1/2 left-1/2 aspect-[2/3] h-[min(800px,calc(100%-1.5rem))] max-w-[82%] transition-[transform,opacity,filter] duration-500 ease-[cubic-bezier(.2,.8,.2,1)] motion-reduce:transition-none",
                !active && "cursor-pointer saturate-[.6] [&_.card-body]:pointer-events-none",
                distance > 2 && "pointer-events-none opacity-0",
                wraps && "transition-none",
              )}
              style={{
                transform: `translate(calc(-50% + ${shift}%), -50%) scale(${scale}) rotateY(${active ? 0 : -Math.sign(offset) * 12}deg)`,
                zIndex: 20 - distance,
              }}
            >
              <EntityCard
                entry={entry}
                chosen={entry.id === value}
                onChoose={() => onChoose(entry.id)}
                active={active}
                flipped={active && flipped}
                onFlip={flip}
              />
            </div>
          );
        })}

        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label={tr("wizard:cards.previous")}
          className="absolute top-1/2 left-2 z-30 -translate-y-1/2 rounded-full shadow-md max-sm:hidden"
          onClick={() => move(-1)}
        >
          <ChevronLeftIcon />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label={tr("wizard:cards.next")}
          className="absolute top-1/2 right-2 z-30 -translate-y-1/2 rounded-full shadow-md max-sm:hidden"
          onClick={() => move(1)}
        >
          <ChevronRightIcon />
        </Button>
      </div>

      <div className="flex justify-center gap-1.5">
        {list.map((entry, index) => (
          <button
            key={entry.id}
            type="button"
            aria-label={entry.name}
            aria-current={index === focus}
            onClick={() => focusOn(entry.id)}
            className={cn(
              "bg-border h-1.5 w-1.5 rounded-full transition-all",
              index === focus && "bg-primary w-5",
            )}
          />
        ))}
      </div>
    </div>
  );
}

/** The class families, as a compact menu next to the step title. */
export function ClassFilterSelect({
  value,
  onChange,
}: {
  value: ClassFilter;
  onChange: (value: ClassFilter) => void;
}) {
  const { t } = useTranslation("wizard", { keyPrefix: "cards.filters" });
  return (
    <Select value={value} onValueChange={(next) => onChange(next as ClassFilter)}>
      <SelectTrigger size="sm" className="w-48 shrink-0" aria-label={t("label")}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent align="end">
        <SelectItem value="all">{t("all")}</SelectItem>
        {FILTER_GROUPS.map((group) => (
          <SelectGroup key={group.key}>
            <SelectSeparator />
            <SelectLabel>{tr(`wizard:cards.filters.${group.key}`)}</SelectLabel>
            {group.options.map((option) => (
              <SelectItem key={option.id} value={option.id}>
                {tr(`wizard:cards.filters.${option.key}`)}
              </SelectItem>
            ))}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  );
}

/**
 * A card with two faces. The front says what decides; « Détails », top right,
 * turns it over to the rest. The hidden face is `inert`, so neither the
 * keyboard nor a screen reader reaches it.
 */
function EntityCard({
  entry,
  chosen,
  onChoose,
  active,
  flipped,
  onFlip,
}: {
  entry: CardEntry;
  chosen: boolean;
  onChoose: () => void;
  /** The centre card: the only one that takes the focus and turns over. */
  active: boolean;
  flipped: boolean;
  onFlip: () => void;
}) {
  const { t } = useTranslation("wizard", { keyPrefix: "cards" });
  const choose = (
    <Button type="button" className="w-full" onClick={onChoose} tabIndex={active ? 0 : -1}>
      {chosen ? t("keep") : t("choose", { name: entry.name })}
    </Button>
  );
  const face =
    "bg-card absolute inset-0 flex flex-col overflow-hidden rounded-2xl border shadow-lg backface-hidden";

  return (
    <div style={hueStyle(entry.id)} className="h-full perspective-[1400px]">
      <div
        className={cn(
          "relative h-full transition-transform duration-500 ease-[cubic-bezier(.2,.8,.2,1)] transform-3d motion-reduce:transition-none",
          flipped && "rotate-y-180",
        )}
      >
        {/* Front */}
        <article className={face} aria-hidden={flipped} inert={flipped}>
          {/* The art takes whatever height the text leaves: no empty band under it. */}
          <div className="wizard-art relative grid min-h-24 flex-1 place-items-center">
            {entry.imageUrl ? (
              <img
                src={entry.imageUrl}
                alt=""
                loading="lazy"
                referrerPolicy="no-referrer"
                className="absolute inset-0 size-full object-cover"
              />
            ) : (
              <span aria-hidden className="text-foreground/15 text-8xl font-semibold select-none">
                {entry.name.charAt(0)}
              </span>
            )}
            {chosen && (
              <span className="absolute top-3 left-3 inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2.5 py-0.5 text-xs font-medium text-white">
                {t("chosen")}
                <CheckIcon className="size-3.5" />
              </span>
            )}
            <Button
              type="button"
              size="sm"
              variant="secondary"
              // On a side card, a click brings the card to the centre instead.
              className={cn(
                "absolute top-2.5 right-2.5 h-7 rounded-full px-2.5 text-xs shadow-sm",
                !active && "pointer-events-none",
              )}
              tabIndex={active ? 0 : -1}
              onClick={onFlip}
            >
              <InfoIcon /> {t("details")}
            </Button>
            {entry.pack && (
              <span className="bg-background/80 absolute bottom-2 left-3 rounded-full px-2 py-0.5 text-xs">
                {t("pack", { name: entry.pack })}
              </span>
            )}
          </div>
          <div className="card-body flex min-h-0 shrink flex-col gap-4 p-5">
            <div className="flex min-h-0 flex-col gap-3 overflow-y-auto">
              <h2 className="type-title">{entry.name}</h2>
              <p className="text-sm leading-relaxed">{entry.blurb}</p>
              {entry.front}
            </div>
            {choose}
          </div>
        </article>

        {/* Back */}
        <article className={cn(face, "rotate-y-180")} aria-hidden={!flipped} inert={!flipped}>
          <div className="wizard-art flex shrink-0 items-center justify-between gap-2 px-5 py-3">
            <h2 className="type-title">{entry.name}</h2>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="h-7 rounded-full px-2.5 text-xs shadow-sm"
              onClick={onFlip}
            >
              <Undo2Icon /> {t("back")}
            </Button>
          </div>
          <div className="card-body flex min-h-0 flex-1 flex-col gap-3 p-5">
            <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pr-1 text-sm">
              {entry.back}
            </div>
            {choose}
          </div>
        </article>
      </div>
    </div>
  );
}

// --- Card contents -------------------------------------------------------------

export function FactList({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-sm">
      {rows.map(([label, content]) => (
        <div key={label} className="contents">
          <dt className="text-muted-foreground">{label}</dt>
          <dd className="text-right">{content}</dd>
        </div>
      ))}
    </dl>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-1.5">
      <h3 className="type-label">{title}</h3>
      {children}
    </section>
  );
}

export function NamedLine({ name, text }: { name: string; text?: string }) {
  return (
    <p className="text-sm leading-snug">
      <span className="font-medium">{name}</span>
      {text && <span className="text-muted-foreground"> — {text}</span>}
    </p>
  );
}

function entries(entity: CreationEntity, catalogs: ChoiceCatalogs): CardEntry[] {
  const list =
    entity === "class"
      ? allClasses().map(classEntry)
      : entity === "species"
        ? allSpecies().map(speciesEntry)
        : allBackgrounds().map((background) => backgroundEntry(background, catalogs));
  // The custom background is the way out, not one among the others: it goes last.
  const custom = (entry: CardEntry) => Number(entity === "background" && entry.id === "custom");
  return list.sort((a, b) => custom(a) - custom(b) || compareText(a.name, b.name));
}

function Tags({ values }: { values: string[] }) {
  return (
    <div className="flex flex-wrap gap-1">
      {values.map((value) => (
        <span key={value} className="bg-muted rounded-full border px-2 py-0.5 text-xs">
          {value}
        </span>
      ))}
    </div>
  );
}

function classEntry(klass: ClassDef): CardEntry {
  const levelOne = classFeatures(klass.id, 1);
  const subclasses = subclassesFor(klass.id);
  const role = classRole(klass, isSpellcaster);
  return {
    id: klass.id,
    name: klass.name,
    blurb: klass.blurb,
    imageUrl: klass.imageUrl,
    role,
    complexity: klass.complexity,
    front: (
      <>
        <FactList
          rows={[
            [tr("wizard:cards.hitDie"), `d${klass.hitDie}`],
            [tr("wizard:cards.primary"), abbr(klass.primaryAbility)],
            [tr("wizard:cards.style"), tr(`wizard:cards.roles.${role}`)],
            [tr("wizard:cards.handling"), CLASS_COMPLEXITY_LABELS[klass.complexity]],
          ]}
        />
        <Section title={tr("wizard:cards.atLevel1")}>
          <Tags values={levelOne.map((feature) => feature.name)} />
        </Section>
      </>
    ),
    back: (
      <>
        <FactList
          rows={[
            [tr("wizard:cards.saves"), abbr(klass.savingThrows)],
            [tr("wizard:cards.armor"), armorTrainingText(klass)],
            [tr("wizard:cards.weapons"), weaponTrainingText(klass)],
            [
              tr("wizard:cards.skills"),
              tr("wizard:cards.skillsCount", { count: klass.skillChoices.count }),
            ],
          ]}
        />
        <Section title={tr("wizard:cards.skillsOffered")}>
          <Tags values={klass.skillChoices.from.map((skill) => SKILL_LABELS[skill])} />
        </Section>
        <Section title={tr("wizard:cards.atLevel1")}>
          {levelOne.map((feature) => (
            <NamedLine key={feature.id} name={feature.name} text={feature.summary} />
          ))}
        </Section>
        {subclasses.length > 0 && (
          <Section title={tr("wizard:cards.subclassAt", { label: subclassLabel(klass.id) })}>
            {subclasses.map((subclass) => (
              <NamedLine key={subclass.id} name={subclass.name} text={subclass.blurb} />
            ))}
          </Section>
        )}
      </>
    ),
  };
}

function speciesEntry(species: SpeciesDef): CardEntry {
  const sizes = speciesSizes(species.id).map((size) => CREATURE_SIZE_LABELS[size]);
  const traits = speciesFeatures(species.id);
  const rows: [string, ReactNode][] = [
    [tr("wizard:cards.size"), sizes.join(tr("wizard:cards.or"))],
    [tr("wizard:cards.speed"), formatDistance(species.speed)],
  ];
  // Only a species that has it says so: « Vision dans le noir — » reads as a trait.
  if (species.darkvision > 0) {
    rows.push([tr("wizard:cards.darkvision"), formatDistance(species.darkvision)]);
  }
  const details: [string, ReactNode][] = [];
  if (species.resistances?.length) {
    details.push([
      tr("wizard:cards.resistances"),
      species.resistances.map((kind) => DAMAGE_KIND_LABELS[kind]).join(", "),
    ]);
  }
  const languages = grantedLanguages({ speciesId: species.id })
    .filter((entry) => entry.sourceKind === "species")
    .map((entry) => getLanguage(entry.id)?.name ?? entry.id);
  if (languages.length) details.push([tr("wizard:cards.language"), languages.join(", ")]);
  return {
    id: species.id,
    name: species.name,
    blurb: species.blurb,
    imageUrl: species.imageUrl,
    pack: packNameOf(species.id),
    front: (
      <>
        <FactList rows={rows} />
        <Section title={tr("wizard:cards.traits")}>
          <Tags values={traits.map((trait) => trait.name)} />
        </Section>
      </>
    ),
    back: (
      <>
        {details.length > 0 && <FactList rows={details} />}
        <Section title={tr("wizard:cards.traits")}>
          {traits.map((trait) => (
            <NamedLine key={trait.id} name={trait.name} text={trait.summary} />
          ))}
        </Section>
        {species.choice && (
          <Section title={species.choice.label}>
            {species.choice.options.map((option) => (
              <NamedLine
                key={option}
                name={speciesOptionLabel(species.id, option)}
                text={getLineage(species.id, option)?.summary}
              />
            ))}
          </Section>
        )}
      </>
    ),
  };
}

function backgroundEntry(background: BackgroundDef, catalogs: ChoiceCatalogs): CardEntry {
  const feat = background.originFeatId ? getFeat(background.originFeatId) : undefined;
  const equipment = backgroundStartingEquipment(background.id);
  const equipmentDef = equipment ? startingEquipmentChoice(equipment) : undefined;
  return {
    id: background.id,
    name: background.name,
    blurb: background.blurb,
    imageUrl: background.imageUrl,
    pack: packNameOf(background.id),
    front: (
      <FactList
        rows={[
          [
            tr("wizard:cards.abilities"),
            background.skillProficiencies
              ? abbr(background.abilityOptions)
              : tr("wizard:cards.yourChoice"),
          ],
          [
            tr("wizard:cards.skills"),
            background.skillProficiencies?.map((skill) => SKILL_LABELS[skill]).join(", ") ??
              tr("wizard:cards.twoOfChoice"),
          ],
          [tr("wizard:cards.originFeat"), feat?.name ?? tr("wizard:cards.oneOfChoice")],
        ]}
      />
    ),
    back: (
      <>
        <FactList
          rows={[
            [
              tr("wizard:cards.tool"),
              background.toolProficiency?.label ?? tr("wizard:cards.oneOfChoice"),
            ],
          ]}
        />
        {feat && (
          <Section title={feat.name}>
            <p className="text-muted-foreground text-sm leading-snug">{feat.summary}</p>
          </Section>
        )}
        {equipment && equipmentDef && (
          <Section title={tr("wizard:cards.startingEquipment")}>
            {equipment.options.map((option) => (
              <NamedLine
                key={option.id}
                name={option.label}
                text={choiceValueSummary(equipmentDef, option.id, catalogs)}
              />
            ))}
          </Section>
        )}
      </>
    ),
  };
}
