import { useMemo, useState } from "react";
import { SearchIcon } from "lucide-react";
import {
  ABILITY_ABBR,
  ARMOR_CATEGORY_LABELS,
  DAMAGE_TYPE_LABELS,
  WEAPON_CATEGORY_LABELS,
  WEAPON_MASTERY_LABELS,
  getClass,
  COIN_ABBR,
  CREATURE_SIZE_LABELS,
  DAMAGE_KIND_LABELS,
  FEAT_CATEGORY_LABELS,
  LANGUAGE_KIND_LABELS,
  MONSTER_TYPE_LABELS,
  PACK_CONTENT_KINDS,
  SKILL_LABELS,
  SPELL_SCHOOL_LABELS,
  TOOL_CATEGORY_LABELS,
  formatCoinPrice,
  formatDistance,
  formatWeight,
  getLanguage,
  translatedPackContent,
  type ContentPack,
  type PackContentKind,
} from "@adventure-keeper/system-dnd2024";
import { useTranslation } from "react-i18next";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { PACK_KIND_PLURALS } from "@/systems/dnd2024/lib/pack-labels";
import { compareText } from "@/lib/sort";
import { tr } from "@/i18n";

type Content = ContentPack["content"];
type Entry<K extends PackContentKind> = Content[K][number];

/** `["str", "dex"]` → « FOR ou DEX ». */
const abilities = (list: readonly string[], join = tr("packs:contents.or")) =>
  list.map((ability) => ABILITY_ABBR[ability as keyof typeof ABILITY_ABBR] ?? ability).join(join);

const signed = (value: number) => (value >= 0 ? `+${value}` : String(value));

/** Facts a card lists under its title — short, scannable. */
function Facts({ items }: { items: (string | false | 0 | undefined | null)[] }) {
  const shown = items.filter((item): item is string => typeof item === "string" && item !== "");
  if (shown.length === 0) return null;
  return (
    <ul className="flex flex-wrap gap-1.5">
      {shown.map((item) => (
        <li key={item}>
          <Badge variant="outline" className="font-normal">
            {item}
          </Badge>
        </li>
      ))}
    </ul>
  );
}

/** A named rule line: « Résistance : … », a trait, a subclass feature. */
function Line({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <p className="text-sm">
      <span className="font-medium">{label}</span> — {children}
    </p>
  );
}

function EntryCard({
  name,
  kicker,
  children,
}: {
  name: string;
  kicker?: string;
  children: React.ReactNode;
}) {
  return (
    <article className="bg-card flex flex-col gap-2 rounded-xl border p-4">
      <header>
        {kicker && <p className="text-muted-foreground text-xs">{kicker}</p>}
        <h3 className="font-semibold">{name}</h3>
      </header>
      {children}
    </article>
  );
}

function SpeciesCard({ entry }: { entry: Entry<"species"> }) {
  const sizes = Array.isArray(entry.size) ? entry.size : [entry.size];
  return (
    <EntryCard name={entry.name}>
      <p className="text-muted-foreground text-sm">{entry.blurb}</p>
      <Facts
        items={[
          sizes.map((size) => CREATURE_SIZE_LABELS[size]).join(tr("packs:contents.or")),
          tr("packs:contents.speed", { speed: formatDistance(entry.speed) }),
          entry.darkvision > 0 &&
            tr("packs:contents.darkvision", { range: formatDistance(entry.darkvision) }),
          entry.resistances?.length &&
            tr("packs:contents.resistance", {
              list: entry.resistances.map((kind) => DAMAGE_KIND_LABELS[kind]).join(", "),
            }),
          entry.languages?.length &&
            tr("packs:contents.languages", {
              list: entry.languages.map((id) => getLanguage(id)?.name ?? id).join(", "),
            }),
        ]}
      />
      {entry.choice && <Line label={entry.choice.label}>{entry.choice.options.join(", ")}</Line>}
      {entry.traits.map((trait) => (
        <Line key={trait.name} label={trait.name}>
          {trait.summary}
        </Line>
      ))}
    </EntryCard>
  );
}

function BackgroundCard({ entry }: { entry: Entry<"backgrounds"> }) {
  return (
    <EntryCard name={entry.name}>
      <p className="text-muted-foreground text-sm">{entry.blurb}</p>
      <Facts
        items={[
          tr("packs:contents.abilities", { list: abilities(entry.abilityOptions, ", ") }),
          entry.skillProficiencies &&
            tr("packs:contents.skills", {
              list: entry.skillProficiencies.map((skill) => SKILL_LABELS[skill]).join(", "),
            }),
          entry.toolProficiency && tr("packs:contents.tool", { name: entry.toolProficiency.label }),
          entry.originFeatId && tr("packs:contents.originFeat", { id: entry.originFeatId }),
          entry.startingKit &&
            tr("packs:contents.kit", { gold: entry.startingKit.gold, coin: COIN_ABBR.gold }),
        ]}
      />
    </EntryCard>
  );
}

/** A class's name: one of the pack's own, or the SRD's. */
type ClassNames = ReadonlyMap<string, string>;
const classNameOf = (id: string, local: ClassNames) => local.get(id) ?? getClass(id)?.name ?? id;

function ClassCard({ entry }: { entry: Entry<"classes"> }) {
  return (
    <EntryCard name={entry.name}>
      <p className="text-muted-foreground text-sm">{entry.blurb}</p>
      <Facts
        items={[
          tr("packs:contents.hitDie", { die: entry.hitDie }),
          tr("packs:contents.abilities", { list: abilities(entry.primaryAbility) }),
          tr("packs:contents.saves", { list: abilities(entry.savingThrows, ", ") }),
          entry.spellcasting && tr(`packs:contents.spellcasting.${entry.spellcasting}`),
          entry.startingEquipment?.options[0]?.label !== undefined &&
            tr("packs:contents.kit", {
              gold: entry.startingEquipment.options[0].gold,
              coin: COIN_ABBR.gold,
            }),
        ]}
      />
      {[...entry.features]
        .sort((a, b) => a.level - b.level)
        .map((feature) => (
          <Line
            key={`${feature.level}-${feature.name}`}
            label={tr("packs:contents.featureLevel", { level: feature.level, name: feature.name })}
          >
            {feature.summary}
          </Line>
        ))}
    </EntryCard>
  );
}

function SubclassCard({
  entry,
  classNames,
}: {
  entry: Entry<"subclasses">;
  classNames: ClassNames;
}) {
  const className = classNameOf(entry.classId, classNames);
  return (
    <EntryCard name={entry.name} kicker={className}>
      <p className="text-muted-foreground text-sm">{entry.blurb}</p>
      {[...entry.features]
        .sort((a, b) => a.level - b.level)
        .map((feature) => (
          <Line
            key={`${feature.level}-${feature.name}`}
            label={tr("packs:contents.featureLevel", { level: feature.level, name: feature.name })}
          >
            {feature.summary}
          </Line>
        ))}
      {(entry.spells?.length ?? 0) > 0 && (
        <Facts items={[tr("packs:contents.alwaysPrepared", { count: entry.spells!.length })]} />
      )}
      {entry.spellVariants && (
        <Facts
          items={[
            tr("packs:contents.variants", {
              label: entry.spellVariants.label,
              list: entry.spellVariants.options.map((option) => option.name).join(", "),
            }),
          ]}
        />
      )}
    </EntryCard>
  );
}

function FeatCard({ entry }: { entry: Entry<"feats"> }) {
  const increase = entry.abilityIncrease;
  return (
    <EntryCard name={entry.name} kicker={FEAT_CATEGORY_LABELS[entry.category]}>
      <Facts
        items={[
          entry.minLevel && tr("packs:contents.minLevel", { level: entry.minLevel }),
          entry.prerequisite && tr("packs:contents.prerequisite", { text: entry.prerequisite }),
          increase &&
            tr("packs:contents.increase", {
              abilities:
                increase.options === "any"
                  ? tr("packs:contents.anyAbility")
                  : abilities(increase.options),
            }),
          entry.repeatable && tr("packs:contents.repeatable"),
        ]}
      />
      <p className="text-sm">{entry.summary}</p>
    </EntryCard>
  );
}

function SpellCard({ entry, classNames }: { entry: Entry<"spells">; classNames: ClassNames }) {
  const components = [
    entry.components.v && "V",
    entry.components.s && "S",
    entry.components.m && "M",
  ]
    .filter(Boolean)
    .join(", ");
  return (
    <EntryCard
      name={entry.name}
      kicker={`${entry.level === 0 ? tr("packs:contents.cantrip") : tr("packs:contents.level", { level: entry.level })} · ${SPELL_SCHOOL_LABELS[entry.school]}`}
    >
      <Facts
        items={[
          entry.castingTime,
          tr("packs:contents.range", { range: entry.range }),
          components,
          entry.duration,
          entry.concentration && tr("packs:contents.concentration"),
          entry.ritual && tr("packs:contents.ritual"),
          entry.classes.length > 0 &&
            entry.classes.map((id) => classNameOf(id, classNames)).join(", "),
        ]}
      />
      {entry.summary && <p className="text-sm">{entry.summary}</p>}
    </EntryCard>
  );
}

function MonsterCard({ entry }: { entry: Entry<"monsters"> }) {
  return (
    <EntryCard
      name={entry.name}
      kicker={`${MONSTER_TYPE_LABELS[entry.type]} · ${CREATURE_SIZE_LABELS[entry.size]}`}
    >
      <Facts
        items={[
          tr("packs:contents.cr", { cr: entry.cr }),
          tr("packs:contents.ac", { ac: entry.armorClass }),
          tr("packs:contents.hp", { hp: entry.hitPoints }),
          tr("packs:contents.speed", { speed: formatDistance(entry.speed) }),
        ]}
      />
      {(entry.attacks ?? []).map((attack) => (
        <Line key={attack.name} label={attack.name}>
          {tr("packs:contents.toHit", { bonus: signed(attack.toHit) })}
          {attack.reach ? `, ${attack.reach}` : ""} · {attack.damage.count}
          {attack.damage.die}
          {attack.damageBonus ? ` ${signed(attack.damageBonus)}` : ""}{" "}
          {DAMAGE_KIND_LABELS[attack.damageKind].toLowerCase()}
          {attack.note ? ` — ${attack.note}` : ""}
        </Line>
      ))}
    </EntryCard>
  );
}

function ToolCard({ entry }: { entry: Entry<"tools"> }) {
  return (
    <EntryCard name={entry.name} kicker={TOOL_CATEGORY_LABELS[entry.category]}>
      <Facts
        items={[
          ABILITY_ABBR[entry.ability],
          formatCoinPrice(entry.priceCp),
          formatWeight(entry.weightKg),
        ]}
      />
      {entry.description && <p className="text-sm">{entry.description}</p>}
    </EntryCard>
  );
}

function InvocationCard({ entry }: { entry: Entry<"invocations"> }) {
  return (
    <EntryCard name={entry.name}>
      <Facts
        items={[
          entry.minLevel > 0 && tr("packs:contents.minLevel", { level: entry.minLevel }),
          entry.condition && tr("packs:contents.prerequisite", { text: entry.condition }),
          entry.repeatable && tr("packs:contents.repeatable"),
        ]}
      />
      <p className="text-sm">{entry.summary}</p>
    </EntryCard>
  );
}

function WeaponCard({ entry }: { entry: Entry<"weapons"> }) {
  return (
    <EntryCard name={entry.name} kicker={WEAPON_CATEGORY_LABELS[entry.category]}>
      <Facts
        items={[
          entry.damageDice &&
            `${entry.damageDice.count}${entry.damageDice.die}${
              entry.damageType ? ` ${DAMAGE_TYPE_LABELS[entry.damageType]}` : ""
            }`,
          entry.mastery && WEAPON_MASTERY_LABELS[entry.mastery],
          formatCoinPrice(entry.priceCp),
          entry.weightKg !== undefined && formatWeight(entry.weightKg),
        ]}
      />
    </EntryCard>
  );
}

function ArmorCard({ entry }: { entry: Entry<"armors"> }) {
  return (
    <EntryCard name={entry.name} kicker={ARMOR_CATEGORY_LABELS[entry.category]}>
      <Facts
        items={[
          entry.baseAc !== undefined && tr("packs:contents.ac", { ac: entry.baseAc }),
          entry.acBonus !== undefined && tr("packs:contents.ac", { ac: `+${entry.acBonus}` }),
          formatCoinPrice(entry.priceCp),
          formatWeight(entry.weightKg),
        ]}
      />
      {entry.description && <p className="text-sm">{entry.description}</p>}
    </EntryCard>
  );
}

function GearCard({ entry }: { entry: Entry<"gear"> }) {
  return (
    <EntryCard name={entry.name}>
      <Facts
        items={[
          formatCoinPrice(entry.priceCp),
          entry.weightKg !== undefined && formatWeight(entry.weightKg),
        ]}
      />
      {entry.description && <p className="text-sm">{entry.description}</p>}
    </EntryCard>
  );
}

function EquipmentPackCard({ entry }: { entry: Entry<"equipmentPacks"> }) {
  return (
    <EntryCard name={entry.name}>
      <Facts items={[formatCoinPrice(entry.priceCp)]} />
      <p className="text-muted-foreground text-sm">
        {entry.contents.map((line) => `${line.qty} × ${line.gearId}`).join(", ")}
      </p>
    </EntryCard>
  );
}

function LanguageCard({ entry }: { entry: Entry<"languages"> }) {
  return (
    <EntryCard name={entry.name} kicker={LANGUAGE_KIND_LABELS[entry.kind]}>
      <p className="text-sm">{entry.summary}</p>
    </EntryCard>
  );
}

function renderEntry(kind: PackContentKind, entry: Entry<PackContentKind>, classNames: ClassNames) {
  switch (kind) {
    case "classes":
      return <ClassCard key={entry.id} entry={entry as Entry<"classes">} />;
    case "species":
      return <SpeciesCard key={entry.id} entry={entry as Entry<"species">} />;
    case "backgrounds":
      return <BackgroundCard key={entry.id} entry={entry as Entry<"backgrounds">} />;
    case "subclasses":
      return (
        <SubclassCard key={entry.id} entry={entry as Entry<"subclasses">} classNames={classNames} />
      );
    case "feats":
      return <FeatCard key={entry.id} entry={entry as Entry<"feats">} />;
    case "spells":
      return <SpellCard key={entry.id} entry={entry as Entry<"spells">} classNames={classNames} />;
    case "monsters":
      return <MonsterCard key={entry.id} entry={entry as Entry<"monsters">} />;
    case "invocations":
      return <InvocationCard key={entry.id} entry={entry as Entry<"invocations">} />;
    case "weapons":
      return <WeaponCard key={entry.id} entry={entry as Entry<"weapons">} />;
    case "armors":
      return <ArmorCard key={entry.id} entry={entry as Entry<"armors">} />;
    case "gear":
      return <GearCard key={entry.id} entry={entry as Entry<"gear">} />;
    case "equipmentPacks":
      return <EquipmentPackCard key={entry.id} entry={entry as Entry<"equipmentPacks">} />;
    case "languages":
      return <LanguageCard key={entry.id} entry={entry as Entry<"languages">} />;
    case "tools":
      return <ToolCard key={entry.id} entry={entry as Entry<"tools">} />;
  }
}

/** Accent- and case-blind, so « elfe » finds « Elfe » and « epee » « Épée ». */
const fold = (text: string) => text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/**
 * Everything a pack holds, one card per entry with what a player or a GM
 * needs to judge it, grouped by kind. A jump bar and a search field keep a
 * pack of sixty feats readable.
 */
export function PackContents({ pack }: { pack: ContentPack }) {
  const { t } = useTranslation("packs", { keyPrefix: "contents" });
  const [search, setSearch] = useState("");
  const query = fold(search.trim());

  const { i18n } = useTranslation();
  // The pack's texts in the reader's language, when it has them.
  const content = useMemo(
    () => translatedPackContent(pack),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the locale follows the interface
    [pack, i18n.language],
  );
  const classNames: ClassNames = useMemo(
    () => new Map(content.classes.map((klass) => [klass.id, klass.name])),
    [content],
  );
  const sections = useMemo(
    () =>
      PACK_CONTENT_KINDS.map((kind) => {
        const entries = [...(content[kind] as Entry<PackContentKind>[])].sort((a, b) =>
          compareText(a.name, b.name),
        );
        return {
          kind,
          total: entries.length,
          entries: query ? entries.filter((entry) => fold(entry.name).includes(query)) : entries,
        };
      }).filter((section) => section.total > 0),
    [content, query],
  );

  if (sections.length === 0) {
    return <p className="text-muted-foreground text-sm">{t("empty")}</p>;
  }
  const shown = sections.filter((section) => section.entries.length > 0);

  return (
    <div className="flex flex-col gap-6">
      {/* Just under the site's navbar (h-14), which stays on top while scrolling. */}
      <div className="bg-background/95 sticky top-14 z-10 flex flex-col gap-3 py-2 backdrop-blur">
        <nav aria-label={t("nav")} className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
          {sections.map((section) => (
            <a
              key={section.kind}
              href={`#pack-${section.kind}`}
              className="hover:bg-accent shrink-0 rounded-full border px-3 py-1 text-sm whitespace-nowrap"
            >
              {PACK_KIND_PLURALS[section.kind]}{" "}
              <span className="text-muted-foreground tabular-nums">{section.total}</span>
            </a>
          ))}
        </nav>
        <div className="relative">
          <SearchIcon className="text-muted-foreground absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
          <Input
            type="search"
            placeholder={t("search")}
            aria-label={t("searchAria")}
            className="pl-8"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
      </div>

      {shown.length === 0 && (
        <p className="text-muted-foreground text-sm">{t("noMatch", { query: search.trim() })}</p>
      )}
      {shown.map((section) => (
        <section
          key={section.kind}
          id={`pack-${section.kind}`}
          className="flex scroll-mt-44 flex-col gap-3"
        >
          <h2 className="text-lg font-semibold">
            {PACK_KIND_PLURALS[section.kind]}{" "}
            <span className="text-muted-foreground text-sm font-normal tabular-nums">
              {query ? `${section.entries.length} / ${section.total}` : section.total}
            </span>
          </h2>
          <div className="grid gap-3 md:grid-cols-2">
            {section.entries.map((entry) => renderEntry(section.kind, entry, classNames))}
          </div>
        </section>
      ))}
    </div>
  );
}
