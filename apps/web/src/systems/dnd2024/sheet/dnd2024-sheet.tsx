import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import {
  BackpackIcon,
  BookOpenIcon,
  CoinsIcon,
  HammerIcon,
  LockIcon,
  ShieldIcon,
  SparklesIcon,
  SwordsIcon,
  type LucideIcon,
} from "lucide-react";
import type { Dnd2024Character, Item } from "@adventure-keeper/schemas";
import {
  ABILITIES,
  ABILITY_ABBR,
  ABILITY_LABELS,
  ALIGNMENT_LABELS,
  CREATURE_SIZE_LABELS,
  DAMAGE_KIND_LABELS,
  DAMAGE_TYPE_LABELS,
  SKILLS_BY_LABEL,
  SKILL_ABILITY,
  SKILL_LABELS,
  SKILL_SUMMARY,
  SPELL_SCHOOL_LABELS,
  WEAPON_MASTERY_LABELS,
  castingTimeLabel,
  getBackground,
  getClass,
  hasWildShape,
  knownWildShapeForms,
  wildShapeRules,
  speciesOptionLabel,
  getSpecies,
  isSpellcaster,
  type Skill,
  type SpellDef,
  formatDistance,
  spellcastingWith,
} from "@adventure-keeper/system-dnd2024";
import { useTranslation } from "react-i18next";

import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Markdown } from "@/components/ui/markdown";
import { CropIcon } from "@/components/character/crop-icon";
import { OriginFeatures } from "@/systems/dnd2024/components/feature-list";
import { beastMovement } from "@/systems/dnd2024/lib/companions";
import { SpellCard } from "@/systems/dnd2024/components/spell-card";
import { StoryTabs } from "@/components/character/story/story-tabs";
import {
  EditPen,
  NarrowSheet,
  WideSheet,
  type SheetModel,
  type SheetSection,
} from "@/systems/dnd2024/sheet/sheet-layouts";
import {
  AttackList,
  IncludedLine,
  ItemTagBadge,
  Progression,
  SheetCard,
  SlotPips,
  VitalTile,
  sheetRow,
  type SheetAbility,
  type SheetAttack,
  type SheetVariant,
  type SheetVital,
} from "@/systems/dnd2024/sheet/sheet-parts";
import {
  isTodo,
  type CharacterSheetProps,
  type EditBlock,
  type SheetEditing,
} from "@/components/character/character-sheet/types";
import { useCharacterDerived } from "@/systems/dnd2024/hooks/use-character-derived";
import {
  armorItemBadges,
  armorTags,
  signedModifier,
  toolUsage,
  weaponDamage,
  weaponTags,
  type ItemTag,
} from "@/systems/dnd2024/lib/equipment-format";
import { initials, signed } from "@/lib/format";
import { invocationEntries } from "@/systems/dnd2024/lib/invocations";
import { COINS, normalizeMoney } from "@/systems/dnd2024/lib/money";
import { cn } from "@/lib/utils";
import type { WithId } from "@/lib/collections";
import { useToolCatalog } from "@/systems/dnd2024/lib/equipment";
import { compareText, sortedByLabel } from "@/lib/sort";
import { findSpell, useSpells } from "@/systems/dnd2024/lib/spells";
import { useContentPacks, useRegisterPacks } from "@/systems/dnd2024/hooks/use-content-packs";

/** Below this width (px) the sheet switches to the phone layout. */
const WIDE_MIN_WIDTH = 896;

/** Picks the layout from the width the sheet actually gets (page or dialog). */
function useSheetVariant() {
  const ref = useRef<HTMLDivElement>(null);
  const [variant, setVariant] = useState<SheetVariant>("wide");
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const update = (width: number) => setVariant(width >= WIDE_MIN_WIDTH ? "wide" : "narrow");
    update(element.getBoundingClientRect().width);
    const observer = new ResizeObserver(([entry]) => update(entry.contentRect.width));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return [ref, variant] as const;
}

/** The 5e 2024 read-only character sheet. */
export function Dnd2024CharacterSheet({
  character,
  showEditLink = false,
  onSetExperience,
  onApplyLevel,
  editing,
  story,
  audience = "owner",
}: Omit<CharacterSheetProps, "character"> & {
  character: WithId<Dnd2024Character>;
  /** Owner-only pencils (the detail page's editor). */
  editing?: SheetEditing;
}) {
  const { t } = useTranslation("sheet", { keyPrefix: "dnd" });
  const [viewedSpell, setViewedSpell] = useState<SpellDef | null>(null);
  const [viewedSkill, setViewedSkill] = useState<Skill | null>(null);
  const [containerRef, variant] = useSheetVariant();
  const caster = isSpellcaster(character.classId);

  const xp = character.experiencePoints ?? 0;
  const level = character.level ?? 1;

  const derived = useCharacterDerived(character);
  // A non-caster can still hold spells from its species (elven lineage, fiendish legacy).
  const showSpells = caster || derived.grantedSpells.length > 0;
  const spells = useSpells(showSpells);

  const klass = getClass(character.classId);
  // The sheet's own copy of the pack entries it uses (species, background…).
  useRegisterPacks(character.packContent);
  useContentPacks();
  const species = getSpecies(character.speciesId);
  const background = getBackground(character.backgroundId);
  const armorClass = derived.armorClass;
  const initiative = derived.initiativeBonus;
  const expertiseSet = new Set(character.skillExpertise ?? []);
  const proficientSaves = new Set(derived.proficientSaves);

  // The engine stores tool ids; the catalogue (lazy-loaded) holds their names.
  const toolCatalog = useToolCatalog(true);
  const toolName = (id: string) => toolCatalog?.find((tool) => tool.id === id)?.name ?? id;

  const grantedSpells = (derived.grantedSpells ?? [])
    .map((g) => ({ grant: g, spell: spells ? findSpell(spells, g.spellId) : undefined }))
    .filter((entry): entry is { grant: (typeof derived.grantedSpells)[number]; spell: SpellDef } =>
      Boolean(entry.spell),
    );
  const grantedIds = new Set(grantedSpells.map((entry) => entry.spell.id));

  const cantrips = (character.cantrips ?? [])
    .map((sid) => (spells ? findSpell(spells, sid) : undefined))
    .filter((s): s is SpellDef => Boolean(s))
    .filter((s) => !grantedIds.has(s.id))
    .sort((a, b) => compareText(a.name, b.name));
  const leveled = (character.spells ?? [])
    .map((sid) => (spells ? findSpell(spells, sid) : undefined))
    .filter((s): s is SpellDef => Boolean(s))
    .filter((s) => !grantedIds.has(s.id))
    .sort((a, b) => a.level - b.level || compareText(a.name, b.name));
  // A spell two sources grant (Druid and Forest Gnome) is listed once.
  const grantedList = [
    ...new Map(grantedSpells.map(({ spell }) => [spell.id, spell])).values(),
  ].sort((a, b) => a.level - b.level || compareText(a.name, b.name));

  const invocations = invocationEntries(character, spells);

  // Size, senses, movement and resistances the species, invocations and features give.
  const traits = [
    t("size", { size: CREATURE_SIZE_LABELS[derived.size] }),
    derived.darkvision > 0 ? t("darkvision", { range: formatDistance(derived.darkvision) }) : null,
    derived.truesight > 0 ? t("truesight", { range: formatDistance(derived.truesight) }) : null,
    derived.swimSpeed > 0 ? t("swim", { range: formatDistance(derived.swimSpeed) }) : null,
    derived.climbSpeed > 0 ? t("climb", { range: formatDistance(derived.climbSpeed) }) : null,
    derived.flySpeed > 0 ? t("fly", { range: formatDistance(derived.flySpeed) }) : null,
    derived.blindsight > 0 ? t("blindsight", { range: formatDistance(derived.blindsight) }) : null,
    derived.tremorsense > 0
      ? t("tremorsense", { range: formatDistance(derived.tremorsense) })
      : null,
    derived.initiativeAdvantage ? t("initAdvantage") : null,
    derived.resistances.length > 0
      ? t("resistance", {
          kinds: derived.resistances.map((kind) => DAMAGE_KIND_LABELS[kind]).join(", "),
        })
      : null,
  ].filter((trait): trait is string => trait !== null);

  // Species-granted spells are cast with the ability the player picked for them.
  const speciesGrantedIds = new Set(
    grantedSpells.filter(({ grant }) => grant.source === "species").map(({ spell }) => spell.id),
  );
  const chosenIds = new Set([...(character.cantrips ?? []), ...(character.spells ?? [])]);
  // A feat's spells (« Initié à la magie ») use the ability picked for the feat.
  const featCasting = new Map(
    grantedSpells
      .filter(({ grant }) => grant.ability && !chosenIds.has(grant.spellId))
      .map(({ grant }) => [
        grant.spellId,
        {
          label: grant.sourceLabel,
          ...spellcastingWith(grant.ability!, derived.abilityModifiers, derived.proficiencyBonus),
        },
      ]),
  );
  const spellCaster = (spell: SpellDef) => {
    const fromFeat = featCasting.get(spell.id);
    if (fromFeat) {
      return {
        saveDc: fromFeat.saveDc,
        attackBonus: fromFeat.attackBonus,
        spellcastingAbility: fromFeat.ability,
      };
    }
    const fromSpecies =
      derived.speciesSpellcasting != null &&
      speciesGrantedIds.has(spell.id) &&
      !chosenIds.has(spell.id);
    return fromSpecies
      ? {
          saveDc: derived.speciesSpellcasting!.saveDc,
          attackBonus: derived.speciesSpellcasting!.attackBonus,
          spellcastingAbility: derived.speciesSpellcasting!.ability,
        }
      : {
          saveDc: derived.spellSaveDc,
          attackBonus: derived.spellAttackBonus,
          spellcastingAbility: derived.spellcastingAbility,
        };
  };

  const spellsBySlotLevel = new Map<number, { spell: SpellDef; always: boolean }[]>();
  for (const [spell, always] of [
    ...cantrips.map((spell) => [spell, false] as const),
    ...grantedList.map((spell) => [spell, true] as const),
    ...leveled.map((spell) => [spell, false] as const),
  ]) {
    const row = spellsBySlotLevel.get(spell.level) ?? [];
    row.push({ spell, always });
    spellsBySlotLevel.set(spell.level, row);
  }
  const spellLevels = [...spellsBySlotLevel.entries()]
    .sort(([a], [b]) => a - b)
    .map(([lvl, entries]) => ({
      level: lvl,
      entries: entries.sort((a, b) => compareText(a.spell.name, b.spell.name)),
    }));
  const spellCount = cantrips.length + leveled.length + grantedList.length;

  const attacks: SheetAttack[] = [derived.unarmedStrike, ...derived.weaponAttacks].map(
    (attack) => ({
      key: attack.itemId,
      name: attack.name,
      toHit: signedModifier(attack.attackBonus),
      damage: `${attack.damageDice}${attack.damageBonus !== 0 ? signedModifier(attack.damageBonus) : ""}`,
      notes: [
        DAMAGE_TYPE_LABELS[attack.damageType],
        ABILITY_LABELS[attack.ability],
        attack.pact && t("pact"),
        attack.unarmed && t("grapple"),
        !attack.proficient && t("notProficient"),
      ]
        .filter(Boolean)
        .join(" · "),
      // The mastery the character can use: next to the weapon's name.
      mastery:
        attack.mastery && derived.masterySlots > 0 && attack.masteryActive
          ? t("masteryBadge", { name: WEAPON_MASTERY_LABELS[attack.mastery] })
          : undefined,
    }),
  );

  const abilities: SheetAbility[] = ABILITIES.map((ability) => ({
    ability,
    label: ABILITY_LABELS[ability],
    abbr: ABILITY_ABBR[ability],
    score: derived.adjustedAbilityScores[ability],
    modifier: derived.abilityModifiers[ability],
    save: derived.savingThrowModifiers[ability],
    saveProficient: proficientSaves.has(ability),
    skills: SKILLS_BY_LABEL.filter((skill) => SKILL_ABILITY[skill] === ability).map((skill) => ({
      skill,
      label: SKILL_LABELS[skill],
      abbr: ABILITY_ABBR[ability],
      modifier: derived.skillModifiers[skill],
      rank: expertiseSet.has(skill) ? 2 : derived.proficientSkills.includes(skill) ? 1 : 0,
    })),
  }));

  // What the numbers already count: a discreet trace, never a reminder.
  const included = (on: string) =>
    derived.includedEffects.filter((effect) => effect.on === on).map((effect) => effect.text);
  const vitals: SheetVital[] = [
    {
      label: t("vitals.hpTile"),
      title: t("vitals.hp"),
      value: derived.maxHitPoints,
      emphasis: true,
      included: included("hitPoints"),
    },
    {
      label: t("vitals.acTile"),
      title: t("vitals.ac"),
      value: armorClass,
      emphasis: true,
      included: included("armorClass"),
    },
    {
      label: t("vitals.init"),
      title: t("vitals.init"),
      value: signed(initiative),
      included: included("initiative"),
    },
    { label: t("vitals.speed"), value: formatDistance(derived.speed) },
    { label: t("vitals.prof"), value: signed(derived.proficiencyBonus) },
    { label: t("vitals.ppShort"), title: t("vitals.pp"), value: derived.passivePerception },
    { label: t("vitals.hd"), value: level, unit: `d${derived.hitDie}` },
  ];

  const pen = (block: EditBlock) => <EditPen editing={editing} block={block} />;
  const todo = (block: EditBlock) => isTodo(editing, block);

  /** A spell as a line: name and tags, its school; a granted one says where it comes from. */
  const spellLine = (spell: SpellDef, source?: string) => (
    <li key={spell.id} className={sheetRow}>
      <button
        type="button"
        onClick={() => setViewedSpell(spell)}
        className="hover:bg-accent -mx-1 grid w-[calc(100%+0.5rem)] gap-0.5 rounded-md px-1 text-left"
      >
        <span className="flex flex-wrap items-center gap-1.5">
          <span className="font-semibold">{spell.name}</span>
          {spell.concentration && (
            <Badge variant="outline" className="px-1.5 py-0 text-[11px] font-normal">
              {t("concentration")}
            </Badge>
          )}
          {spell.ritual && (
            <Badge variant="outline" className="px-1.5 py-0 text-[11px] font-normal">
              {t("ritual")}
            </Badge>
          )}
          {(spell.castingTime === "reaction" || spell.castingTime === "bonus") && (
            <Badge variant="outline" className="px-1.5 py-0 text-[11px] font-normal">
              {castingTimeLabel(spell.castingTime)}
            </Badge>
          )}
        </span>
        <span className="text-muted-foreground flex items-center gap-1 text-xs">
          {SPELL_SCHOOL_LABELS[spell.school]}
          {source && (
            <>
              {" · "}
              <LockIcon className="size-3" aria-hidden />
              {source}
            </>
          )}
        </span>
      </button>
    </li>
  );
  // Where a granted spell comes from (species, subclass, feat…).
  const grantSource = new Map(
    grantedSpells.map(({ grant, spell }) => [spell.id, grant.sourceLabel]),
  );

  /** Incantation: ability, DC, attack, prepared count; then the slots. */
  const casting = derived.spellcastingAbility && derived.spellSaveDc != null && (
    <SheetCard
      title={t("casting")}
      icon={SparklesIcon}
      action={pen("spells")}
      todo={todo("spells")}
    >
      <dl className="grid grid-cols-4 gap-2">
        <VitalTile
          vital={{
            label: t("vitals.abilityTile"),
            title: ABILITY_LABELS[derived.spellcastingAbility],
            value: ABILITY_ABBR[derived.spellcastingAbility],
          }}
        />
        <VitalTile
          vital={{ label: t("vitals.dcTile"), title: t("vitals.dc"), value: derived.spellSaveDc }}
        />
        <VitalTile
          vital={{ label: t("vitals.attackTile"), value: signed(derived.spellAttackBonus ?? 0) }}
        />
        <VitalTile vital={{ label: t("vitals.prepared"), value: leveled.length }} />
      </dl>
      <div className="text-muted-foreground mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs">
        {derived.pactMagic ? (
          <span className="flex items-center gap-2">
            {t("pactSlots", { level: derived.pactMagic.level })}
            <SlotPips count={derived.pactMagic.count} />
            {t("pactRest")}
          </span>
        ) : (
          Object.entries(derived.spellSlots)
            .filter(([, count]) => count > 0)
            .map(([slotLevel, count]) => (
              <span key={slotLevel} className="flex items-center gap-2">
                {t("slotLevel", { level: slotLevel })}
                <SlotPips count={count} />
              </span>
            ))
        )}
      </div>
    </SheetCard>
  );

  const spellCards = spellLevels.map(({ level: spellLevel, entries }) => {
    const slots = spellLevel > 0 && !derived.pactMagic ? derived.spellSlots[spellLevel] : undefined;
    return (
      <SheetCard
        key={spellLevel}
        title={
          <>
            {spellLevel === 0
              ? t("cantripsCount", { count: entries.length })
              : t("level", { level: spellLevel })}
            {slots ? <SlotPips count={slots} /> : null}
            {spellLevel > 0 && derived.pactMagic && (
              <span className="tracking-normal normal-case">
                {t("castAt", { level: derived.pactMagic.level })}
              </span>
            )}
          </>
        }
        action={pen("spells")}
      >
        <ul>
          {entries.map(({ spell, always }) =>
            spellLine(spell, always ? (grantSource.get(spell.id) ?? t("alwaysBadge")) : undefined),
          )}
        </ul>
      </SheetCard>
    );
  });

  const twoStacks = (cards: ReactNode[], variant: SheetVariant) =>
    variant === "wide" ? (
      <div className="grid items-start gap-3 @5xl:grid-cols-2">
        <div className="grid gap-3">{cards.filter((_, index) => index % 2 === 0)}</div>
        <div className="grid gap-3">{cards.filter((_, index) => index % 2 === 1)}</div>
      </div>
    ) : (
      <div className="grid gap-3">{cards}</div>
    );

  /** A list of items, each with its tags (a tap tells what a tag does) and its quantity. */
  const itemCard = (
    title: string,
    icon: LucideIcon,
    items: Item[],
    details: (item: Item) => { line?: string; tags?: ItemTag[] },
  ) =>
    items.length > 0 && (
      <SheetCard
        title={t("countTitle", { title, count: items.length })}
        icon={icon}
        action={pen("equipment")}
      >
        <ul>
          {sortedByLabel(items, (item) => item.name).map((item) => {
            const { line, tags = [] } = details(item);
            return (
              <li key={item.id} className={cn("flex items-baseline gap-3", sheetRow)}>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span>{item.name}</span>
                    {tags.map((tag) => (
                      <ItemTagBadge key={tag.label} tag={tag} />
                    ))}
                  </div>
                  {(line || item.lore) && (
                    <div className="text-muted-foreground text-xs">
                      {[line, item.lore].filter(Boolean).join(" · ")}
                    </div>
                  )}
                </div>
                {item.quantity > 1 && (
                  <span className="font-semibold tabular-nums">×{item.quantity}</span>
                )}
              </li>
            );
          })}
        </ul>
      </SheetCard>
    );

  const toolModifier = (item: Item) =>
    item.catalogId && item.catalogId in derived.toolCheckModifiers
      ? derived.toolCheckModifiers[item.catalogId]
      : undefined;

  /** Weapons, armour and tools: what is used. */
  const gear = (
    <>
      {itemCard(t("weapons"), SwordsIcon, character.weapons ?? [], (item) => ({
        line: weaponDamage(item),
        tags: weaponTags(item, derived.masterySlots > 0),
      }))}
      {itemCard(t("armor"), ShieldIcon, character.armors ?? [], (item) => ({
        line: [
          armorItemBadges({
            armor: item.armor ? { ...item.armor, equipped: false } : undefined,
          })[0],
          item.armor?.equipped && t("worn"),
        ]
          .filter(Boolean)
          .join(" · "),
        tags: armorTags(item),
      }))}
      {!derived.armorProficient && (
        <p className="text-destructive text-xs">{t("armorNotProficient")}</p>
      )}
      {itemCard(t("toolsLabel"), HammerIcon, character.tools ?? [], (item) => {
        const modifier = toolModifier(item);
        return {
          line: [
            toolUsage(item),
            modifier !== undefined && t("toolBonus", { value: signedModifier(modifier) }),
          ]
            .filter(Boolean)
            .join(" · "),
        };
      })}
    </>
  );

  /** The bag and the purse — not shown to a companion. */
  const money = normalizeMoney(character.money);
  const bag = audience !== "companion" && (
    <>
      {itemCard(t("bag"), BackpackIcon, character.inventory ?? [], () => ({}))}
      <SheetCard title={t("purse")} icon={CoinsIcon} action={pen("equipment")}>
        <ul className="flex flex-wrap gap-2">
          {COINS.filter(({ key }) => money[key] > 0 || key === "gold").map(({ key, short }) => (
            <li key={key}>
              <Badge variant="outline" className="px-2.5 py-0.5 text-sm font-normal tabular-nums">
                <span className="font-semibold">{money[key]}</span> {short}
              </Badge>
            </li>
          ))}
        </ul>
      </SheetCard>
    </>
  );

  const sections: SheetSection[] = [
    {
      id: "combat",
      label: t("combat"),
      render: (variant) => (
        <div className="grid gap-3">
          <SheetCard
            title={derived.masterySlots > 0 ? t("attacksAndMasteries") : t("attacks")}
            icon={SwordsIcon}
          >
            <AttackList attacks={attacks} />
            <IncludedLine items={included("attacks")} />
          </SheetCard>
          {derived.speciesAttack && (
            <SheetCard title={t("breath")}>
              <p>
                <span className="font-semibold">{derived.speciesAttack.name}</span>{" "}
                <span className="tabular-nums">
                  {derived.speciesAttack.damageDice}{" "}
                  {DAMAGE_KIND_LABELS[derived.speciesAttack.damageKind]}
                </span>
                <span className="text-muted-foreground">
                  {t("breathLine", {
                    dc: derived.speciesAttack.saveDc,
                    shapes: derived.speciesAttack.shapes,
                    uses: derived.speciesAttack.usesPerLongRest,
                  })}
                </span>
              </p>
            </SheetCard>
          )}
          {(derived.bonusActions.length > 0 || derived.combatNotes.length > 0) && (
            <div className={cn("grid items-start gap-3", variant === "wide" && "@5xl:grid-cols-2")}>
              {derived.bonusActions.length > 0 && (
                <SheetCard title={t("bonusAction")}>
                  <ul>
                    {derived.bonusActions.map((option) => (
                      <li key={option} className={sheetRow}>
                        {option}
                      </li>
                    ))}
                  </ul>
                </SheetCard>
              )}
              {derived.combatNotes.length > 0 && (
                <SheetCard title={t("reminders")}>
                  <ul>
                    {derived.combatNotes.map((note) => (
                      <li key={note} className={cn("text-muted-foreground text-xs", sheetRow)}>
                        {note}
                      </li>
                    ))}
                  </ul>
                </SheetCard>
              )}
            </div>
          )}
        </div>
      ),
    },
    ...(showSpells || invocations.length > 0
      ? [
          {
            id: "spells",
            label: t("spells"),
            count: spellCount > 0 ? spellCount : undefined,
            render: (variant: SheetVariant) => (
              <div className="grid gap-3">
                {casting}
                {invocations.length > 0 && (
                  <SheetCard
                    title={t("invocationsCount", { count: invocations.length })}
                    icon={SparklesIcon}
                    action={pen("options")}
                  >
                    <ul>
                      {invocations.map(({ invocation, cantripName }, index) => (
                        <li key={`${invocation.id}:${cantripName ?? index}`} className={sheetRow}>
                          <span className="font-semibold">{invocation.name}</span>
                          {cantripName && (
                            <span className="text-muted-foreground"> · {cantripName}</span>
                          )}
                          <div className="text-muted-foreground text-xs">{invocation.summary}</div>
                        </li>
                      ))}
                    </ul>
                  </SheetCard>
                )}
                {showSpells && !spells && (
                  <p className="text-muted-foreground text-sm">{t("loadingSpells")}</p>
                )}
                {caster && spells && spellCount === 0 && (
                  <p className="text-muted-foreground text-sm">{t("noSpell")}</p>
                )}
                {twoStacks(spellCards, variant)}
                {(derived.speciesSpellcasting || featCasting.size > 0) && (
                  <p className="text-muted-foreground text-xs">
                    {derived.speciesSpellcasting &&
                      t("speciesCasting", {
                        ability: ABILITY_LABELS[derived.speciesSpellcasting.ability],
                        dc: derived.speciesSpellcasting.saveDc,
                        attack: signed(derived.speciesSpellcasting.attackBonus),
                      })}
                    {[...new Map([...featCasting.values()].map((c) => [c.label, c])).values()].map(
                      (c) =>
                        t("featCasting", {
                          label: c.label,
                          ability: ABILITY_LABELS[c.ability],
                          dc: c.saveDc,
                          attack: signed(c.attackBonus),
                        }),
                    )}
                  </p>
                )}
              </div>
            ),
          },
        ]
      : []),
    {
      id: "features",
      label: t("features"),
      render: () => (
        <OriginFeatures
          character={character}
          derived={derived}
          toolName={toolName}
          editing={editing}
        />
      ),
    },
    // Druid: the beasts known, picked here (or at a level-up), used in play.
    ...(hasWildShape(character.classId, level)
      ? [
          {
            id: "wildShape",
            label: t("wildShape"),
            count: knownWildShapeForms(character.wildShapeForms ?? [], level).length,
            render: () => (
              <SheetCard title={t("wildShape")} action={pen("wildShape")} todo={todo("wildShape")}>
                <WildShapeForms character={character} level={level} />
              </SheetCard>
            ),
          },
        ]
      : []),
    {
      id: "equipment",
      label: t("equipment"),
      render: (variant) =>
        variant === "wide" ? (
          <div className="grid items-start gap-3 @5xl:grid-cols-2">
            <div className="grid gap-3">{gear}</div>
            <div className="grid gap-3">{bag}</div>
          </div>
        ) : (
          <div className="grid gap-3">{gear}</div>
        ),
    },
    // Phone: the bag and the purse in a tab of their own.
    ...(audience !== "companion"
      ? [
          {
            id: "bag",
            label: t("bag"),
            only: "narrow" as const,
            render: () => <div className="grid gap-3">{bag}</div>,
          },
        ]
      : []),
  ];

  const backstory = (
    <SheetCard title={t("backstory")} icon={BookOpenIcon} action={pen("lore")} todo={todo("lore")}>
      {character.lore?.trim() ? (
        <Markdown>{character.lore}</Markdown>
      ) : (
        <p className="text-muted-foreground">{t("noLore")}</p>
      )}
    </SheetCard>
  );

  const speciesName = `${species?.name ?? character.speciesId}${
    character.speciesChoice
      ? ` (${speciesOptionLabel(character.speciesId, character.speciesChoice)})`
      : ""
  }`;
  const className = klass?.name ?? character.classId;
  const backgroundName = background?.name ?? character.backgroundId;

  const model: SheetModel = {
    name: character.name,
    icon: (size) => (
      <CropIcon
        imageUrl={character.imageUrl}
        crop={character.imageCrop}
        color={character.color}
        fallback={initials(character.name)}
        size={size}
      />
    ),
    subtitle: [
      speciesName,
      className,
      t("lvl", { level }),
      backgroundName,
      ALIGNMENT_LABELS[character.alignment] ?? character.alignment,
    ].join(" · "),
    traits,
    editHref: showEditLink ? `/characters/${character.id}/edit` : undefined,
    progression: (
      <Progression
        level={level}
        xp={xp}
        onSetExperience={showEditLink ? onSetExperience : undefined}
        onApplyLevel={showEditLink ? onApplyLevel : undefined}
        hideXp={audience === "companion" || editing?.review}
      />
    ),
    vitals,
    abilities,
    sections,
    // Historique (with the personality), chapters and journal; the backstory alone without them.
    story: story ? <StoryTabs backstory={backstory} story={story} /> : backstory,
    onViewSkill: setViewedSkill,
    editing,
  };

  return (
    <div
      ref={containerRef}
      className="@container"
      style={{ "--char": character.color ?? "var(--primary)" } as CSSProperties}
    >
      {variant === "wide" ? <WideSheet model={model} /> : <NarrowSheet model={model} />}

      <Dialog open={viewedSkill !== null} onOpenChange={(open) => !open && setViewedSkill(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {viewedSkill ? SKILL_LABELS[viewedSkill] : t("skill")}
              {viewedSkill && (
                <span className="text-muted-foreground ml-2 text-sm font-normal">
                  {ABILITY_LABELS[SKILL_ABILITY[viewedSkill]]} ·{" "}
                  {signed(derived.skillModifiers[viewedSkill])}
                </span>
              )}
            </DialogTitle>
          </DialogHeader>
          {viewedSkill && (
            <div className="grid gap-2 text-sm">
              <p>{SKILL_SUMMARY[viewedSkill]}</p>
              <p className="text-muted-foreground text-xs">
                {expertiseSet.has(viewedSkill)
                  ? t("expertiseHint")
                  : derived.proficientSkills.includes(viewedSkill)
                    ? t("proficientHint")
                    : t("notProficientHint")}
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={viewedSpell !== null} onOpenChange={(open) => !open && setViewedSpell(null)}>
        <DialogContent>
          <DialogHeader className="sr-only">
            <DialogTitle>{viewedSpell?.name ?? t("spell")}</DialogTitle>
          </DialogHeader>
          {viewedSpell && (
            <SpellCard
              spell={viewedSpell}
              caster={{
                ...spellCaster(viewedSpell),
                level: character.level ?? 1,
                proficiencyBonus: derived.proficiencyBonus,
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** The Wild Shape forms known, as the sheet lists them. */
function WildShapeForms({ character, level }: { character: Dnd2024Character; level: number }) {
  const { t } = useTranslation("sheet", { keyPrefix: "dnd" });
  const { t: ts } = useTranslation("session");
  const rules = wildShapeRules(level);
  const known = knownWildShapeForms(character.wildShapeForms ?? [], level);
  return (
    <div className="grid gap-3 text-sm">
      <p className="text-muted-foreground">
        {ts("wildShape.chooseIntro", { count: rules.formsKnown, cr: rules.maxChallengeLabel })}
        {!rules.canFly && ` ${ts("wildShape.noFly")}`}
      </p>
      {known.length === 0 ? (
        <p className="text-muted-foreground">{t("noWildShape")}</p>
      ) : (
        <ul className="grid gap-2">
          {known.map((monster) => (
            <li key={monster.id}>
              <span className="font-medium">{monster.name}</span>
              <span className="text-muted-foreground">
                {" "}
                · {ts("wildShape.cr", { cr: monster.cr })} ·{" "}
                {ts("familiar.ac", { ac: monster.armorClass })} ·{" "}
                {ts("familiar.hp", { hp: monster.hitPoints })} · {beastMovement(monster)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
