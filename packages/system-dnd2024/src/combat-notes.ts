import type { ClassId } from "./classes";
import { pick } from "./locale";

/** d6 count of the Rogue's Sneak Attack at `level` (1d6, +1d6 per odd level). */
function sneakAttackDice(level: number): number {
  return Math.ceil(Math.max(1, level) / 2);
}

/** The Barbarian's Rage damage bonus at `level` (2024: +2 / +3 at 9 / +4 at 16). */
function rageDamage(level: number): number {
  return level >= 16 ? 4 : level >= 9 ? 3 : 2;
}

/**
 * Reminders about **automatic base-class features** that change attack or damage
 * numbers — free text shown on the sheet. Choice-driven modifiers (fighting
 * styles, feats, subclasses) carry their own notes (`combatNote`, mechanics).
 */
export function combatNotes(classId: string, level = 1): string[] {
  const lvl = Math.max(1, Math.round(level));
  const notes: string[] = [];
  switch (classId as ClassId) {
    case "barbarian":
      notes.push(
        pick({
          fr: `Rage : +${rageDamage(lvl)} aux dégâts des attaques de corps à corps de Force tant que vous êtes en rage.`,
          en: `Rage: +${rageDamage(lvl)} to the damage of Strength melee attacks while you are raging.`,
        }),
      );
      break;
    case "rogue":
      notes.push(
        pick({
          fr: `Attaque sournoise : +${sneakAttackDice(lvl)}d6 une fois par tour, avec une arme de finesse ou à distance, si vous avez l'avantage ou un allié adjacent à la cible.`,
          en: `Sneak Attack: +${sneakAttackDice(lvl)}d6 once per turn, with a finesse or ranged weapon, if you have advantage or an ally next to the target.`,
        }),
      );
      break;
    case "ranger":
      notes.push(
        pick({
          fr: "Marque du chasseur (toujours préparé) : +1d6 dégâts par coup contre la cible marquée, concentration.",
          en: "Hunter's Mark (always prepared): +1d6 damage per hit against the marked target, concentration.",
        }),
      );
      break;
    case "paladin":
      notes.push(
        pick({
          fr: "Châtiment divin (sort) : après un coup au but, dépensez un emplacement pour +2d8 radiants (+1d8 par niveau d'emplacement au-delà du 1er, +1d8 contre mort-vivant ou fiélon).",
          en: "Divine Smite (spell): after a hit, spend a slot for +2d8 radiant (+1d8 per slot level above 1st, +1d8 against undead or fiends).",
        }),
      );
      break;
  }
  return notes;
}

/**
 * Combat options usable as a **Bonus Action**, from automatic base-class
 * features plus the two-weapon fighting rule.
 */
export function bonusActionOptions(input: {
  classId: string;
  level?: number;
  /** Number of Light melee weapons carried (drives two-weapon fighting). */
  lightMeleeWeapons?: number;
}): string[] {
  const lvl = Math.max(1, Math.round(input.level ?? 1));
  const out: string[] = [];

  switch (input.classId as ClassId) {
    case "barbarian":
      out.push(pick({ fr: "Entrer en rage", en: "Enter your Rage" }));
      break;
    case "bard":
      out.push(
        pick({
          fr: "Inspiration bardique (donner un dé à un allié)",
          en: "Bardic Inspiration (give a die to an ally)",
        }),
      );
      break;
    case "druid":
      if (lvl >= 2) out.push(pick({ fr: "Forme sauvage", en: "Wild Shape" }));
      break;
    case "fighter":
      if (lvl >= 2)
        out.push(
          pick({
            fr: "Second souffle (récupérer des points de vie)",
            en: "Second Wind (regain hit points)",
          }),
        );
      break;
    case "monk":
      // The Martial Arts Unarmed Strike is an action of the session screen.
      if (lvl >= 2)
        out.push(
          pick({
            fr: "Rafale de coups (2 frappes à mains nues, 1 point de discipline)",
            en: "Flurry of Blows (2 unarmed strikes, 1 Focus Point)",
          }),
        );
      break;
    case "paladin":
      if (lvl >= 2)
        out.push(
          pick({
            fr: "Châtiment divin après un coup au but (via un emplacement de sort)",
            en: "Divine Smite after a hit (with a spell slot)",
          }),
        );
      break;
    case "ranger":
      out.push(
        pick({
          fr: "Marque du chasseur (lancer ou déplacer la marque)",
          en: "Hunter's Mark (cast or move the mark)",
        }),
      );
      break;
    case "rogue":
      if (lvl >= 2)
        out.push(
          pick({
            fr: "Ruse : Désengagement, Course ou Cachette",
            en: "Cunning Action: Disengage, Dash or Hide",
          }),
        );
      break;
  }

  if ((input.lightMeleeWeapons ?? 0) >= 2) {
    out.push(
      pick({
        fr: "Attaquer avec une seconde arme légère (combat à deux armes)",
        en: "Attack with a second light weapon (two-weapon fighting)",
      }),
    );
  }
  return out;
}
