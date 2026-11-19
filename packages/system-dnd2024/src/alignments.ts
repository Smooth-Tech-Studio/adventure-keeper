import { z } from "zod";
import { localized } from "./locale";

export const ALIGNMENTS = ["LG", "NG", "CG", "LN", "N", "CN", "LE", "NE", "CE"] as const;
export type Alignment = (typeof ALIGNMENTS)[number];
export const alignmentSchema = z.enum(ALIGNMENTS);

export const ALIGNMENT_LABELS: Record<Alignment, string> = localized({
  fr: {
    LG: "Loyal Bon",
    NG: "Neutre Bon",
    CG: "Chaotique Bon",
    LN: "Loyal Neutre",
    N: "Neutre",
    CN: "Chaotique Neutre",
    LE: "Loyal Mauvais",
    NE: "Neutre Mauvais",
    CE: "Chaotique Mauvais",
  },
  en: {
    LG: "Lawful Good",
    NG: "Neutral Good",
    CG: "Chaotic Good",
    LN: "Lawful Neutral",
    N: "Neutral",
    CN: "Chaotic Neutral",
    LE: "Lawful Evil",
    NE: "Neutral Evil",
    CE: "Chaotic Evil",
  },
});

/**
 * The two axes, said plainly: order against freedom, and altruism against
 * self-interest. A player new to the table reads « Loyal Neutre » and has no
 * idea what they are agreeing to. Our words, never rulebook prose.
 */
export const ALIGNMENT_SUMMARY: Record<Alignment, string> = localized({
  fr: {
    LG: "Fait le bien en suivant les règles : parole tenue, devoir assumé.",
    NG: "Fait le bien comme il peut, sans trop se soucier des règles.",
    CG: "Fait le bien à sa manière, quitte à bousculer l'ordre établi.",
    LN: "Tient à l'ordre et à la parole donnée, sans juger du bien ni du mal.",
    N: "Garde l'équilibre et reste en dehors : chaque situation à son mérite.",
    CN: "Suit son envie du moment ; la liberté passe avant tout le reste.",
    LE: "Use des règles et des hiérarchies pour arriver à ses fins.",
    NE: "Prend ce qu'il veut dès que cela ne lui coûte rien.",
    CE: "Détruit et saisit à volonté, sans règle ni retenue.",
  },
  en: {
    LG: "Does good by the rules: keeps their word, shoulders their duty.",
    NG: "Does good as best they can, without worrying much about rules.",
    CG: "Does good their own way, even if it shakes the established order.",
    LN: "Values order and a given word, without judging good or evil.",
    N: "Keeps the balance and stays out of it: each situation on its merits.",
    CN: "Follows the whim of the moment; freedom comes before everything else.",
    LE: "Uses rules and hierarchies to get what they want.",
    NE: "Takes what they want whenever it costs them nothing.",
    CE: "Destroys and seizes at will, without rule or restraint.",
  },
});
