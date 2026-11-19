import { z } from "zod";
import type { Ability } from "./abilities";
import { compareLabels, localized, localizedList } from "./locale";

export const SKILLS = [
  "acrobatics",
  "animalHandling",
  "arcana",
  "athletics",
  "deception",
  "history",
  "insight",
  "intimidation",
  "investigation",
  "medicine",
  "nature",
  "perception",
  "performance",
  "persuasion",
  "religion",
  "sleightOfHand",
  "stealth",
  "survival",
] as const;
export type Skill = (typeof SKILLS)[number];
export const skillSchema = z.enum(SKILLS);

export const SKILL_LABELS: Record<Skill, string> = localized({
  fr: {
    acrobatics: "Acrobaties",
    animalHandling: "Dressage",
    arcana: "Arcanes",
    athletics: "Athlétisme",
    deception: "Tromperie",
    history: "Histoire",
    insight: "Intuition",
    intimidation: "Intimidation",
    investigation: "Investigation",
    medicine: "Médecine",
    nature: "Nature",
    perception: "Perception",
    performance: "Représentation",
    persuasion: "Persuasion",
    religion: "Religion",
    sleightOfHand: "Escamotage",
    stealth: "Discrétion",
    survival: "Survie",
  },
  en: {
    acrobatics: "Acrobatics",
    animalHandling: "Animal Handling",
    arcana: "Arcana",
    athletics: "Athletics",
    deception: "Deception",
    history: "History",
    insight: "Insight",
    intimidation: "Intimidation",
    investigation: "Investigation",
    medicine: "Medicine",
    nature: "Nature",
    perception: "Perception",
    performance: "Performance",
    persuasion: "Persuasion",
    religion: "Religion",
    sleightOfHand: "Sleight of Hand",
    stealth: "Stealth",
    survival: "Survival",
  },
});

/** Skills sorted alphabetically by their label (engine locale) — for pickers and lists. */
export const SKILLS_BY_LABEL: Skill[] = localizedList(() =>
  [...SKILLS].sort((a, b) => compareLabels(SKILL_LABELS[a], SKILL_LABELS[b])),
);

/**
 * What each skill is actually *for*, in one line — the thing a player needs
 * when the picker asks them to choose two and the names alone say nothing.
 * Our words, never rulebook prose.
 */
export const SKILL_SUMMARY: Record<Skill, string> = localized({
  fr: {
    acrobatics: "Garder l'équilibre, amortir une chute, se tortiller hors d'une prise.",
    animalHandling: "Calmer une bête, deviner ses intentions, tenir une monture difficile.",
    arcana: "Reconnaître un sort, un objet magique, une créature des plans.",
    athletics: "Grimper, nager, sauter, et tout ce qui se règle à la force des bras.",
    deception: "Mentir avec aplomb, se faire passer pour un autre, détourner l'attention.",
    history: "Se rappeler un royaume, une guerre, une dynastie, une vieille querelle.",
    insight: "Lire les intentions derrière les mots : est-ce qu'on vous ment ?",
    intimidation: "Obtenir par la menace — ou par le simple fait de se dresser là.",
    investigation:
      "Déduire d'un indice : fouiller une pièce, repérer le faux, trouver le mécanisme.",
    medicine: "Stabiliser un mourant, diagnostiquer un mal, reconnaître une cause de décès.",
    nature: "Connaître les bêtes, les plantes, le temps qu'il fera, le terrain qui vient.",
    perception: "Remarquer ce qui est là : un bruit, une silhouette, un détail qui cloche.",
    performance: "Tenir une salle — chanter, jouer, déclamer, faire rire ou pleurer.",
    persuasion: "Convaincre de bonne foi : négocier, rassurer, obtenir une faveur.",
    religion: "Reconnaître un rite, un symbole divin, une créature céleste ou fiélonne.",
    sleightOfHand: "Escamoter, faire les poches, dissimuler un objet dans sa main.",
    stealth: "Se déplacer sans bruit, rester hors de vue, suivre sans être vu.",
    survival: "Pister, s'orienter, chasser, trouver un abri et un chemin praticable.",
  },
  en: {
    acrobatics: "Keeping your balance, breaking a fall, wriggling out of a hold.",
    animalHandling: "Calming a beast, reading its intentions, handling a difficult mount.",
    arcana: "Recognising a spell, a magic item, a creature from the planes.",
    athletics: "Climbing, swimming, jumping, and anything settled by sheer strength.",
    deception: "Lying with a straight face, passing for someone else, drawing attention away.",
    history: "Recalling a kingdom, a war, a dynasty, an old feud.",
    insight: "Reading the intent behind the words: is someone lying to you?",
    intimidation: "Getting your way through threats — or just by standing there.",
    investigation:
      "Deducing from a clue: searching a room, spotting a fake, finding the mechanism.",
    medicine: "Stabilising the dying, diagnosing an illness, telling what caused a death.",
    nature: "Knowing beasts, plants, the coming weather, the terrain ahead.",
    perception: "Noticing what is there: a sound, a shape, a detail that feels off.",
    performance: "Holding a room — singing, playing, reciting, making people laugh or cry.",
    persuasion: "Convincing in good faith: negotiating, reassuring, winning a favour.",
    religion: "Recognising a rite, a holy symbol, a celestial or fiendish creature.",
    sleightOfHand: "Palming, picking pockets, hiding an object in your hand.",
    stealth: "Moving silently, staying out of sight, following unseen.",
    survival: "Tracking, finding your way, hunting, finding shelter and a passable path.",
  },
});

export const SKILL_ABILITY: Record<Skill, Ability> = {
  acrobatics: "dex",
  animalHandling: "wis",
  arcana: "int",
  athletics: "str",
  deception: "cha",
  history: "int",
  insight: "wis",
  intimidation: "cha",
  investigation: "int",
  medicine: "wis",
  nature: "int",
  perception: "wis",
  performance: "cha",
  persuasion: "cha",
  religion: "int",
  sleightOfHand: "dex",
  stealth: "dex",
  survival: "wis",
};

/** Final skill-check modifier per skill (ability mod + proficiency / expertise). */
export const skillModifierBlockSchema = z.object({
  acrobatics: z.number().int(),
  animalHandling: z.number().int(),
  arcana: z.number().int(),
  athletics: z.number().int(),
  deception: z.number().int(),
  history: z.number().int(),
  insight: z.number().int(),
  intimidation: z.number().int(),
  investigation: z.number().int(),
  medicine: z.number().int(),
  nature: z.number().int(),
  perception: z.number().int(),
  performance: z.number().int(),
  persuasion: z.number().int(),
  religion: z.number().int(),
  sleightOfHand: z.number().int(),
  stealth: z.number().int(),
  survival: z.number().int(),
});
export type SkillModifierBlock = z.infer<typeof skillModifierBlockSchema>;
