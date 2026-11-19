import {
  ABILITIES,
  ABILITY_LABELS,
  ARMOR_CATEGORIES,
  ARMOR_CATEGORY_LABELS,
  DAMAGE_TYPES,
  DAMAGE_TYPE_LABELS,
  WEAPON_CATEGORIES,
  WEAPON_CATEGORY_LABELS,
  WEAPON_MASTERIES,
  WEAPON_MASTERY_LABELS,
  WEAPON_PROPERTIES,
  WEAPON_PROPERTY_LABELS,
  CHOICE_KINDS,
  CLASS_IDS,
  CREATURE_SIZES,
  CREATURE_SIZE_LABELS,
  DAMAGE_KINDS,
  DAMAGE_KIND_LABELS,
  FEAT_CATEGORIES,
  FEAT_CATEGORY_LABELS,
  LANGUAGE_IDS,
  MONSTER_TYPES,
  MONSTER_TYPE_LABELS,
  PACK_CONTENT_KINDS,
  SKILLS,
  SKILL_LABELS,
  SPELL_SCHOOLS,
  SPELL_SCHOOL_LABELS,
  TOOL_CATEGORIES,
  TOOL_CATEGORY_LABELS,
  getClass,
  getLanguage,
  type PackContentKind,
} from "@adventure-keeper/system-dnd2024";

import { currentLanguage } from "@/i18n";

/**
 * The pack format guide's text for each kind of entry: its fields in our
 * words, and the values a field accepts — read from the engine's own lists.
 * Kept apart from the page so a test can hold it against the schema: a field
 * the format gains must be documented here.
 */

/** Inline `code`, for a field name or a value. */
export function C({ children }: { children: React.ReactNode }) {
  return <code className="bg-muted rounded px-1 py-0.5 text-[0.85em]">{children}</code>;
}

const pairs = <T extends string>(ids: readonly T[], labels: Record<T, string>) =>
  ids.map((id): [string, string] => [id, labels[id]]);

/** Read on each use: the labels follow the reader's language. */
const VALUES = {
  get abilities() {
    return pairs(ABILITIES, ABILITY_LABELS);
  },
  get skills() {
    return pairs(SKILLS, SKILL_LABELS);
  },
  get classes() {
    return CLASS_IDS.map((id): [string, string] => [id, getClass(id)?.name ?? id]);
  },
  get sizes() {
    return pairs(CREATURE_SIZES, CREATURE_SIZE_LABELS);
  },
  get damage() {
    return pairs(DAMAGE_KINDS, DAMAGE_KIND_LABELS);
  },
  get languages() {
    return LANGUAGE_IDS.map((id): [string, string] => [id, getLanguage(id)?.name ?? id]);
  },
  get featCategories() {
    return pairs(FEAT_CATEGORIES, FEAT_CATEGORY_LABELS);
  },
  get schools() {
    return pairs(SPELL_SCHOOLS, SPELL_SCHOOL_LABELS);
  },
  get monsterTypes() {
    return pairs(MONSTER_TYPES, MONSTER_TYPE_LABELS);
  },
  get toolCategories() {
    return pairs(TOOL_CATEGORIES, TOOL_CATEGORY_LABELS);
  },
  get weaponCategories() {
    return pairs(WEAPON_CATEGORIES, WEAPON_CATEGORY_LABELS);
  },
  get weaponProperties() {
    return pairs(WEAPON_PROPERTIES, WEAPON_PROPERTY_LABELS);
  },
  get masteries() {
    return pairs(WEAPON_MASTERIES, WEAPON_MASTERY_LABELS);
  },
  get damageTypes() {
    return pairs(DAMAGE_TYPES, DAMAGE_TYPE_LABELS);
  },
  get armorCategories() {
    return pairs(ARMOR_CATEGORIES, ARMOR_CATEGORY_LABELS);
  },
  choiceKinds: CHOICE_KINDS.map((id): [string, string] => [id, ""]),
};

/** The `mechanics` types, one line each — shared by traits, subclass features and feats. */
const MECHANIC_TYPES = [
  "unarmoredDefense",
  "speed",
  "movement",
  "initiative",
  "saveProficiency",
  "saveBonus",
  "checkBonus",
  "advantage",
  "armorTraining",
  "martialWeapons",
  "hitPointsPerLevel",
  "abilityScore",
  "resistance",
  "sense",
  "extraCantrips",
  "critRange",
  "damageBonus",
  "note",
] as const;

function MechanicsHelp({ en }: { en?: boolean }) {
  return en ? (
    <>
      <C>{'[{ "type": …, "minLevel"?: … }]'}</C>: what the engine applies. Types:{" "}
      {MECHANIC_TYPES.map((type, i) => (
        <span key={type}>
          {i > 0 && ", "}
          <C>{type}</C>
        </span>
      ))}
      . E.g. <C>{'{ "type": "initiative", "bonus": "prof" }'}</C>,{" "}
      <C>{'{ "type": "speed", "bonus": 10, "when": "unarmoredNoShield" }'}</C>,{" "}
      <C>{'{ "type": "advantage", "on": "save", "abilities": ["dex"] }'}</C>. An amount is a number,{" "}
      <C>"prof"</C>, <C>"halfProf"</C>, <C>"level"</C>, <C>{'{ "ability": "wis", "min": 1 }'}</C>,{" "}
      <C>{'{ "perLevel": 5 }'}</C> or <C>{'{ "byLevel": [[2, 10], [6, 15]] }'}</C>.
    </>
  ) : (
    <>
      <C>{'[{ "type": …, "minLevel"?: … }]'}</C> : ce que le moteur applique. Types :{" "}
      {MECHANIC_TYPES.map((type, i) => (
        <span key={type}>
          {i > 0 && ", "}
          <C>{type}</C>
        </span>
      ))}
      . Par ex. <C>{'{ "type": "initiative", "bonus": "prof" }'}</C>,{" "}
      <C>{'{ "type": "speed", "bonus": 10, "when": "unarmoredNoShield" }'}</C>,{" "}
      <C>{'{ "type": "advantage", "on": "save", "abilities": ["dex"] }'}</C>. Une quantité est un
      nombre, <C>"prof"</C>, <C>"halfProf"</C>, <C>"level"</C>,{" "}
      <C>{'{ "ability": "wis", "min": 1 }'}</C>, <C>{'{ "perLevel": 5 }'}</C> ou{" "}
      <C>{'{ "byLevel": [[2, 10], [6, 15]] }'}</C>.
    </>
  );
}

interface KindGuide {
  intro: string;
  rows: [string, React.ReactNode][];
  values?: [string, [string, string][]][];
}

/** What each kind of entry holds — our words; the values come from the engine. */
const KIND_GUIDE_FR = (): Record<PackContentKind, KindGuide> => ({
  classes: {
    intro:
      "Une classe jouable : ses chiffres, ce qu'elle active dans le moteur, ses tables et ses aptitudes. Ses sous-classes et ses sorts la nomment par son id.",
    rows: [
      ["blurb", "Une ligne qui donne envie (160 caractères au plus)."],
      ["imageUrl ?", "L'adresse d'une illustration, hébergée par l'auteur du pack."],
      [
        "hitDie",
        <>
          Dé de vie : <C>6</C>, <C>8</C>, <C>10</C> ou <C>12</C>.
        </>,
      ],
      [
        "complexity ?",
        <>
          <C>"low"</C>, <C>"average"</C> (par défaut) ou <C>"high"</C> : la prise en main.
        </>,
      ],
      ["primaryAbility", "Une ou deux caractéristiques principales."],
      ["savingThrows", "Les deux jets de sauvegarde maîtrisés."],
      [
        "suggestedScores",
        <>
          Les valeurs proposées par le formulaire : <C>{"{ str, dex, con, int, wis, cha }"}</C>.
        </>,
      ],
      [
        "skillChoices",
        <>
          <C>{"{ count, from }"}</C> : les compétences à choisir.
        </>,
      ],
      ["armorTraining ?", "Catégories d'armures maîtrisées."],
      [
        "weaponProficiency",
        <>
          <C>{'{ "simple": true, "martial": true }'}</C> ; <C>martial</C> peut valoir{" "}
          <C>"finesse-or-light"</C> ou <C>"light"</C>.
        </>,
      ],
      ["toolProficiencies ?", "Outils maîtrisés d'office (ids du catalogue)."],
      [
        "toolChoice ?",
        <>
          <C>{"{ count, from }"}</C> : outils au choix dans un groupe (<C>"artisan"</C>,{" "}
          <C>"instrument"</C>…).
        </>,
      ],
      [
        "spellcasting ?",
        <>
          <C>"full"</C>, <C>"half"</C> ou <C>"pact"</C> : la progression des emplacements de sorts.
        </>,
      ],
      ["spellcastingAbility ?", "La caractéristique d'incantation."],
      [
        "cantripsKnown ?, preparedSpells ?",
        "Sorts mineurs et sorts préparés, une valeur par niveau (20 valeurs).",
      ],
      [
        "expertise ?",
        <>
          <C>{'[{ "level": 1, "count": 2 }]'}</C> : compétences en expertise selon le niveau.
        </>,
      ],
      ["toolExpertise ?", "Nombre d'outils maîtrisés qui passent en expertise."],
      [
        "martialArts ?",
        <>
          <C>{'[{ "level": 1, "die": "d6" }]'}</C> : le dé d'arts martiaux.
        </>,
      ],
      ["wildShapeFrom ?", "Niveau à partir duquel la classe a la forme sauvage."],
      ["invocationsKnown ?", "Invocations occultes connues, une valeur par niveau (20 valeurs)."],
      [
        "weaponMastery ?",
        <>
          <C>{'[{ "level": 1, "count": 2 }]'}</C> : bottes d'arme selon le niveau.
        </>,
      ],
      [
        "asiLevels ?",
        "Niveaux du don Amélioration de caractéristique (4, 8, 12 et 16 par défaut).",
      ],
      ["fightingStyleLevel ?", "Niveau du don de style de combat."],
      ["languages ?, languagePicks ?", "Langues accordées, et langues à choisir en plus."],
      ["subclassLabel ?", "Le nom de la sous-classe (« Voie », « Serment »…)."],
      [
        "spells ?",
        <>
          <C>{"[{ spellId, minLevel, spellLevel }]"}</C> : sorts toujours préparés.
        </>,
      ],
      [
        "bonusSkill ?",
        <>
          <C>{"{ id, minLevel, label, hint }"}</C> : une compétence de classe de plus, à un niveau.
        </>,
      ],
      [
        "startingEquipment ?",
        <>
          <C>
            {'{ "options": [{ "id": "a", "label", "items", "gold" }, { "id": "b", "gold": 75 }] }'}
          </C>{" "}
          : les paquetages, un seul retenu ; sans <C>label</C>, de l'or seulement.
        </>,
      ],
      [
        "options ?",
        <>
          <C>{"[{ slug, level, label, options: [{ id, name, summary, mechanics? }] }]"}</C> : les «
          au choix » de la table de classe.
        </>,
      ],
      [
        "features",
        <>
          <C>{"[{ level, name, summary, uses?, mechanics?, roll? }]"}</C> : les aptitudes de la
          classe ; <C>roll</C> : ce qu'elle fait lancer (
          <C>{'{ "dice": { "count": 1, "die": "d10" }, "bonus": "level", "gives": "hp" }'}</C>).
        </>,
      ],
    ],
    values: [
      ["Caractéristiques", VALUES.abilities],
      ["Compétences", VALUES.skills],
      ["Langues", VALUES.languages],
    ],
  },
  species: {
    intro: "Une espèce jouable, avec ses traits et, si elle en a, ses lignées.",
    rows: [
      ["blurb", "Une ligne qui donne envie (160 caractères au plus)."],
      ["imageUrl ?", "L'adresse d'une illustration, hébergée par l'auteur du pack."],
      [
        "size",
        <>
          Une taille, ou deux au choix : <C>"medium"</C> ou <C>["small", "medium"]</C>.
        </>,
      ],
      ["speed", "Vitesse en pieds (30 = 9 m)."],
      ["darkvision ?", "Vision dans le noir en pieds, 0 par défaut."],
      [
        "choice ?",
        <>
          <C>{"{ label, options }"}</C> : le choix de lignée ou d'héritage.
        </>,
      ],
      [
        "lineages ?",
        <>
          Pour chaque option de <C>choice</C> : <C>speed</C>, <C>darkvision</C>, <C>resistances</C>,{" "}
          <C>spells</C> et un <C>summary</C>.
        </>,
      ],
      [
        "spells ?",
        <>
          <C>{"[{ spellId, minLevel, spellLevel }]"}</C> : sorts accordés selon le niveau du
          personnage.
        </>,
      ],
      ["spellsTrait ?", "Le nom du trait qui accorde ces sorts, affiché sur la fiche."],
      [
        "spellsUseChosenAbility ?",
        "Vrai si le joueur choisit la caractéristique d'incantation de ces sorts (Intelligence, Sagesse ou Charisme).",
      ],
      ["resistances ?", "Types de dégâts auxquels l'espèce résiste."],
      [
        "skillGrant ?",
        <>
          <C>{"{ trait, count, from }"}</C> : compétences au choix (<C>from</C> : une liste ou{" "}
          <C>"any"</C>).
        </>,
      ],
      [
        "traits",
        <>
          <C>{"[{ name, summary, uses?, mechanics? }]"}</C> — <C>uses</C> :{" "}
          <C>{'{ max, recharge: "short" | "long", shortFrom? }'}</C> (<C>max</C> : une quantité,
          voir <C>mechanics</C> dans les dons).
        </>,
      ],
      ["languages ?", "Langues accordées en plus des langues de base."],
      ["hitPointsPerLevel ?", "Points de vie en plus par niveau (« Ténacité naine »)."],
      [
        "originFeatGrant ?",
        <>
          <C>{'{ "trait": "Polyvalent" }'}</C> : un don d'origine au choix, au nom de ce trait.
        </>,
      ],
      [
        "breathWeapon ?",
        <>
          <C>{'{ name, save: "dex", onSuccess: "half", baseDice, shapes }'}</C> : une attaque de
          zone ; ses dégâts viennent de <C>breathDamage</C> dans l'option choisie (<C>lineages</C>).
        </>,
      ],
      [
        "powerfulBuild ?",
        "Vrai : une taille de plus pour la capacité de charge (« Forte carrure »).",
      ],
      [
        "lineageTrait ?",
        <>
          Le trait qui présente toutes les options de <C>choice</C> ; la fiche le remplace par
          l'option choisie.
        </>,
      ],
    ],
    values: [
      ["Tailles", VALUES.sizes],
      ["Types de dégâts", VALUES.damage],
      ["Langues", VALUES.languages],
      ["Compétences", VALUES.skills],
    ],
  },
  backgrounds: {
    intro:
      "Un historique : ses caractéristiques, ses compétences, son outil, son don d'origine et son paquetage.",
    rows: [
      ["blurb", "Une ligne (160 caractères au plus)."],
      ["imageUrl ?", "L'adresse d'une illustration, hébergée par l'auteur du pack."],
      [
        "abilityOptions",
        "Exactement trois caractéristiques, où le joueur répartit +2/+1 ou +1/+1/+1.",
      ],
      ["skillProficiencies ?", "Exactement deux compétences."],
      [
        "toolProficiency ?",
        <>
          <C>{"{ label, toolId }"}</C> pour un outil précis, ou <C>{"{ label, choice }"}</C> avec{" "}
          <C>artisan</C>, <C>instrument</C> ou <C>gaming</C> pour un outil au choix.
        </>,
      ],
      ["originFeatId ?", "Le don d'origine : un don du pack ou du SRD (voir « Références »)."],
      [
        "startingKit ?",
        <>
          <C>{"{ items, gold, choices? }"}</C> — chaque objet : <C>{"{ kind, id }"}</C> (
          <C>weapon</C>, <C>armor</C>, <C>tool</C>, <C>gear</C>, <C>pack</C>) ou{" "}
          <C>{"{ kind, fromChoice }"}</C> pour l'objet qu'un choix de l'historique désigne. L'option
          « 50 po » est ajoutée d'office.
        </>,
      ],
    ],
    values: [
      ["Caractéristiques", VALUES.abilities],
      ["Compétences", VALUES.skills],
    ],
  },
  subclasses: {
    intro: "Une sous-classe pour une classe du SRD, avec ses aptitudes par niveau.",
    rows: [
      ["classId", "La classe qu'elle spécialise."],
      ["blurb", "Une ligne (160 caractères au plus)."],
      ["imageUrl ?", "L'adresse d'une illustration, hébergée par l'auteur du pack."],
      [
        "features",
        <>
          <C>{"[{ level, name, summary, uses?, mechanics? }]"}</C> : les aptitudes, au niveau de
          classe où elles arrivent, avec leurs utilisations et leurs effets (comme pour les traits
          et les dons).
        </>,
      ],
      [
        "spells ?",
        <>
          <C>{"[{ spellId, minLevel, spellLevel }]"}</C> : sorts toujours préparés, <C>minLevel</C>{" "}
          étant le niveau de classe.
        </>,
      ],
      [
        "spellVariants ?",
        <>
          <C>{"{ label, hint?, options: [{ name, summary, spells }] }"}</C> : plusieurs listes au
          choix (un environnement, un aspect…).
        </>,
      ],
    ],
    values: [["Classes", VALUES.classes]],
  },
  feats: {
    intro: "Un don : d'origine, style de combat, général ou faveur épique.",
    rows: [
      ["category", "Sa catégorie."],
      ["summary", "Ce qu'il fait, avec vos mots (600 caractères au plus)."],
      ["blurb ?", "Une accroche pour la liste de choix."],
      ["minLevel ?", "Niveau minimum (4 pour un don général, 19 pour une faveur)."],
      ["prerequisite ?", "Le reste du prérequis, affiché sans être vérifié."],
      ["repeatable ?", "Peut être pris plusieurs fois."],
      [
        "abilityIncrease ?",
        <>
          <C>{'{ options: ["str", "dex"] | "any", max? }'}</C> : son +1 en caractéristique. Une
          seule option s'applique d'office, plusieurs ouvrent un choix ; plafond 20, ou 30 pour une
          faveur.
        </>,
      ],
      [
        "choices ?",
        <>
          <C>{"[{ id, kind, label, count, pool }]"}</C> : ce que le don fait choisir. <C>pool</C> :{" "}
          <C>{'{ kind: "list", values }'}</C>, <C>{'{ kind: "any" }'}</C> ou{" "}
          <C>{'{ kind: "group", group }'}</C>.
        </>,
      ],
      [
        "effects ?",
        <>
          Ce que le moteur calcule : <C>hitPointsPerLevel</C>, <C>rangedAttackBonus</C>,{" "}
          <C>duelingDamageBonus</C>, <C>thrownDamageBonus</C>, <C>armoredAcBonus</C>,{" "}
          <C>unarmedDamageDice</C>, <C>heavyWeaponProficiencyDamage</C>, et <C>armorTraining</C> (
          <C>{'["light", "medium", "heavy", "shield"]'}</C> : les armures que le don apprend à
          porter).
        </>,
      ],
      ["mechanics ?", <MechanicsHelp />],
      ["combatNote ?", "Un rappel affiché dans le bloc de combat de la fiche."],
      ["bonusAction ?", "Une action bonus qu'il ajoute, listée avec les autres."],
    ],
    values: [
      ["Catégories", VALUES.featCategories],
      ["Caractéristiques", VALUES.abilities],
      ["Types de choix (choices.kind)", VALUES.choiceKinds],
    ],
  },
  spells: {
    intro: "Un sort, pour les classes qui l'apprennent.",
    rows: [
      ["level", "0 pour un sort mineur, de 1 à 9 sinon."],
      ["school", "Son école de magie."],
      ["classes", "Les classes qui l'ont dans leur liste."],
      [
        "castingTime",
        <>
          <C>action</C>, <C>bonus</C>, <C>reaction</C>, ou un texte (« 1 minute »).
        </>,
      ],
      ["range, duration", "Des textes, tels qu'on les lit : « 18 mètres », « 1 minute »."],
      [
        "components",
        <>
          <C>{"{ v, s, m }"}</C> : vrai ou faux pour chacune.
        </>,
      ],
      ["concentration, ritual", "Vrai ou faux."],
      ["summary ?", "Ce qu'il fait, avec vos mots."],
      [
        "damage ?",
        <>
          <C>{"{ pool: { count, die }, kind, scaling?, step?, slotLevel? }"}</C> : ses dégâts, et
          comment ils montent.
        </>,
      ],
      [
        "save ?",
        <>
          <C>{"{ ability, onSuccess }"}</C> — <C>onSuccess</C> : <C>negates</C>, <C>half</C> ou{" "}
          <C>partial</C>.
        </>,
      ],
      ["attackRoll ?", "Le sort demande un jet d'attaque."],
    ],
    values: [
      ["Écoles", VALUES.schools],
      ["Classes", VALUES.classes],
      ["Types de dégâts", VALUES.damage],
    ],
  },
  monsters: {
    intro: "Un monstre que le MJ peut choisir comme ennemi : l'ennemi en copie les chiffres.",
    rows: [
      ["type, size", "Son type et sa taille."],
      [
        "cr",
        <>
          Facteur de puissance en texte : <C>"1/2"</C>, <C>"3"</C>…
        </>,
      ],
      ["armorClass, hitPoints", "Classe d'armure et points de vie."],
      ["speed ?", "Vitesse en pieds, 30 par défaut."],
      [
        "attacks ?",
        <>
          <C>
            {"[{ name, toHit, reach?, damage: { count, die }, damageBonus, damageKind, note? }]"}
          </C>
        </>,
      ],
      [
        "beast ?",
        <>
          <C>{"{ str, dex, con, climb?, swim?, fly? }"}</C> : pour une bête dont un personnage prend
          la forme (forme sauvage) ou qu'il appelle (familier).
        </>,
      ],
    ],
    values: [
      ["Types", VALUES.monsterTypes],
      ["Tailles", VALUES.sizes],
      ["Types de dégâts", VALUES.damage],
    ],
  },
  invocations: {
    intro:
      "Une manifestation occulte, pour une classe qui en apprend (invocationsKnown) : son prérequis, ce qu'elle fait, et ce que la fiche en tire.",
    rows: [
      ["minLevel", "Niveau de classe requis, 0 si aucun."],
      [
        "requires ?",
        "Une autre manifestation à prendre d'abord : son id dans ce pack, ou celle du SRD.",
      ],
      ["condition ?", "Un prérequis que la fiche ne vérifie pas, affiché en indication."],
      ["summary", "Ce qu'elle fait, en une ou deux phrases (600 caractères au plus)."],
      ["repeatable ?", "Vrai si elle se prend plusieurs fois."],
      [
        "cantrip ?",
        <>
          <C>"damage"</C> ou <C>"attack"</C> : liée à un sort mineur du personnage qui inflige des
          dégâts ou fait un jet d'attaque.
        </>,
      ],
      [
        "spells ?",
        <>
          <C>{"[{ spellId, spellLevel }]"}</C> : sorts lancés sans emplacement, toujours préparés.
        </>,
      ],
      ["unarmoredAc ?", "CA sans armure : cette valeur + Dextérité."],
      ["darkvision ?, truesight ?", "Vision dans le noir, vision véritable, en pieds."],
      ["swimSpeed ?", "Vrai : une vitesse de nage égale à la vitesse au sol."],
    ],
  },
  weapons: {
    intro: "Une arme du catalogue : la fiche attaque avec ces chiffres.",
    rows: [
      ["category", "Catégorie (voir les valeurs)."],
      ["priceCp", "Prix en pièces de cuivre (100 = 1 po)."],
      ["weightKg ?", "Poids en kilogrammes."],
      [
        "damageDice ?, versatileDice ?",
        <>
          <C>{'{ "count": 1, "die": "d8" }'}</C> : dégâts, et à deux mains pour une arme
          polyvalente.
        </>,
      ],
      ["damageType ?", "Type de dégâts."],
      ["properties ?", "Propriétés (voir les valeurs)."],
      ["mastery ?", "Botte d'arme."],
      [
        "range ?",
        <>
          <C>{'{ "normal": 6, "max": 18 }'}</C> : portée en mètres, pour une arme de jet ou à
          munitions.
        </>,
      ],
    ],
    values: [
      ["Catégories", VALUES.weaponCategories],
      ["Propriétés", VALUES.weaponProperties],
      ["Bottes", VALUES.masteries],
      ["Types de dégâts", VALUES.damageTypes],
    ],
  },
  armors: {
    intro: "Une armure ou un bouclier : ce qu'elle change à la CA, à la Discrétion, à la vitesse.",
    rows: [
      ["category", "Catégorie (voir les valeurs)."],
      ["priceCp, weightKg", "Prix en pièces de cuivre, poids en kilogrammes."],
      ["baseAc ?", "CA de base d'une armure."],
      ["acBonus ?", "Bonus de CA d'un bouclier."],
      ["addsDex, maxDex ?", "Si la Dextérité s'ajoute, et jusqu'à combien."],
      ["strengthMin ?", "Force minimale ; en dessous, la vitesse baisse de 3 m."],
      ["stealthDisadvantage ?", "Désavantage aux tests de Discrétion."],
      ["description ?", "Ce qu'est la pièce, en une ligne."],
    ],
    values: [["Catégories", VALUES.armorCategories]],
  },
  gear: {
    intro: "Du matériel d'aventurier.",
    rows: [
      ["priceCp, weightKg ?", "Prix en pièces de cuivre, poids en kilogrammes."],
      [
        "group ?",
        <>
          Un regroupement pour la liste (<C>"ammunition"</C>, <C>"focus"</C>…).
        </>,
      ],
      ["description ?", "À quoi il sert, en une ligne."],
    ],
  },
  equipmentPacks: {
    intro: "Un paquetage vendu d'un bloc.",
    rows: [
      ["priceCp", "Prix en pièces de cuivre."],
      [
        "contents",
        <>
          <C>{"[{ gearId, qty }]"}</C> : du matériel de ce pack ou du SRD.
        </>,
      ],
    ],
  },
  languages: {
    intro:
      "Une langue que les personnages peuvent parler. Les espèces et les classes du pack la donnent par son id ; les autres langues se choisissent dans la liste.",
    rows: [
      [
        "kind",
        <>
          <C>"standard"</C> (proposée à tous) ou <C>"rare"</C>.
        </>,
      ],
      ["summary", "Qui la parle, et où on l'entend (300 caractères au plus)."],
    ],
  },
  tools: {
    intro: "Un outil qui rejoint le catalogue : jeu, instrument, outils d'artisan…",
    rows: [
      ["category", "Sa famille : un historique « au choix » propose les outils de sa famille."],
      ["ability", "La caractéristique de ses tests."],
      ["priceCp", "Prix en pièces de cuivre (100 = 1 po)."],
      ["weightKg", "Poids en kilos."],
      ["description ?", "Une ligne."],
    ],
    values: [
      ["Familles", VALUES.toolCategories],
      ["Caractéristiques", VALUES.abilities],
    ],
  },
});

const KIND_GUIDE_EN = (): Record<PackContentKind, KindGuide> => ({
  classes: {
    intro:
      "A playable class: its numbers, what it turns on in the engine, its tables and its features. Its subclasses and spells name it by its id.",
    rows: [
      ["blurb", "One line that makes you want to play it (160 characters at most)."],
      ["imageUrl ?", "The address of an illustration, hosted by the pack's author."],
      [
        "hitDie",
        <>
          Hit die: <C>6</C>, <C>8</C>, <C>10</C> or <C>12</C>.
        </>,
      ],
      [
        "complexity ?",
        <>
          <C>"low"</C>, <C>"average"</C> (default) or <C>"high"</C>: how demanding it is.
        </>,
      ],
      ["primaryAbility", "One or two primary abilities."],
      ["savingThrows", "The two proficient saving throws."],
      [
        "suggestedScores",
        <>
          The scores the form suggests: <C>{"{ str, dex, con, int, wis, cha }"}</C>.
        </>,
      ],
      [
        "skillChoices",
        <>
          <C>{"{ count, from }"}</C>: the skills to pick.
        </>,
      ],
      ["armorTraining ?", "Armour categories the class is trained in."],
      [
        "weaponProficiency",
        <>
          <C>{'{ "simple": true, "martial": true }'}</C>; <C>martial</C> may be{" "}
          <C>"finesse-or-light"</C> or <C>"light"</C>.
        </>,
      ],
      ["toolProficiencies ?", "Tools granted outright (catalogue ids)."],
      [
        "toolChoice ?",
        <>
          <C>{"{ count, from }"}</C>: tools picked from a group (<C>"artisan"</C>,{" "}
          <C>"instrument"</C>…).
        </>,
      ],
      [
        "spellcasting ?",
        <>
          <C>"full"</C>, <C>"half"</C> or <C>"pact"</C>: how spell slots grow.
        </>,
      ],
      ["spellcastingAbility ?", "The spellcasting ability."],
      [
        "cantripsKnown ?, preparedSpells ?",
        "Cantrips and prepared spells, one value per level (20 values).",
      ],
      [
        "expertise ?",
        <>
          <C>{'[{ "level": 1, "count": 2 }]'}</C>: skills with Expertise by level.
        </>,
      ],
      ["toolExpertise ?", "How many tool proficiencies become Expertise."],
      [
        "martialArts ?",
        <>
          <C>{'[{ "level": 1, "die": "d6" }]'}</C>: the Martial Arts die.
        </>,
      ],
      ["wildShapeFrom ?", "The level the class gains Wild Shape at."],
      ["invocationsKnown ?", "Eldritch invocations known, one value per level (20 values)."],
      [
        "weaponMastery ?",
        <>
          <C>{'[{ "level": 1, "count": 2 }]'}</C>: Weapon Mastery slots by level.
        </>,
      ],
      ["asiLevels ?", "Levels of the Ability Score Improvement feat (4, 8, 12 and 16 by default)."],
      ["fightingStyleLevel ?", "The level of the Fighting Style feat."],
      ["languages ?, languagePicks ?", "Languages granted, and languages to pick on top."],
      ["subclassLabel ?", "What its subclass is called (“Path”, “Oath”…)."],
      [
        "spells ?",
        <>
          <C>{"[{ spellId, minLevel, spellLevel }]"}</C>: spells always prepared.
        </>,
      ],
      [
        "bonusSkill ?",
        <>
          <C>{"{ id, minLevel, label, hint }"}</C>: one more class skill, at a level.
        </>,
      ],
      [
        "startingEquipment ?",
        <>
          <C>
            {'{ "options": [{ "id": "a", "label", "items", "gold" }, { "id": "b", "gold": 75 }] }'}
          </C>
          : the packages, one taken; without <C>label</C>, gold only.
        </>,
      ],
      [
        "options ?",
        <>
          <C>{"[{ slug, level, label, options: [{ id, name, summary, mechanics? }] }]"}</C>: the
          “pick one” of the class table.
        </>,
      ],
      [
        "features",
        <>
          <C>{"[{ level, name, summary, uses?, mechanics?, roll? }]"}</C>: the class's features;{" "}
          <C>roll</C>: what using it rolls (
          <C>{'{ "dice": { "count": 1, "die": "d10" }, "bonus": "level", "gives": "hp" }'}</C>).
        </>,
      ],
    ],
    values: [
      ["Abilities", VALUES.abilities],
      ["Skills", VALUES.skills],
      ["Languages", VALUES.languages],
    ],
  },
  species: {
    intro: "A playable species, with its traits and, if it has any, its lineages.",
    rows: [
      ["blurb", "One appealing line (160 characters at most)."],
      ["imageUrl ?", "The address of an illustration, hosted by the pack's author."],
      [
        "size",
        <>
          One size, or two to choose from: <C>"medium"</C> or <C>["small", "medium"]</C>.
        </>,
      ],
      ["speed", "Speed in feet (30 = 9 m)."],
      ["darkvision ?", "Darkvision in feet, 0 by default."],
      [
        "choice ?",
        <>
          <C>{"{ label, options }"}</C>: the lineage or legacy choice.
        </>,
      ],
      [
        "lineages ?",
        <>
          For each option of <C>choice</C>: <C>speed</C>, <C>darkvision</C>, <C>resistances</C>,{" "}
          <C>spells</C> and a <C>summary</C>.
        </>,
      ],
      [
        "spells ?",
        <>
          <C>{"[{ spellId, minLevel, spellLevel }]"}</C>: spells granted by character level.
        </>,
      ],
      ["spellsTrait ?", "The name of the trait that grants these spells, shown on the sheet."],
      [
        "spellsUseChosenAbility ?",
        "True if the player chooses these spells' spellcasting ability (Intelligence, Wisdom or Charisma).",
      ],
      ["resistances ?", "Damage types the species resists."],
      [
        "skillGrant ?",
        <>
          <C>{"{ trait, count, from }"}</C>: skills to choose (<C>from</C>: a list or <C>"any"</C>).
        </>,
      ],
      [
        "traits",
        <>
          <C>{"[{ name, summary, uses?, mechanics? }]"}</C> — <C>uses</C>:{" "}
          <C>{'{ max, recharge: "short" | "long", shortFrom? }'}</C> (<C>max</C>: an amount, see{" "}
          <C>mechanics</C> under feats).
        </>,
      ],
      ["languages ?", "Languages granted on top of the base languages."],
      ["hitPointsPerLevel ?", "Extra hit points per level (“Dwarven Toughness”)."],
      [
        "originFeatGrant ?",
        <>
          <C>{'{ "trait": "Versatile" }'}</C>: an Origin feat to pick, named after this trait.
        </>,
      ],
      [
        "breathWeapon ?",
        <>
          <C>{'{ name, save: "dex", onSuccess: "half", baseDice, shapes }'}</C>: an area attack; its
          damage comes from <C>breathDamage</C> in the option picked (<C>lineages</C>).
        </>,
      ],
      ["powerfulBuild ?", "True: one size larger for the carrying capacity (“Powerful Build”)."],
      [
        "lineageTrait ?",
        <>
          The trait that presents every option of <C>choice</C>; the sheet replaces it with the
          option picked.
        </>,
      ],
    ],
    values: [
      ["Sizes", VALUES.sizes],
      ["Damage types", VALUES.damage],
      ["Languages", VALUES.languages],
      ["Skills", VALUES.skills],
    ],
  },
  backgrounds: {
    intro:
      "A background: its abilities, its skills, its tool, its origin feat and its starting equipment.",
    rows: [
      ["blurb", "One line (160 characters at most)."],
      ["imageUrl ?", "The address of an illustration, hosted by the pack's author."],
      [
        "abilityOptions",
        "Exactly three abilities, among which the player spreads +2/+1 or +1/+1/+1.",
      ],
      ["skillProficiencies ?", "Exactly two skills."],
      [
        "toolProficiency ?",
        <>
          <C>{"{ label, toolId }"}</C> for a specific tool, or <C>{"{ label, choice }"}</C> with{" "}
          <C>artisan</C>, <C>instrument</C> or <C>gaming</C> for a tool of choice.
        </>,
      ],
      ["originFeatId ?", "The origin feat: a feat of the pack or of the SRD (see “References”)."],
      [
        "startingKit ?",
        <>
          <C>{"{ items, gold, choices? }"}</C> — each item: <C>{"{ kind, id }"}</C> (<C>weapon</C>,{" "}
          <C>armor</C>, <C>tool</C>, <C>gear</C>, <C>pack</C>) or <C>{"{ kind, fromChoice }"}</C>{" "}
          for the item a background choice names. The “50 GP” option is added automatically.
        </>,
      ],
    ],
    values: [
      ["Abilities", VALUES.abilities],
      ["Skills", VALUES.skills],
    ],
  },
  subclasses: {
    intro: "A subclass for an SRD class, with its features by level.",
    rows: [
      ["classId", "The class it specializes."],
      ["blurb", "One line (160 characters at most)."],
      ["imageUrl ?", "The address of an illustration, hosted by the pack's author."],
      [
        "features",
        <>
          <C>{"[{ level, name, summary, uses?, mechanics? }]"}</C>: the features, at the class level
          they arrive, with their uses and effects (as for traits and feats).
        </>,
      ],
      [
        "spells ?",
        <>
          <C>{"[{ spellId, minLevel, spellLevel }]"}</C>: always-prepared spells, <C>minLevel</C>{" "}
          being the class level.
        </>,
      ],
      [
        "spellVariants ?",
        <>
          <C>{"{ label, hint?, options: [{ name, summary, spells }] }"}</C>: several lists to choose
          from (a land, an aspect…).
        </>,
      ],
    ],
    values: [["Classes", VALUES.classes]],
  },
  feats: {
    intro: "A feat: origin, fighting style, general or epic boon.",
    rows: [
      ["category", "Its category."],
      ["summary", "What it does, in your own words (600 characters at most)."],
      ["blurb ?", "A hook for the choice list."],
      ["minLevel ?", "Minimum level (4 for a general feat, 19 for a boon)."],
      ["prerequisite ?", "The rest of the prerequisite, shown without being checked."],
      ["repeatable ?", "Can be taken several times."],
      [
        "abilityIncrease ?",
        <>
          <C>{'{ options: ["str", "dex"] | "any", max? }'}</C>: its +1 ability increase. A single
          option applies automatically, several open a choice; cap 20, or 30 for a boon.
        </>,
      ],
      [
        "choices ?",
        <>
          <C>{"[{ id, kind, label, count, pool }]"}</C>: what the feat makes you choose. <C>pool</C>
          : <C>{'{ kind: "list", values }'}</C>, <C>{'{ kind: "any" }'}</C> or{" "}
          <C>{'{ kind: "group", group }'}</C>.
        </>,
      ],
      [
        "effects ?",
        <>
          What the engine computes: <C>hitPointsPerLevel</C>, <C>rangedAttackBonus</C>,{" "}
          <C>duelingDamageBonus</C>, <C>thrownDamageBonus</C>, <C>armoredAcBonus</C>,{" "}
          <C>unarmedDamageDice</C>, <C>heavyWeaponProficiencyDamage</C>, and <C>armorTraining</C> (
          <C>{'["light", "medium", "heavy", "shield"]'}</C>: the armour the feat trains the
          character in).
        </>,
      ],
      ["mechanics ?", <MechanicsHelp en />],
      ["combatNote ?", "A reminder shown in the sheet's combat block."],
      ["bonusAction ?", "A bonus action it adds, listed with the others."],
    ],
    values: [
      ["Categories", VALUES.featCategories],
      ["Abilities", VALUES.abilities],
      ["Choice kinds (choices.kind)", VALUES.choiceKinds],
    ],
  },
  spells: {
    intro: "A spell, for the classes that learn it.",
    rows: [
      ["level", "0 for a cantrip, 1 to 9 otherwise."],
      ["school", "Its school of magic."],
      ["classes", "The classes that have it on their list."],
      [
        "castingTime",
        <>
          <C>action</C>, <C>bonus</C>, <C>reaction</C>, or a text (“1 minute”).
        </>,
      ],
      ["range, duration", "Texts, as they read: “60 feet”, “1 minute”."],
      [
        "components",
        <>
          <C>{"{ v, s, m }"}</C>: true or false for each.
        </>,
      ],
      ["concentration, ritual", "True or false."],
      ["summary ?", "What it does, in your own words."],
      [
        "damage ?",
        <>
          <C>{"{ pool: { count, die }, kind, scaling?, step?, slotLevel? }"}</C>: its damage, and
          how it scales.
        </>,
      ],
      [
        "save ?",
        <>
          <C>{"{ ability, onSuccess }"}</C> — <C>onSuccess</C>: <C>negates</C>, <C>half</C> or{" "}
          <C>partial</C>.
        </>,
      ],
      ["attackRoll ?", "The spell calls for an attack roll."],
    ],
    values: [
      ["Schools", VALUES.schools],
      ["Classes", VALUES.classes],
      ["Damage types", VALUES.damage],
    ],
  },
  monsters: {
    intro: "A monster the GM can pick as an enemy: the enemy copies its numbers.",
    rows: [
      ["type, size", "Its type and size."],
      [
        "cr",
        <>
          Challenge rating as text: <C>"1/2"</C>, <C>"3"</C>…
        </>,
      ],
      ["armorClass, hitPoints", "Armor Class and hit points."],
      ["speed ?", "Speed in feet, 30 by default."],
      [
        "attacks ?",
        <>
          <C>
            {"[{ name, toHit, reach?, damage: { count, die }, damageBonus, damageKind, note? }]"}
          </C>
        </>,
      ],
      [
        "beast ?",
        <>
          <C>{"{ str, dex, con, climb?, swim?, fly? }"}</C>: for a beast a character turns into
          (Wild Shape) or calls (familiar).
        </>,
      ],
    ],
    values: [
      ["Types", VALUES.monsterTypes],
      ["Sizes", VALUES.sizes],
      ["Damage types", VALUES.damage],
    ],
  },
  invocations: {
    intro:
      "An Eldritch Invocation, for a class that learns them (invocationsKnown): its prerequisite, what it does, and what the sheet draws from it.",
    rows: [
      ["minLevel", "Class level required, 0 for none."],
      ["requires ?", "Another invocation to take first: its id in this pack, or the SRD's."],
      ["condition ?", "A prerequisite the sheet does not check, shown as a hint."],
      ["summary", "What it does, in a sentence or two (600 characters at most)."],
      ["repeatable ?", "True when it may be taken more than once."],
      [
        "cantrip ?",
        <>
          <C>"damage"</C> or <C>"attack"</C>: tied to one of the character's cantrips that deals
          damage or makes an attack roll.
        </>,
      ],
      [
        "spells ?",
        <>
          <C>{"[{ spellId, spellLevel }]"}</C>: spells cast without a slot, always prepared.
        </>,
      ],
      ["unarmoredAc ?", "AC without armour: this value + Dexterity."],
      ["darkvision ?, truesight ?", "Darkvision, truesight, in feet."],
      ["swimSpeed ?", "True: a swimming speed equal to the walking speed."],
    ],
  },
  weapons: {
    intro: "A weapon for the catalogue: the sheet attacks with these numbers.",
    rows: [
      ["category", "Category (see the values)."],
      ["priceCp", "Price in copper pieces (100 = 1 gp)."],
      ["weightKg ?", "Weight in kilograms."],
      [
        "damageDice ?, versatileDice ?",
        <>
          <C>{'{ "count": 1, "die": "d8" }'}</C>: damage, and two-handed for a versatile weapon.
        </>,
      ],
      ["damageType ?", "Damage type."],
      ["properties ?", "Properties (see the values)."],
      ["mastery ?", "Weapon mastery."],
      [
        "range ?",
        <>
          <C>{'{ "normal": 6, "max": 18 }'}</C>: range in metres, for a thrown or ammunition weapon.
        </>,
      ],
    ],
    values: [
      ["Categories", VALUES.weaponCategories],
      ["Properties", VALUES.weaponProperties],
      ["Masteries", VALUES.masteries],
      ["Damage types", VALUES.damageTypes],
    ],
  },
  armors: {
    intro: "A suit of armour or a shield: what it does to AC, Stealth and Speed.",
    rows: [
      ["category", "Category (see the values)."],
      ["priceCp, weightKg", "Price in copper pieces, weight in kilograms."],
      ["baseAc ?", "Body armour's base AC."],
      ["acBonus ?", "A shield's AC bonus."],
      ["addsDex, maxDex ?", "Whether Dexterity is added, and up to how much."],
      ["strengthMin ?", "Minimum Strength; below it, Speed drops by 10 feet."],
      ["stealthDisadvantage ?", "Disadvantage on Stealth checks."],
      ["description ?", "What the piece is, in a line."],
    ],
    values: [["Categories", VALUES.armorCategories]],
  },
  gear: {
    intro: "Adventuring gear.",
    rows: [
      ["priceCp, weightKg ?", "Price in copper pieces, weight in kilograms."],
      [
        "group ?",
        <>
          A grouping for the list (<C>"ammunition"</C>, <C>"focus"</C>…).
        </>,
      ],
      ["description ?", "What it is for, in a line."],
    ],
  },
  equipmentPacks: {
    intro: "A bundle of gear sold together.",
    rows: [
      ["priceCp", "Price in copper pieces."],
      [
        "contents",
        <>
          <C>{"[{ gearId, qty }]"}</C>: gear of this pack or of the SRD.
        </>,
      ],
    ],
  },
  languages: {
    intro:
      "A language characters can speak. The pack's species and classes grant it by its id; other languages are picked from the list.",
    rows: [
      [
        "kind",
        <>
          <C>"standard"</C> (offered to everyone) or <C>"rare"</C>.
        </>,
      ],
      ["summary", "Who speaks it, and where you hear it (300 characters at most)."],
    ],
  },
  tools: {
    intro: "A tool that joins the catalog: gaming set, instrument, artisan's tools…",
    rows: [
      ["category", "Its family: a background's “tool of choice” offers the tools of its family."],
      ["ability", "The ability its checks use."],
      ["priceCp", "Price in copper pieces (100 = 1 GP)."],
      ["weightKg", "Weight in kilograms."],
      ["description ?", "One line."],
    ],
    values: [
      ["Families", VALUES.toolCategories],
      ["Abilities", VALUES.abilities],
    ],
  },
});

/** The guide in the reader's language — built on each read so its value labels follow too. */
// eslint-disable-next-line react-refresh/only-export-components -- data module, no state to refresh
export const KIND_GUIDE: Record<PackContentKind, KindGuide> = Object.defineProperties(
  {} as Record<PackContentKind, KindGuide>,
  Object.fromEntries(
    PACK_CONTENT_KINDS.map((kind) => [
      kind,
      {
        enumerable: true,
        get: () => (currentLanguage() === "en" ? KIND_GUIDE_EN() : KIND_GUIDE_FR())[kind],
      },
    ]),
  ),
);
