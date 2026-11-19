import type { AdventureParticipant, Dnd2024Character } from "@adventure-keeper/schemas";
import {
  invocationRollSources,
  validInvocations,
  type Ability,
  type DicePool,
  type ResolvedAdvantage,
  type ResolvedDamageBonus,
  type Skill,
  type SpellDef,
  hasInvocations,
} from "@adventure-keeper/system-dnd2024";

import { tr } from "@/i18n";
import { getLoadedSpells } from "@/systems/dnd2024/lib/spells";

export type RollKind = "carac" | "attaque" | "initiative" | "sauvegarde" | "degats";

export const ROLL_KIND_LABELS: Record<RollKind, string> = Object.defineProperties(
  {} as Record<RollKind, string>,
  Object.fromEntries(
    (["carac", "attaque", "initiative", "sauvegarde", "degats"] as const).map((kind) => [
      kind,
      { enumerable: true, get: () => tr(`session:rolls.kinds.${kind}`) },
    ]),
  ),
);

/** A modifier the app can infer on its own (not typed by the player). */
export interface RollSource {
  label: string;
  /** Flat modifier (can be negative). */
  flat?: number;
  /** Dice added on the roll. */
  dice?: DicePool;
  /** A remark instead of a number (« avantage (concentration) »…). */
  hint?: string;
  /** A feature gives advantage on this roll: the sheet starts on « Avantage ». */
  advantage?: boolean;
}

/** What the calculator knows about the roll being prepared. */
export interface RollContext {
  /** The character rolling — Warlock invocations add their own bonuses. */
  character?: Pick<
    Dnd2024Character,
    "classId" | "level" | "eldritchInvocations" | "pactWeaponId" | "abilityModifiers"
  > & {
    /** From the derived block; absent on a sheet saved before feats existed. */
    featIds?: string[];
    /** From the derived block (features' mechanics); absent on an older sheet. */
    advantages?: ResolvedAdvantage[];
    damageBonuses?: ResolvedDamageBonus[];
    critRange?: number;
  };
  /** Spell whose damage is rolled. */
  spellId?: string;
  /** Dice in that spell's pool — Décharge occulte fires one beam per die. */
  spellDiceCount?: number;
  /** Item id of the weapon whose damage is rolled. */
  weaponId?: string;
  /** Ability of the saving throw. */
  saveAbility?: Ability;
  /** Skill of an ability check. */
  skill?: Skill;
}

/** A d20 test is anything but a damage roll. */
export function isD20Kind(kind: RollKind): boolean {
  return kind !== "degats";
}

/**
 * Whether the calculator offers Advantage / Disadvantage for this roll. Not for
 * damage (no d20), and not for initiative — the app doesn't track what would
 * grant it, so the player just rolls straight.
 */
export function hasAdvantageChoice(kind: RollKind): boolean {
  return isD20Kind(kind) && kind !== "initiative";
}

interface ConcentrationBuff {
  spellId: string;
  labelRe: RegExp;
  kinds: RollKind[];
  source: RollSource;
}

/** Concentration spells the calculator recognises as a roll bonus. */
const CONCENTRATION_BUFFS: ConcentrationBuff[] = [
  {
    spellId: "bless",
    labelRe: /b[ée]n[ée]diction/i,
    kinds: ["attaque", "sauvegarde"],
    source: {
      get label() {
        return tr("session:rolls.bless");
      },
      dice: { count: 1, die: "d4" },
    },
  },
  {
    spellId: "guidance",
    labelRe: /assistance/i,
    kinds: ["carac"],
    source: {
      get label() {
        return tr("session:rolls.guidance");
      },
      dice: { count: 1, die: "d4" },
    },
  },
  {
    spellId: "hunters-mark",
    labelRe: /marque du chasseur/i,
    kinds: ["degats"],
    source: {
      get label() {
        return tr("session:rolls.huntersMark");
      },
      dice: { count: 1, die: "d6" },
    },
  },
  {
    spellId: "hex",
    labelRe: /mal[ée]fice/i,
    kinds: ["degats"],
    source: {
      get label() {
        return tr("session:rolls.hex");
      },
      dice: { count: 1, die: "d6" },
    },
  },
];

/**
 * Modifiers the calculator fills in by itself for a given roll kind, from the
 * live session state. Everything the app can't infer goes in the manual
 * "ajustement" field instead.
 */
export function autoRollSources(
  kind: RollKind,
  participant?: AdventureParticipant,
  ctx: RollContext = {},
): RollSource[] {
  const sources: RollSource[] = [];

  // Exhaustion: −2 per level to every d20 test (2024). Not damage.
  const exhaustion = participant?.exhaustion ?? 0;
  if (exhaustion > 0 && isD20Kind(kind)) {
    sources.push({
      label: tr("session:rolls.exhaustion", { level: exhaustion }),
      flat: -2 * exhaustion,
    });
  }

  // A concentration spell you're maintaining that boosts this kind of roll.
  const concentration = participant?.concentration;
  if (concentration) {
    for (const buff of CONCENTRATION_BUFFS) {
      const matches =
        concentration.spellId === buff.spellId || buff.labelRe.test(concentration.label);
      if (matches && buff.kinds.includes(kind)) sources.push(buff.source);
    }
  }

  // Eldritch invocations: Décharge déchirante, Buveuse de vie, Esprit occulte…
  const character = ctx.character;
  if (character && hasInvocations(character.classId)) {
    const roll =
      kind === "degats"
        ? ({
            kind: "damage",
            spellId: ctx.spellId,
            weaponId: ctx.weaponId,
            damageDiceCount: ctx.spellDiceCount,
          } as const)
        : kind === "sauvegarde" && ctx.saveAbility
          ? ({
              kind: "save",
              ability: ctx.saveAbility,
              concentrating: Boolean(participant?.concentration),
            } as const)
          : null;
    if (roll) {
      sources.push(
        ...invocationRollSources({
          picks: validInvocations(character.eldritchInvocations ?? [], character.level ?? 1),
          chaMod: character.abilityModifiers.cha,
          pactWeaponId: character.pactWeaponId,
          roll,
        }),
      );
    }
  }

  // Fighting styles whose effect is on the dice rather than on a flat number.
  // They are reminders, not sums: the tray rolls the dice, the player applies
  // the reroll.
  if (kind === "degats" && character) {
    const feats = character.featIds ?? [];
    if (feats.includes("great-weapon-fighting")) {
      sources.push({
        label: tr("session:rolls.greatWeapon"),
        hint: tr("session:rolls.greatWeaponHint"),
      });
    }
    if (feats.includes("two-weapon-fighting")) {
      sources.push({
        label: tr("session:rolls.twoWeapon"),
        hint: tr("session:rolls.twoWeaponHint"),
      });
    }
    if (feats.includes("savage-attacker")) {
      sources.push({
        label: tr("session:rolls.savage"),
        hint: tr("session:rolls.savageHint"),
      });
    }
  }

  // What the features grant: advantage (ticked, or a reminder when it only
  // holds against a condition) and flat damage bonuses.
  if (character) {
    sources.push(...featureAdvantages(kind, ctx));
    if (kind === "degats") sources.push(...featureDamageBonuses(ctx));
  }

  return sources;
}

/** The d20 roll a roll kind is, in the terms of the mechanics. */
const D20_ROLL: Partial<Record<RollKind, ResolvedAdvantage["on"]>> = {
  carac: "check",
  attaque: "attack",
  initiative: "initiative",
  sauvegarde: "save",
};

function featureAdvantages(kind: RollKind, ctx: RollContext): RollSource[] {
  const on = D20_ROLL[kind];
  if (!on) return [];
  return (ctx.character?.advantages ?? [])
    .filter((adv) => {
      if (adv.on !== on) return false;
      if (adv.abilities && !(ctx.saveAbility && adv.abilities.includes(ctx.saveAbility)))
        return false;
      if (adv.skills && !(ctx.skill && adv.skills.includes(ctx.skill))) return false;
      return true;
    })
    .map((adv) => ({
      label: tr("session:rolls.advantageFrom", { source: adv.source }),
      ...(adv.condition ? { hint: adv.condition } : { advantage: true }),
    }));
}

function featureDamageBonuses(ctx: RollContext): RollSource[] {
  const bonuses = ctx.character?.damageBonuses ?? [];
  if (bonuses.length === 0) return [];
  const spell: SpellDef | undefined = ctx.spellId
    ? getLoadedSpells()?.find((s) => s.id === ctx.spellId)
    : undefined;
  const unarmed = ctx.weaponId === "unarmed-strike";
  return bonuses
    .filter((bonus) => {
      switch (bonus.on) {
        case "cantrip":
          return spell?.level === 0;
        case "spell":
          return spell !== undefined && (!bonus.school || spell.school === bonus.school);
        case "weapon":
          return ctx.weaponId !== undefined && !unarmed;
        case "unarmed":
          return unarmed;
      }
    })
    .map((bonus) => ({ label: bonus.source, flat: bonus.flat }));
}
