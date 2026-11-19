import type { ReactNode } from "react";
import { ChevronDownIcon, LanguagesIcon } from "lucide-react";
import type { Dnd2024Character } from "@adventure-keeper/schemas";
import {
  ABILITY_LABELS,
  CREATURE_SIZE_LABELS,
  FEAT_CATEGORY_LABELS,
  SKILL_LABELS,
  classFeatures,
  formatDistance,
  formatFeatureRoll,
  getBackground,
  getClass,
  getFeat,
  getLanguage,
  getSpecies,
  getSubclass,
  grantedLanguages,
  martialArtsDie,
  speciesOptionLabel,
  speciesTraitsFor,
  subclassFeatures,
  type CharacterDerived,
  type FeatDef,
  type FeatureRoll,
  type FeatureUses,
  type WeaponProficiencyGrant,
} from "@adventure-keeper/system-dnd2024";
import { useTranslation } from "react-i18next";

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { EditPen } from "@/systems/dnd2024/sheet/sheet-layouts";
import { SheetCard, sheetRow } from "@/systems/dnd2024/sheet/sheet-parts";
import {
  isTodo,
  type SheetEditing,
  type SheetOrigin,
} from "@/components/character/character-sheet/types";
import type { WithId } from "@/lib/collections";
import { featureUsesText } from "@/systems/dnd2024/lib/feature-uses";
import { sortedByLabel } from "@/lib/sort";
import { cn } from "@/lib/utils";

interface FeatureLine {
  key: string;
  name: string;
  summary: string;
  level?: number;
  uses?: FeatureUses;
  /** What using it rolls, computed: « 1d8 + 3 PV », « Défense patiente : 2d8 PV temp. ». */
  roll?: string;
  /** Said before the level (« Don d'origine »). */
  note?: string;
}

/** A feature as one line that opens on its summary: name · level · uses. */
function Feature({ line, characterLevel }: { line: FeatureLine; characterLevel: number }) {
  const { t } = useTranslation("characters", { keyPrefix: "features" });
  return (
    <Collapsible className="border-b last:border-b-0">
      <CollapsibleTrigger className="hover:bg-accent group flex w-full items-center gap-2 rounded-md px-1 py-2 text-left">
        <span className="min-w-0 flex-1">
          <span className="font-semibold">{line.name}</span>
          <span className="text-muted-foreground">
            {line.note && ` · ${line.note}`}
            {line.level !== undefined && t("lvl", { level: line.level })}
            {line.uses && ` · ${featureUsesText(line.uses, characterLevel)}`}
          </span>
          {line.roll && <span className="text-foreground font-medium"> · {line.roll}</span>}
        </span>
        <ChevronDownIcon className="text-muted-foreground size-4 shrink-0 transition-transform group-data-[state=open]:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent className="text-muted-foreground px-1 pb-2 text-xs">
        {line.summary}
      </CollapsibleContent>
    </Collapsible>
  );
}

/** What an origin trains, as a small table on a tinted panel at the top of its block. */
function Facts({ facts }: { facts: [string, string][] }) {
  if (facts.length === 0) return null;
  return (
    <dl className="bg-muted/60 mb-1.5 grid grid-cols-[7.5rem_minmax(0,1fr)] gap-x-3 gap-y-1 rounded-lg px-2.5 py-2">
      {facts.map(([label, value]) => (
        <div key={label} className="contents">
          <dt className="text-muted-foreground">{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

const capitalized = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** One block per origin (class, subclass, species, background, feats), then the languages. */
export function OriginFeatures({
  character,
  derived,
  toolName,
  editing,
}: {
  character: WithId<Dnd2024Character>;
  derived: CharacterDerived;
  /** A tool's name from its catalogue id (the catalogue loads lazily). */
  toolName: (id: string) => string;
  editing?: SheetEditing;
}) {
  const { t } = useTranslation("characters", { keyPrefix: "features" });
  const level = character.level ?? 1;
  const klass = getClass(character.classId);
  const species = getSpecies(character.speciesId);
  const background = getBackground(character.backgroundId);
  const subclass = character.subclassId ? getSubclass(character.subclassId) : undefined;
  const originFeatId = background?.originFeatId;
  const feats = (character.featIds ?? [])
    .map(getFeat)
    .filter((feat): feat is FeatDef => Boolean(feat));

  const weaponsText = (grant: WeaponProficiencyGrant) =>
    [
      grant.simple && t("simple"),
      grant.martial === true && t("martial"),
      grant.martial === "finesse-or-light" && t("martialFinesse"),
      grant.martial === "light" && t("martialLight"),
    ]
      .filter(Boolean)
      .join(", ") || t("noneLower");

  const rollCtx = {
    classId: character.classId,
    level,
    abilityModifiers: character.abilityModifiers,
  };
  const rollText = (roll: FeatureRoll | undefined) => {
    if (!roll) return undefined;
    const text = t(roll.gives === "tempHp" ? "rollTempHp" : "rollHp", {
      roll: formatFeatureRoll(roll, rollCtx),
    });
    return roll.label ? `${roll.label} : ${text}` : text;
  };
  const maDie = martialArtsDie(character.classId, level);

  const classTools = klass?.toolProficiencies ?? [];
  const backgroundTool =
    background?.toolProficiency && "toolId" in background.toolProficiency
      ? background.toolProficiency.toolId
      : undefined;
  // Tools trained by a choice (class, background group, feat): with the background's.
  const otherTools = derived.toolProficiencies.filter(
    (id) => !classTools.includes(id) && id !== backgroundTool,
  );

  const blocks: {
    origin: SheetOrigin;
    title: string;
    name: string;
    facts: [string, string][];
    lines: FeatureLine[];
    empty?: string;
  }[] = [
    {
      origin: "class",
      title: t("class"),
      name: `${klass?.name ?? character.classId} ${t("lvlShort", { level })}`,
      facts: klass
        ? [
            [
              t("armor"),
              capitalized(
                klass.armorTraining.length
                  ? klass.armorTraining.map((category) => t(`armorKinds.${category}`)).join(", ")
                  : t("noneLower"),
              ),
            ],
            [t("weapons"), capitalized(weaponsText(klass.weaponProficiency))],
            [t("saves"), klass.savingThrows.map((ability) => ABILITY_LABELS[ability]).join(", ")],
            ...(classTools.length
              ? [[t("tools"), classTools.map(toolName).join(", ")] as [string, string]]
              : []),
            ...(maDie ? [[t("martialArts"), maDie.die] as [string, string]] : []),
          ]
        : [],
      lines: classFeatures(character.classId, level).map((feature) => ({
        key: feature.id,
        name: feature.name,
        summary: feature.summary,
        level: feature.level,
        uses: feature.uses,
        roll: rollText(feature.roll),
      })),
    },
    ...(subclass || level >= 3
      ? [
          {
            origin: "subclass" as const,
            title: t("subclass"),
            name: subclass?.name ?? "—",
            facts: [],
            lines: subclass
              ? subclassFeatures(subclass.id, level).map((feature) => ({
                  key: feature.name,
                  name: feature.name,
                  summary: feature.summary,
                  level: feature.level,
                  roll: rollText(feature.roll),
                }))
              : [],
            empty: t("subclassPending"),
          },
        ]
      : []),
    {
      origin: "species",
      title: t("species"),
      name: `${species?.name ?? character.speciesId}${
        character.speciesChoice
          ? ` (${speciesOptionLabel(character.speciesId, character.speciesChoice)})`
          : ""
      }`,
      facts: [
        [t("size"), CREATURE_SIZE_LABELS[derived.size]],
        [t("speed"), formatDistance(derived.speed)],
      ],
      lines: speciesTraitsFor(character.speciesId, character.speciesChoice).map((trait) => ({
        key: trait.id,
        name: trait.name,
        summary: trait.summary,
        uses: trait.uses,
      })),
    },
    {
      origin: "background",
      title: t("background"),
      name: background?.name ?? character.backgroundId,
      facts: [
        ...(background?.skillProficiencies
          ? [
              [
                t("skills"),
                background.skillProficiencies.map((skill) => SKILL_LABELS[skill]).join(", "),
              ] as [string, string],
            ]
          : []),
        // A tool to pick from a group: the one picked (with any other trained by a choice).
        ...(background?.toolProficiency
          ? [
              [
                t("tool"),
                backgroundTool
                  ? toolName(backgroundTool)
                  : otherTools.length
                    ? otherTools.map(toolName).join(", ")
                    : background.toolProficiency.label,
              ] as [string, string],
            ]
          : []),
        ...(backgroundTool && otherTools.length
          ? [[t("otherTools"), otherTools.map(toolName).join(", ")] as [string, string]]
          : []),
      ],
      lines: feats
        .filter((feat) => feat.id === originFeatId)
        .map((feat) => ({
          key: feat.id,
          name: feat.name,
          summary: feat.summary,
          note: t("originFeat"),
        })),
    },
    ...(feats.some((feat) => feat.id !== originFeatId)
      ? [
          {
            origin: "feats" as const,
            title: t("feats"),
            name: "",
            facts: [],
            lines: feats
              .filter((feat) => feat.id !== originFeatId)
              .map((feat) => ({
                key: feat.id,
                name: feat.name,
                summary: feat.summary,
                note: FEAT_CATEGORY_LABELS[feat.category].toLowerCase(),
              })),
          },
        ]
      : []),
  ];

  return (
    <div className="grid gap-3">
      {blocks.map((block) => (
        <SheetCard
          key={block.origin}
          title={
            <>
              {block.title}
              {block.name && (
                <span className="text-foreground tracking-normal normal-case">{block.name}</span>
              )}
            </>
          }
          action={<EditPen editing={editing} block="options" origin={block.origin} />}
          todo={isTodo(editing, block.origin)}
        >
          <Facts facts={block.facts} />
          {block.lines.length === 0 && block.empty ? (
            <p className="text-muted-foreground px-1 text-xs">{block.empty}</p>
          ) : (
            block.lines.map((line) => <Feature key={line.key} line={line} characterLevel={level} />)
          )}
        </SheetCard>
      ))}
      <Languages character={character} editing={editing} />
      <p className="text-muted-foreground text-[10px]">{t("ownWords")}</p>
    </div>
  );
}

/** Every language known, each with where it comes from: by default, the species, a choice. */
function Languages({
  character,
  editing,
}: {
  character: WithId<Dnd2024Character>;
  editing?: SheetEditing;
}) {
  const { t } = useTranslation("characters", { keyPrefix: "features" });
  const granted = grantedLanguages({ speciesId: character.speciesId, classId: character.classId });
  const grantedIds = new Set(granted.map((entry) => entry.id));
  const languages = sortedByLabel(
    [
      ...granted.map((entry) => ({
        id: entry.id,
        from:
          entry.sourceKind === "base"
            ? t("langDefault")
            : `${entry.sourceKind === "species" ? t("species") : t("class")} · ${entry.source}`,
      })),
      ...(character.languages ?? [])
        .filter((id) => !grantedIds.has(id))
        .map((id) => ({ id, from: t("langChosen") })),
    ],
    ({ id }) => getLanguage(id)?.name ?? id,
  );
  const lines: ReactNode[] = languages.map(({ id, from }) => (
    <li key={id} className={cn("text-sm", sheetRow)}>
      <span className="font-semibold">{getLanguage(id)?.name ?? id}</span>
      <span className="text-muted-foreground"> · {from}</span>
    </li>
  ));
  return (
    <SheetCard
      title={t("languages", { count: languages.length })}
      icon={LanguagesIcon}
      action={<EditPen editing={editing} block="proficiencies" />}
      todo={isTodo(editing, "proficiencies")}
    >
      {languages.length === 0 ? (
        <p className="text-muted-foreground">{t("noLanguage")}</p>
      ) : (
        <ul>{lines}</ul>
      )}
    </SheetCard>
  );
}
