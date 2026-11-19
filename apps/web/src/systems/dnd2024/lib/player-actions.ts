import type { Dnd2024Character } from "@adventure-keeper/schemas";
import {
  ABILITIES,
  ABILITY_ABBR,
  DAMAGE_TYPE_LABELS,
  SKILLS,
  SKILL_ABILITY,
  SKILL_LABELS,
  WEAPON_MASTERY_LABELS,
  classFeatures,
  featureRollDice,
  getClass,
  limitedUsesMax,
  parseDicePool,
  speciesFeatures,
  subclassFeatures,
  spellDamageAt,
  spellcastingWith,
  type Ability,
  type DicePool,
  type FeatureRoll,
  type Skill,
  type SpellDef,
} from "@adventure-keeper/system-dnd2024";

import { tr } from "@/i18n";
import type { RollContext, RollKind } from "@/systems/dnd2024/lib/roll-sources";

/**
 * A roll the sheet hands over, filled in: what is rolled, the known bonus,
 * and — after an attack — the damage that follows a hit.
 */
export interface RollSpec {
  label: string;
  kind: RollKind;
  /** Flat bonus the sheet knows (attack bonus, damage bonus, skill modifier). */
  bonus: number;
  /** The damage dice, for a damage roll. */
  pool?: DicePool;
  /** What `autoRollSources` needs to add the situational modifiers. */
  ctx?: RollContext;
  /** After an attack: the damage roll a hit opens. */
  next?: RollSpec;
  /** A healing roll (hit die, Second Wind): its total is given back as HP. */
  heal?: boolean;
  /** Temporary HP (Défense patiente): the total replaces a smaller pool. */
  tempHp?: boolean;
  /** A DC to meet: the result says whether the roll succeeded (a concentration save). */
  dc?: number;
  /** A concentration save: failing it ends the concentration. */
  concentration?: boolean;
}

export interface WeaponAction {
  id: string;
  name: string;
  /** « Tranchant · Renversement ». */
  info: string;
  attackBonus: number;
  /** « 1d8+3 », or « 4 » for a fixed damage. */
  damageLabel: string;
  /** Used as a Bonus Action (the Monk's Martial Arts strike). */
  bonusAction?: boolean;
  roll: RollSpec;
}

const signed = (n: number) => (n >= 0 ? `+${n}` : `−${-n}`);

/**
 * The character's weapon attacks, then the unarmed strike, ready to roll —
 * and, while Martial Arts applies, the same strike as a Bonus Action.
 */
export function weaponActions(character: Dnd2024Character): WeaponAction[] {
  // Like the sheet: the weapons, and the unarmed strike every character has.
  const attacks = [
    ...(character.weaponAttacks ?? []),
    ...(character.unarmedStrike ? [character.unarmedStrike] : []),
  ];
  const lines = attacks.map((attack) => ({ attack, id: attack.itemId, bonusAction: false }));
  if (character.martialArts && character.unarmedStrike)
    lines.push({
      attack: { ...character.unarmedStrike, name: tr("session:player.bonusStrike") },
      id: "unarmed-strike-bonus",
      bonusAction: true,
    });
  return lines.map(({ attack, id, bonusAction }) => {
    const pool = parseDicePool(attack.damageDice) ?? { count: 1, die: "d1" as const };
    const fixed = pool.die === "d1";
    const damageLabel = fixed
      ? String(pool.count + attack.damageBonus)
      : `${pool.count}${pool.die}${attack.damageBonus ? signed(attack.damageBonus) : ""}`;
    const info = [
      DAMAGE_TYPE_LABELS[attack.damageType] ?? attack.damageType,
      attack.mastery && attack.masteryActive ? WEAPON_MASTERY_LABELS[attack.mastery] : null,
    ]
      .filter(Boolean)
      .join(" · ");
    const ctx: RollContext = { character, weaponId: attack.itemId };
    return {
      id,
      name: attack.name,
      info,
      attackBonus: attack.attackBonus,
      damageLabel,
      ...(bonusAction ? { bonusAction } : {}),
      roll: {
        label: attack.name,
        kind: "attaque",
        bonus: attack.attackBonus,
        ctx,
        next: {
          label: attack.name,
          kind: "degats",
          bonus: attack.damageBonus,
          pool,
          ctx,
        },
      },
    };
  });
}

export interface SpellAction {
  id: string;
  name: string;
  /** 0 for a cantrip. */
  level: number;
  concentration: boolean;
  /** « Attaque · 36 m », « JS Dextérité DD 13 »… */
  info: string;
  /** « +5 · 1d10 », « 3d4+3 », « DD 13 »… */
  summary: string;
  /** What a tap rolls; `null` for a spell with nothing to roll. */
  roll: RollSpec | null;
}

/** How a spell is cast: the class's ability, or the one picked for a species / feat spell. */
function castingFor(character: Dnd2024Character, spellId: string) {
  const chosen = new Set([...(character.cantrips ?? []), ...(character.spells ?? [])]);
  const granted = (character.grantedSpells ?? []).find((g) => g.spellId === spellId);
  if (granted && !chosen.has(spellId)) {
    const ability: Ability | undefined =
      granted.ability ??
      (granted.source === "species" ? character.speciesSpellcasting?.ability : undefined);
    if (ability)
      return spellcastingWith(ability, character.abilityModifiers, character.proficiencyBonus);
  }
  return {
    attackBonus: character.spellAttackBonus ?? 0,
    saveDc: character.spellSaveDc ?? 0,
  };
}

/**
 * What casting a spell rolls, at a slot level (its own by default): the spell
 * attack (its damage after a hit), else the damage; `null` when nothing is rolled.
 */
export function spellRoll(
  character: Dnd2024Character,
  spell: SpellDef,
  slotLevel?: number,
): RollSpec | null {
  if (!(spell.attackRoll || spell.damage)) return null;
  const casting = castingFor(character, spell.id);
  const damage = spellDamageAt(spell, { characterLevel: character.level ?? 1, slotLevel });
  const ctx: RollContext = { character, spellId: spell.id, spellDiceCount: damage?.pool.count };
  const upcast = slotLevel !== undefined && slotLevel > spell.level;
  const label = upcast
    ? `${spell.name} · ${tr("session:player.cast.atLevel", { level: slotLevel })}`
    : spell.name;
  const damageRoll: RollSpec | undefined = damage
    ? { label, kind: "degats", bonus: 0, pool: damage.pool, ctx }
    : undefined;
  return spell.attackRoll
    ? { label, kind: "attaque", bonus: casting.attackBonus, ctx, next: damageRoll }
    : (damageRoll ?? null);
}

/**
 * The spells a fight calls for — an attack, damage or a saving throw — with
 * what a tap rolls: the spell attack (its damage after a hit), or the damage.
 */
export function combatSpells(character: Dnd2024Character, catalogue: SpellDef[]): SpellAction[] {
  const ids = [
    ...(character.cantrips ?? []),
    ...(character.spells ?? []),
    ...(character.grantedSpells ?? []).map((g) => g.spellId),
  ];
  const seen = new Set<string>();
  const level = character.level ?? 1;
  const actions: SpellAction[] = [];
  for (const id of ids) {
    if (seen.has(id)) continue;
    seen.add(id);
    const spell = catalogue.find((s) => s.id === id);
    if (!spell || !(spell.attackRoll || spell.damage || spell.save)) continue;
    const casting = castingFor(character, id);
    const damage = spellDamageAt(spell, { characterLevel: level });
    const dice = damage
      ? `${damage.pool.count}${damage.pool.die === "d1" ? "" : damage.pool.die}`
      : "";
    const saveLabel = spell.save ? `${ABILITY_ABBR[spell.save.ability]} DD ${casting.saveDc}` : "";
    actions.push({
      id: spell.id,
      name: spell.name,
      level: spell.level,
      concentration: spell.concentration,
      info: [
        spell.attackRoll
          ? tr("session:player.spellAttack")
          : saveLabel
            ? tr("session:player.saveVs", { save: saveLabel })
            : null,
        spell.range,
      ]
        .filter(Boolean)
        .join(" · "),
      summary: spell.attackRoll
        ? `${signed(casting.attackBonus)}${dice ? ` · ${dice}` : ""}`
        : dice || saveLabel,
      roll: spellRoll(character, spell),
    });
  }
  return actions.sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));
}

/** A slot a spell can be cast with: a level of spell slots, or the warlock's pact. */
export interface SlotOption {
  /** Key in `spellSlotsUsed`: `"1"`–`"9"`, or `"pact"`. */
  key: string;
  /** The level the spell is cast at. */
  level: number;
  pact: boolean;
  max: number;
  left: number;
}

/**
 * The slots a spell of `spellLevel` can be cast with — every level at or above
 * its own, then the pact's — with what is left of each. Empty for a cantrip.
 */
export function slotOptions(
  character: Pick<Dnd2024Character, "spellSlots" | "pactMagic">,
  used: Record<string, number> | undefined,
  spellLevel: number,
): SlotOption[] {
  if (spellLevel <= 0) return [];
  const slots = (character.spellSlots ?? {}) as Record<string, number>;
  const options: SlotOption[] = Object.keys(slots)
    .map(Number)
    .filter((level) => level >= spellLevel && (slots[String(level)] ?? 0) > 0)
    .sort((a, b) => a - b)
    .map((level) => {
      const max = slots[String(level)];
      return {
        key: String(level),
        level,
        pact: false,
        max,
        left: Math.max(0, max - (used?.[String(level)] ?? 0)),
      };
    });
  const pact = character.pactMagic;
  if (pact && pact.level >= spellLevel && pact.count > 0) {
    options.push({
      key: "pact",
      level: pact.level,
      pact: true,
      max: pact.count,
      left: Math.max(0, pact.count - (used?.pact ?? 0)),
    });
  }
  return options;
}

/** The slot a cast picks by default: the lowest one with a slot left. */
export function defaultSlot(options: SlotOption[]): SlotOption | undefined {
  return options.find((option) => option.left > 0);
}

/** `spellSlotsUsed` once one slot of `key` is spent (never past its maximum). */
export function spendSlot(
  used: Record<string, number> | undefined,
  option: SlotOption,
): Record<string, number> {
  const spent = Math.min(option.max, (used?.[option.key] ?? 0) + 1);
  return { ...used, [option.key]: spent };
}

export interface LimitedFeature {
  id: string;
  name: string;
  summary: string;
  max: number;
  recharge: "short" | "long";
  /** What using it rolls — Second Wind's healing, a Martial Arts die. */
  roll?: RollSpec;
  /**
   * A roll that spends a point of another feature's pool (Défense patiente,
   * from the Credo): that feature's id, under which the uses are counted.
   */
  spends?: { id: string; name: string };
}

/**
 * The class, subclass and species features with a number of uses per rest, the
 * count read at the character's level (Rage 2 → 6, Credo = the monk's level…),
 * then the rolls that spend a point of one of them (Défense patiente).
 */
export function limitedFeatures(character: Dnd2024Character): LimitedFeature[] {
  const level = character.level ?? 1;
  const ctx = {
    classId: character.classId,
    level,
    proficiencyBonus: character.proficiencyBonus,
    abilityModifiers: character.abilityModifiers,
  };
  const rollOf = (name: string, roll: FeatureRoll | undefined): RollSpec | undefined => {
    if (!roll) return undefined;
    const { pool, bonus } = featureRollDice(roll, ctx);
    return {
      label: roll.label ?? name,
      kind: "degats",
      bonus,
      pool,
      ...(roll.gives === "tempHp" ? { tempHp: true } : { heal: true }),
    };
  };
  const all = [
    ...classFeatures(character.classId, level),
    // Keyed by position, not by name: the name follows the reader's language,
    // and the uses spent are stored under this id.
    ...(character.subclassId ? subclassFeatures(character.subclassId, level) : []).map(
      (feature, index) => ({ ...feature, id: `${character.subclassId}:${feature.level}:${index}` }),
    ),
    ...speciesFeatures(character.speciesId),
  ];
  const limited: LimitedFeature[] = all.flatMap((feature) =>
    feature.uses
      ? [
          {
            id: feature.id,
            name: feature.name,
            summary: feature.summary,
            max: limitedUsesMax(feature.uses, ctx),
            recharge:
              feature.uses.shortFrom !== undefined && level >= feature.uses.shortFrom
                ? "short"
                : feature.uses.recharge,
            roll: rollOf(feature.name, feature.roll),
          },
        ]
      : [],
  );
  // Each roll that spends a pool comes right after it, its cost as its summary.
  return limited.flatMap((pool) => [
    pool,
    ...all.flatMap((feature) =>
      feature.roll?.spends === pool.id
        ? [
            {
              ...pool,
              id: `${feature.id}:roll`,
              name: feature.roll.label ?? feature.name,
              summary: tr("session:player.capacity.costsOne", { name: pool.name }),
              roll: rollOf(feature.name, feature.roll),
              spends: { id: pool.id, name: pool.name },
            },
          ]
        : [],
    ),
  ]);
}

/**
 * The initiative modifier: Dexterity plus what the features add (Vigilant,
 * Touche-à-tout) — Dexterity alone on a sheet derived before them.
 */
export function initiativeModifier(character: Dnd2024Character): number {
  return character.initiativeBonus ?? character.abilityModifiers.dex;
}

/** The initiative roll, a d20 + the modifier: its total goes to the GM's next fight. */
export function initiativeRoll(character: Dnd2024Character): RollSpec {
  return {
    label: tr("session:player.initiative.label"),
    kind: "initiative",
    bonus: initiativeModifier(character),
    ctx: { character },
  };
}

export interface SaveRow {
  ability: Ability;
  label: string;
  modifier: number;
  proficient: boolean;
}

/**
 * The six saving throws, the proficient ones marked: the class's two, and those
 * the features add (Esprit fuyant, Survivant discipliné).
 */
export function saveRows(character: Dnd2024Character): SaveRow[] {
  const proficient = new Set<Ability>(
    character.proficientSaves ?? getClass(character.classId)?.savingThrows ?? [],
  );
  return ABILITIES.map((ability) => ({
    ability,
    label: ABILITY_ABBR[ability],
    modifier: character.savingThrowModifiers?.[ability] ?? character.abilityModifiers[ability],
    proficient: proficient.has(ability),
  }));
}

export interface SkillRow {
  skill: Skill;
  label: string;
  ability: string;
  modifier: number;
  proficient: boolean;
}

/** Every skill, alphabetically, with its modifier and whether it is trained. */
export function skillRows(character: Dnd2024Character): SkillRow[] {
  const proficient = new Set(character.proficientSkills ?? []);
  return SKILLS.map((skill) => ({
    skill,
    label: SKILL_LABELS[skill],
    ability: ABILITY_ABBR[SKILL_ABILITY[skill]],
    modifier: character.skillModifiers?.[skill] ?? 0,
    proficient: proficient.has(skill),
  })).sort((a, b) => a.label.localeCompare(b.label));
}

/** Lower-case and accent-free, so « disc » finds « Discrétion ». */
const fold = (text: string) => text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** The skills whose name (or ability) matches the search. */
export function searchSkills(rows: SkillRow[], query: string): SkillRow[] {
  const key = fold(query.trim());
  if (!key) return rows;
  return rows.filter((row) => fold(row.label).includes(key) || fold(row.ability).includes(key));
}
