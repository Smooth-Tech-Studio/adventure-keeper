# Packs de contenu — format `ak-pack/1`

Un pack ajoute du contenu **par-dessus le SRD 5.2.1** : classes, espèces,
historiques, sous-classes, dons, sorts, monstres, manifestations occultes,
langues, outils, armes, armures, matériel et paquetages. Il n'en remplace ni
n'en retire jamais. C'est un simple fichier JSON, qu'on importe et qu'on
exporte tel quel.

Le SRD lui-même est écrit dans ce format : c'est le **pack de base**, chargé
d'office (voir [Le SRD, pack de base](#le-srd-pack-de-base)).

Exemple complet (contenu inventé) :
[`packages/system-dnd2024/src/packs/fixtures/brumes-du-nord.json`](../packages/system-dnd2024/src/packs/fixtures/brumes-du-nord.json).

## Structure

```jsonc
{
  "format": "ak-pack/1", // obligatoire, tel quel
  "system": "dnd2024", // obligatoire, tel quel
  "id": "brumes-du-nord", // identifiant du pack (minuscules, chiffres, tirets)
  "name": "Les Brumes du Nord",
  "version": "1.0.0", // facultatif, 1.0.0 par défaut
  "description": "…", // facultatif
  "author": "…", // facultatif
  "language": "fr", // facultatif : la langue du pack, "fr" (par défaut) ou "en"
  "translations": {}, // facultatif : le pack dans d'autres langues (voir plus bas)
  "content": {
    "classes": [],
    "species": [],
    "backgrounds": [],
    "subclasses": [],
    "feats": [],
    "spells": [],
    "monsters": [],
    "invocations": [],
    "languages": [],
    "tools": [],
    "weapons": [],
    "armors": [],
    "gear": [],
    "equipmentPacks": [],
  },
}
```

Chaque liste de `content` est facultative. Les champs de chaque entrée reprennent
ceux du moteur (`ClassDef`, `SpeciesDef`, `BackgroundDef`, `SubclassDef`,
`FeatDef`, `SpellDef`, `MonsterDef`, `InvocationDef`, `LanguageDef`, `ToolDef`,
`WeaponDef`, `ArmorDef`, `GearDef`, `EquipmentPackDef`). Une entrée porte tout
ce qui la concerne :

- une **classe** : ses chiffres (dé de vie, sauvegardes, compétences,
  formations), ce qu'elle active dans le moteur (`spellcasting`,
  `invocationsKnown`, `wildShapeFrom`, `martialArts`, `expertise`…), ses tables
  (`cantripsKnown`, `preparedSpells`, `weaponMastery`, `asiLevels`,
  `fightingStyleLevel`, `languages`, `subclassLabel`), ses sorts toujours
  préparés (`spells`), ses paquetages (`startingEquipment: { options: [{ id,
label?, items, gold, choices? }] }` — une option sans `label` est l'or seul),
  ses « au choix » (`options`) et ses aptitudes (`features: [{ level, name,
summary, uses?, mechanics?, roll? }]`). Ses sous-classes et les sorts du pack
  la nomment par son identifiant ;
- une **espèce** : ses traits (`traits: [{ name, summary, uses?, mechanics?,
roll? }]`), ses langues (`languages`), et ce qu'elle fait au-delà
  (`hitPointsPerLevel`, `originFeatGrant`, `breathWeapon` — ses dégâts viennent
  du `breathDamage` de l'option choisie —, `powerfulBuild`, `lineageTrait`) ;
- un **historique** : son paquetage de départ (`startingKit: { items, gold,
choices? }`) ; un objet tiré d'un choix de l'historique s'écrit
  `{ "kind": "tool", "fromChoice": "tool" }`. L'option « 50 po » est ajoutée
  d'office ;
- un **don** : son rappel en combat (`combatNote`), son action bonus
  (`bonusAction`) et son +1 en caractéristique (`abilityIncrease: { options:
["str", "dex"] | "any", max? }` — plafond 20, ou 30 pour une faveur épique ;
  une seule option s'applique d'office, plusieurs ouvrent un choix) ; ses
  choix n'ont ni `source` ni `via` ;
- une **sous-classe** : ses sorts toujours préparés (`spells: [{ spellId,
minLevel, spellLevel }]`, `minLevel` = niveau de classe), ou plusieurs listes
  au choix (`spellVariants: { label, hint?, options: [{ name, summary, spells
}] }`) ;
- un **monstre** : ses attaques (`attacks`) et, pour une bête, ses valeurs de
  forme sauvage et de familier (`beast: { str, dex, con, climb?, swim?, fly?
}`). Le MJ le trouve dans le sélecteur
  « Depuis un monstre » des ennemis, marqué du nom du pack, dès que le pack est
  autorisé dans la campagne (ou dans sa bibliothèque) ; l'ennemi en copie les
  chiffres, le pack n'est plus nécessaire ensuite ;
- un **outil** (`tools`) : `name`, `category` (`gaming`, `instrument`,
  `artisan`…), `ability`, `priceCp`, `weightKg`, `description?`. Il rejoint le
  catalogue d'outils de l'app : choix « un jeu au choix », paquetages, ajout à
  l'inventaire, maîtrises. Un historique peut y renvoyer (`toolProficiency.toolId`,
  objets de `startingKit`) ;
- une **arme**, une **armure**, du **matériel**, un **paquetage**
  (`weapons`, `armors`, `gear`, `equipmentPacks`) : ils rejoignent les
  catalogues de l'app. Un paquetage de classe ou d'historique peut viser ceux du
  pack, et un paquetage (`contents: [{ gearId, qty }]`) du matériel du pack ou
  du SRD ;
- une **manifestation occulte** (`invocations`), pour une classe qui en
  apprend : prérequis (`minLevel`, `requires`, `condition`), sort mineur lié
  (`cantrip`), sorts accordés, CA sans armure, visions, nage ;
- une **langue** (`languages` : `name`, `kind` — `standard` ou `rare` —,
  `summary`), qu'une espèce ou une classe du pack donne par son identifiant ;
- une **classe, espèce, historique ou sous-classe** peut porter une
  illustration (`imageUrl`), hébergée par l'auteur du pack : l'assistant
  l'affiche à la place du carré teinté.

Le schéma qui fait foi : [`packs/schema.ts`](../packages/system-dnd2024/src/packs/schema.ts).

## Effets des capacités (`mechanics`, `uses`)

Un trait d'espèce, une aptitude de sous-classe et un don peuvent dire ce qu'ils
**font** à la fiche, au même format que les capacités du SRD
([`mechanics.ts`](../packages/system-dnd2024/src/mechanics.ts)) :

```jsonc
"features": [
  {
    "level": 3,
    "name": "Peau de pierre",
    "summary": "…",
    "uses": { "max": { "ability": "con", "min": 1 }, "recharge": "long" },
    "mechanics": [
      { "type": "unarmoredDefense", "ability": "con", "shield": true },
      { "type": "speed", "bonus": 10, "when": "noHeavyArmor" },
      { "type": "advantage", "on": "save", "abilities": ["str"] },
      { "type": "resistance", "damage": ["poison"], "minLevel": 6 }
    ]
  }
]
```

| `type`              | Champs                                                                                             | Effet                                                                            |
| ------------------- | -------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `unarmoredDefense`  | `ability`, `shield`                                                                                | CA 10 + Dex + `ability` sans armure (`shield: false` : sans bouclier non plus)   |
| `speed`             | `bonus`, `when?`                                                                                   | Vitesse en plus (pieds)                                                          |
| `movement`          | `mode` (`climb`, `swim`, `fly`), `feet?`, `when?`                                                  | Escalade / nage / vol (sans `feet` : la vitesse)                                 |
| `initiative`        | `bonus?`, `advantage?`                                                                             | Bonus ou avantage à l'initiative                                                 |
| `saveProficiency`   | `abilities` (liste ou `"all"`)                                                                     | Maîtrise de jets de sauvegarde                                                   |
| `saveBonus`         | `bonus`, `abilities?`                                                                              | Bonus aux jets de sauvegarde                                                     |
| `checkBonus`        | `bonus`, `skills?`, `unproficientOnly?`                                                            | Bonus aux tests (Touche-à-tout : `unproficientOnly`)                             |
| `advantage`         | `on` (`save`, `check`, `attack`, `initiative`, `deathSave`), `abilities?`, `skills?`, `condition?` | Avantage, coché d'office par la feuille de jet ; avec `condition`, simple rappel |
| `armorTraining`     | `categories`                                                                                       | Formation aux armures                                                            |
| `martialWeapons`    | —                                                                                                  | Maîtrise des armes de guerre                                                     |
| `hitPointsPerLevel` | `value`                                                                                            | PV max par niveau                                                                |
| `abilityScore`      | `abilities`, `bonus`, `max`                                                                        | Caractéristiques augmentées au-delà de 20                                        |
| `resistance`        | `damage`                                                                                           | Résistances                                                                      |
| `sense`             | `sense` (`darkvision`, `blindsight`, `truesight`, `tremorsense`), `feet`                           | Sens spéciaux                                                                    |
| `extraCantrips`     | `count`                                                                                            | Sorts mineurs en plus de la table de classe                                      |
| `critRange`         | `min`                                                                                              | Coup critique dès ce résultat (19, 18…)                                          |
| `damageBonus`       | `bonus`, `on` (`cantrip`, `spell`, `weapon`, `unarmed`), `school?`                                 | Bonus de dégâts ajouté par la feuille de jet                                     |
| `note`              | `text`                                                                                             | Rappel dans le bloc de combat                                                    |

Chaque effet accepte `minLevel` (niveau de classe pour une aptitude de
sous-classe). `when` : `unarmored` (sans armure), `unarmoredNoShield` (sans
armure ni bouclier), `noHeavyArmor` (sans armure lourde). Une **quantité**
(`bonus`, `uses.max`) est un nombre, `"prof"`, `"halfProf"`, `"level"`,
`{ "ability": "wis", "min": 1 }`, `{ "perLevel": 5 }` (5 × le niveau) ou
`{ "byLevel": [[2, 10], [6, 15]] }` (10 dès le niveau 2, 15 dès le 6).
`uses.shortFrom` : niveau à partir duquel une capacité « repos long » revient
aussi au repos court.

L'inventaire de ce que le SRD applique, et de ce qui reste à faire :
[`FEATURE_EFFECTS.md`](FEATURE_EFFECTS.md).

## Traductions

Un pack se lit en plusieurs langues sans être dupliqué. `language` dit dans
quelle langue il est écrit ; `translations` donne, par autre langue, ses
**textes** traduits — la même forme que les entrées, rangées par identifiant :

```jsonc
"language": "fr",
"translations": {
  "en": {
    "name": "The Northern Mists", // aussi "description", "author"
    "content": {
      "feats": { "tireur-des-brumes": { "name": "Mist Archer", "summary": "…" } },
      "species": {
        "sylvain-des-brumes": {
          "choice": { "label": "Mist lineage", "options": ["Light Mist", "Dense Mist"] },
          "lineages": { "Brume dense": { "summary": "…" } },
          "traits": [{ "name": "Soft Step", "summary": "…" }]
        }
      }
    }
  }
}
```

- Les listes se suivent par position (`traits`, `features`, `attacks`,
  `choices`), les lignées par le nom de l'option source. Un texte absent reste
  dans la langue du pack.
- Seuls les textes se traduisent (schémas `pack*ShadowSchema` de
  [`packs/translations.ts`](../packages/system-dnd2024/src/packs/translations.ts)) ;
  un identifiant, un nombre ou une valeur dans une traduction est refusé comme
  champ inconnu. La validation refuse aussi une entrée inconnue, un texte sans
  équivalent dans le pack, et une traduction dans la langue du pack.
- Les **options d'espèce** et les **variantes de sorts** sont des valeurs
  enregistrées sur la fiche : elles gardent leur nom ; leur traduction
  (`choice.options`, `spellVariants.options[].name`) n'est qu'un libellé
  d'affichage (`speciesOptionLabel`, `subclassSpellVariantLabel`).
- Côté moteur, `createContentOverlay` pose les traductions sur une **copie** des
  définitions (getters qui suivent `setLocale`, la langue du pack comme base) :
  le pack lui-même — ce qu'on exporte et ce qu'une fiche garde — ne change pas.
  `extractUsedContent` ne garde que les traductions des entrées retenues ;
  `mergeContentPacks` les fusionne avec les entrées.
- Côté app : `packText` (nom, description, auteur), `translatedPackContent`
  (page de contenu), et le badge de langue n'apparaît que si le lecteur ne
  trouve pas sa langue dans `packLanguages(pack)`.

## Identifiants et références

- Dans le fichier, chaque entrée a un identifiant court : `"voie-du-zelateur"`.
- Une fois chargé, il devient **`"<pack>:<identifiant>"`** :
  `"brumes-du-nord:voie-du-zelateur"`. Deux packs ne peuvent donc jamais entrer
  en collision, ni avec le SRD.
- Une **référence** (le don d'origine d'un historique, le sort d'une lignée) se
  résout ainsi :
  - un identifiant défini **dans le même pack** pointe vers cette entrée ;
  - un identifiant complet `"autre-pack:x"` est gardé tel quel ;
  - sinon, c'est un identifiant **SRD** (`"alert"`, `"misty-step"`).

## Validation

`parseContentPack` / `parseContentPackJson` ne lèvent jamais d'exception : ils
renvoient soit le pack validé, soit une liste d'erreurs en français qui nomment
l'entrée et le champ :

```
Sous-classe n°1 « Gardien des brumes » › classId : aucune classe « artificer », ni dans ce pack ni dans le SRD
Don : l'identifiant « endurci-par-le-froid » est utilisé deux fois.
Historique « Veilleur » › originFeatId : aucun don « inexistant », ni dans ce pack ni dans le SRD.
```

Les références vers **un autre pack** ne sont vérifiables qu'une fois ce pack
chargé ; elles ne sont pas contrôlées à l'import.

Un **champ inconnu** (souvent une faute de frappe sur un champ facultatif) est
refusé à l'import :

```
Don n°2 « Pas de loup » › combatNotes : champ(s) inconnu(s) : combatNotes
```

Cette rigueur ne vaut qu'à l'import (`parseContentPack`). Les packs déjà en base
sont relus par le même schéma, qui se contente d'ignorer ces champs : resserrer
le format ne casse donc aucun pack existant.

## Côté moteur

- `createContentOverlay(packs)` convertit des packs validés en un « calque »
  (identifiants préfixés, références résolues).
- Les fonctions de lecture du moteur (`getClass`, `getSpecies`,
  `getBackground`, `getFeat`, `getSubclass`, `subclassesFor`,
  `featsOfCategory`, `classFeatures`, `speciesFeatures`, `getMonster`,
  `getInvocation`, `getLanguage`, et `allClasses` / `allSpecies` /
  `allBackgrounds` / `allMonsters` / `allInvocations` / `allLanguages`)
  consultent d'abord le calque **actif**, puis le SRD. Chaque table indexée par
  classe lit la classe (`getClass(id)?.preparedSpells`…) : une classe de pack
  vaut une classe du SRD.
- Le calque actif se choisit de deux façons :
  - `withContent(calque, () => …)` le temps d'un calcul (le moteur est
    synchrone, l'état précédent est toujours restauré) ;
  - `setActiveContent(calque)` comme défaut pour l'écran affiché.
- `computeCharacterDerived(input, { content })` calcule une fiche avec un calque
  donné (`null` = SRD seul).

Les sorts des packs sont dans `calque.spells` : le catalogue de sorts vit dans
l'app web (`spells.json`), c'est elle qui les fusionnera.

## Stockage et partage (lot 2)

- **Bibliothèque** — `contentPacks/{docId}` : le pack validé entier dans `pack`,
  plus `ownerId`, `packId`, `name`, `version`, `entryCount`. Un joueur a au plus
  un pack par identifiant ; réimporter le même identifiant **remplace** le pack
  (`replacePack`), et l'identifiant ne peut pas changer. 900 Ko au maximum.
- **Partage** — par e-mail (le propriétaire ajoute le compte à `sharedWith`) ou
  par lien (`linkSharing` : toute personne connectée qui a le lien peut lire le
  pack et s'ajouter elle-même à `sharedWith`). Un destinataire peut se retirer.
- **Campagne** — le MJ **recopie** un pack dans
  `campaigns/{id}/packs/{packId}` pour l'autoriser. Les joueurs lisent cette
  copie sans accès à la bibliothèque du propriétaire ; l'identifiant du document
  étant celui du pack, deux packs au même identifiant ne peuvent pas cohabiter
  dans une campagne. Réactiver rafraîchit la copie.
- **Fiche** — un personnage garde dans `packContent` **seulement** les entrées
  de pack qu'il utilise (`extractUsedContent`), et sa fiche se calcule à partir
  de cette copie : modifier, supprimer ou ne plus partager le pack ne la change
  pas. Le schéma des personnages accepte désormais une espèce ou un historique
  `"pack:x"`.

Fonctions côté app : [`apps/web/src/systems/dnd2024/lib/packs.ts`](../apps/web/src/systems/dnd2024/lib/packs.ts).

## Interface (lot 3)

- **Fournisseur de contenu** (`systems/dnd2024/hooks/use-content-packs.tsx`) : charge la
  bibliothèque du joueur (ses packs + ceux partagés) et y ajoute ce que l'écran
  affiché enregistre avec `useRegisterPacks` — la copie d'une fiche, les packs
  d'une campagne. Les copies d'un même pack sont fusionnées
  (`mergeContentPacks`, la bibliothèque d'abord) et le calque est installé avec
  `setActiveContent`. Un composant qui affiche du contenu de pack lit
  `useContentPacks()` pour se re-rendre quand il change.
- **Pages** : `/packs` (importer, exporter, remplacer, partager, supprimer ;
  packs partagés avec moi) et `/packs/shared/:id` (arrivée d'un lien de partage).
- **Campagne** : carte « Packs autorisés » (MJ : autoriser, mettre à jour,
  retirer ; joueurs : liste + « Créer un personnage avec ces packs », qui ouvre
  la création avec `?campaign=`). Les membres dont la fiche utilise un pack non
  autorisé sont signalés au MJ.
- **Création** : espèces et historiques des packs dans les listes, avec
  « Pack · nom » ; sous-classes, dons et sorts passent par les lectures du
  moteur. À chaque enregistrement, `packContent` est recalculé depuis les packs
  actifs et l'ancienne copie.

## Contenu hors SRD sorti du code (lot 4)

Le 8 octobre 2026, tout ce que le code contenait hors SRD 5.2.1 en est sorti :
l'Aasimar, 12 historiques, 36 sous-classes, 58 dons, 30 sorts, 6 monstres (et
2 jeux du catalogue d'outils). Ce contenu a été extrait **avant** la suppression
dans un pack `dnd-hors-srd` (« Contenu hors SRD »), puis vérifié : une fiche se
calcule à l'identique à travers le pack (109 cas comparés).

- **Le fichier n'est pas dans le dépôt** et ne doit pas y entrer : le site ne
  publie que le SRD. Il est gardé hors du dépôt, importé par une table qui
  possède le livre, partagé avec ses joueurs et autorisé dans ses campagnes.
- **Identifiants** : une entrée garde son identifiant, préfixé `dnd-hors-srd:`
  (`dnd-hors-srd:aasimar`). Seules les sous-classes changent de forme :
  `druid:cercle-de-la-lune` devient `dnd-hors-srd:druid-cercle-de-la-lune`.

## Pas encore fait

- Packs **publics**, avec un bouton de signalement.

## Le SRD, pack de base

Le contenu du SRD 5.2.1 n'est plus dans le code : il est écrit au format des
packs dans [`packages/system-dnd2024/src/srd`](../packages/system-dnd2024/src/srd),
un fichier par type d'entrée (`classes.json`, `species.json`…), chacun sous la
forme `{ "entries": [...], "translations": { "en": {...} } }`.

- Les modules du moteur lisent ces fichiers au chargement : le SRD est toujours
  là, on ne le désactive pas. Ses identifiants restent courts (`"barbarian"`),
  comme les fiches les stockent ; ceux des sous-classes sont recomposés
  (`"<classe>:<slug>"`).
- Les gros catalogues (sorts, armes, armures, outils, matériel, paquetages) se
  chargent à la demande, par `SRD_CATALOGS` ; le découpage de Vite les garde
  hors du bloc chargé au démarrage.
- [`srd/pack.ts`](../packages/system-dnd2024/src/srd/pack.ts) les assemble en un
  pack `ak-pack/1` (`SRD_PACK`, avec l'attribution CC-BY-4.0 en description) ;
  un test le fait passer par `parseContentPack`, comme n'importe quel fichier
  d'utilisateur.
- Restent dans le code, comme **règles** et non comme contenu : l'historique
  personnalisé (la conception d'historique), les effets qui dépendent du
  contexte de quelques manifestations occultes (rappels selon l'emplacement,
  jets), la forme sauvage et le familier, et les anciens noms de lignées
  (`LINEAGE_ALIASES`), gardés pour les fiches enregistrées.
