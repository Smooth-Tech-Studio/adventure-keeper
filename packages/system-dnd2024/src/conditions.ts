import { z } from "zod";
import { compareLabels, localized, localizedList } from "./locale";

/**
 * 5e 2024 conditions. Exhaustion is tracked separately as a 0–6 level, not in
 * this list. Slugs are ASCII; `CONDITION_LABELS` holds the names, in the engine's locale.
 */
export const CONDITIONS = [
  "aveugle",
  "charme",
  "assourdi",
  "effraye",
  "agrippe",
  "neutralise",
  "invisible",
  "paralyse",
  "petrifie",
  "empoisonne",
  "a-terre",
  "entrave",
  "etourdi",
  "inconscient",
] as const;
export type Condition = (typeof CONDITIONS)[number];
export const conditionSchema = z.enum(CONDITIONS);

export const CONDITION_LABELS: Record<Condition, string> = localized({
  fr: {
    aveugle: "Aveuglé",
    charme: "Charmé",
    assourdi: "Assourdi",
    effraye: "Effrayé",
    agrippe: "Agrippé",
    neutralise: "Neutralisé",
    invisible: "Invisible",
    paralyse: "Paralysé",
    petrifie: "Pétrifié",
    empoisonne: "Empoisonné",
    "a-terre": "À terre",
    entrave: "Entravé",
    etourdi: "Étourdi",
    inconscient: "Inconscient",
  },
  en: {
    aveugle: "Blinded",
    charme: "Charmed",
    assourdi: "Deafened",
    effraye: "Frightened",
    agrippe: "Grappled",
    neutralise: "Incapacitated",
    invisible: "Invisible",
    paralyse: "Paralyzed",
    petrifie: "Petrified",
    empoisonne: "Poisoned",
    "a-terre": "Prone",
    entrave: "Restrained",
    etourdi: "Stunned",
    inconscient: "Unconscious",
  },
});

/** Conditions sorted alphabetically by their label (engine locale) — for pickers and lists. */
export const CONDITIONS_BY_LABEL: Condition[] = localizedList(() =>
  [...CONDITIONS].sort((a, b) => compareLabels(CONDITION_LABELS[a], CONDITION_LABELS[b])),
);

/** One-line reminder of what the condition does, in our own words. */
export const CONDITION_SUMMARY: Record<Condition, string> = localized({
  fr: {
    aveugle:
      "Rate tout jet qui demande la vue. Désavantage aux attaques ; les attaques contre soi ont l'avantage.",
    charme:
      "Ne peut pas attaquer l'instigateur ni le cibler avec un effet nuisible ; l'instigateur a l'avantage aux interactions sociales.",
    assourdi: "Rate tout jet qui demande l'ouïe.",
    effraye:
      "Désavantage aux jets et aux attaques tant que la source de la peur est en vue ; ne peut pas s'en rapprocher volontairement.",
    agrippe:
      "Vitesse à 0, aucun bonus de vitesse. Prend fin si l'agrippeur est neutralisé ou éloigné de force.",
    neutralise: "Ne peut agir ni réagir, ne peut rien dire.",
    invisible:
      "Impossible à voir sans aide. Attaques contre soi avec désavantage, ses propres attaques avec l'avantage ; surprise possible.",
    paralyse:
      "Neutralisé et immobile. Rate les sauvegardes de Force et de Dextérité. Attaques contre soi avec l'avantage ; coup critique si l'attaquant est à 1,50 m.",
    petrifie:
      "Transformé en solide inerte, neutralisé, résistance à tous les dégâts, immunité poison et maladie ; comme paralysé pour les attaques.",
    empoisonne: "Désavantage aux jets d'attaque et aux jets de caractéristique.",
    "a-terre":
      "Ne peut que ramper (déplacement coûteux). Désavantage aux attaques ; attaques adjacentes contre soi avec l'avantage, à distance avec désavantage.",
    entrave:
      "Vitesse à 0. Désavantage aux attaques et aux sauvegardes de Dextérité ; attaques contre soi avec l'avantage.",
    etourdi:
      "Neutralisé, chancelant. Rate les sauvegardes de Force et de Dextérité ; attaques contre soi avec l'avantage.",
    inconscient:
      "Neutralisé, à terre, lâche ce qu'il tient, ignore son environnement. Rate For/Dex ; attaques adjacentes = critique.",
  },
  en: {
    aveugle:
      "Fails any check that needs sight. Disadvantage on attacks; attacks against you have advantage.",
    charme:
      "Can't attack the charmer or target them with harmful effects; the charmer has advantage on social checks against you.",
    assourdi: "Fails any check that needs hearing.",
    effraye:
      "Disadvantage on checks and attacks while the source of fear is in sight; can't willingly move closer to it.",
    agrippe:
      "Speed 0, no bonus to speed. Ends if the grappler is incapacitated or forcibly moved away.",
    neutralise: "Can't take actions or reactions, and can't speak.",
    invisible:
      "Can't be seen without help. Attacks against you have disadvantage, your attacks have advantage; can surprise.",
    paralyse:
      "Incapacitated and can't move. Fails Strength and Dexterity saves. Attacks against you have advantage; a hit from within 5 feet is a critical hit.",
    petrifie:
      "Turned into inert solid matter, incapacitated, resistance to all damage, immune to poison and disease; attacked as if paralyzed.",
    empoisonne: "Disadvantage on attack rolls and ability checks.",
    "a-terre":
      "Can only crawl (costly movement). Disadvantage on attacks; adjacent attacks against you have advantage, ranged ones disadvantage.",
    entrave:
      "Speed 0. Disadvantage on attacks and Dexterity saves; attacks against you have advantage.",
    etourdi:
      "Incapacitated, reeling. Fails Strength and Dexterity saves; attacks against you have advantage.",
    inconscient:
      "Incapacitated, prone, drops what it holds, unaware of its surroundings. Fails Str/Dex saves; adjacent attacks are critical hits.",
  },
});
