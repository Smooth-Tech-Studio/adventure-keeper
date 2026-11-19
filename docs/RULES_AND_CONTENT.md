# Règles et contenu — plan

Plan établi le 11 novembre 2026, **terminé le 19 novembre 2026** (lots 1 à 4,
branche `chore/depot-public`). Les suites (packs publics, systèmes de règles des MJ) sont dans les [tickets](https://github.com/Smooth-Tech-Studio/adventure-keeper/issues).

## Objectif

Garder la 5e 2024 comme système de l'application, avec sa fiche, son assistant
et sa session sur mesure, mais séparer nettement trois choses :

- **l'application**, qui ne connaît plus 5e qu'à travers une interface ;
- **les règles essentielles**, c'est-à-dire le moteur : du code ;
- **le contenu**, c'est-à-dire le SRD et les packs : des données.

## Décisions (2026-11-11)

- **Le système actuel est conservé.** 5e 2024 reste codé, avec un rendu sur
  mesure. Le format de système générique est mis de côté
  ([`RULE_SYSTEMS.md`](RULE_SYSTEMS.md)).
- **Une frontière** est posée entre l'application et le système.
- **Le SRD devient le pack de base** : tout le contenu sort du code.
- **Les packs des utilisateurs peuvent ajouter des classes**, avec leurs
  capacités, leurs effets et leurs réglages.
- **Un pack ne modifie pas les règles de base.** Il ajoute des entrées, il ne
  remplace ni ne retire une entrée du SRD, et ne touche pas au moteur.
- **Ennemis, états, butin et packs restent façonnés par la 5e** (2026-11-13).
  Ces fonctionnalités gardent six caractéristiques, les états et les cinq
  monnaies de la 5e, et lisent `systems/dnd2024/vocabulary.ts`. Les rendre
  indépendantes d'un jeu sort de ce plan.
- **`packages/schemas` garde sa dépendance au paquet 5e** (2026-11-13) : les
  documents stockés ont une forme 5e. Seul `localized`, sans rapport avec les
  règles, en sort.
- **Une campagne 5e a toujours le pack de base.** Il est chargé d'office et
  ne se désactive pas ; les packs s'y ajoutent.
- **Le format reste `ak-pack/1`.** Les nouveaux types d'entrées sont des
  ajouts facultatifs ; les packs existants restent valides sans conversion.
- **Les illustrations sont fournies par l'auteur du pack.** Aujourd'hui
  aucune entrée n'a d'illustration : l'assistant affiche un carré teinté avec
  l'initiale (`creation-wizard/entity-art.tsx`), et le format des packs n'a
  pas de champ image. Les classes, espèces, historiques et sous-classes
  reçoivent un champ `imageUrl` facultatif. Sans lui, l'affichage actuel
  reste.
- **Rémi fournira les illustrations du pack de base.** Tant qu'une entrée du
  SRD n'en a pas, elle garde le carré teinté.

## Où va chaque chose

### Trois couches

| Couche      | Ce qu'elle contient                                                                                                                                                                                       | Forme                                    |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| Moteur      | Ce qu'est une CA, une initiative, un jet de sauvegarde, un emplacement de sort ; comment les effets s'additionnent ; les règles propres à une mécanique (lancement de sorts, forme sauvage, invocations). | Code, dans `packages/system-dnd2024`     |
| Contenu     | Chaque classe, espèce, capacité, don, sort, objet : son texte, ses chiffres, et **ce qu'elle change sur la fiche**.                                                                                       | Données, dans le pack de base ou un pack |
| Application | Écrans, stockage, session. Elle demande au moteur une fiche calculée, des choix ouverts, des jets.                                                                                                        | Code, dans `apps/web`                    |

### Les capacités qui changent une valeur

Elles sont déjà du contenu. Une capacité porte une liste d'effets
(`mechanics`), ses utilisations par repos (`uses`) et son jet (`roll`). Le
moteur les applique sans savoir de quelle capacité il s'agit
(`collectMechanics` puis `resolveMechanics`).

```json
{
  "name": "Défense sans armure",
  "mechanics": [{ "type": "unarmoredDefense", "ability": "con", "shield": true }]
}
```

Ces effets étaient rangés à part du texte des capacités, dans
`feature-rules.ts`, par identifiant (`"barbarian:1:Défense sans armure"`).
Depuis le lot 3, ils sont **sur la capacité elle-même**, dans le pack de base,
comme dans les packs.

Le vocabulaire actuel compte 16 types d'effets
([`mechanics.ts`](../packages/system-dnd2024/src/mechanics.ts)) : défense
sans armure, vitesse, déplacement, initiative, maîtrise et bonus de
sauvegarde, bonus de test, avantage, formation aux armures, armes de guerre,
points de vie par niveau, valeur de caractéristique, résistance, sens, sorts
mineurs en plus, plage de critique. S'y ajoutent les bonus de dégâts et les
rappels.

### Les cas particuliers

Quand une capacité ne rentre pas dans ce vocabulaire, on applique cette
règle, dans l'ordre :

1. **Un type d'effet existant suffit** : on l'écrit dans le contenu. Rien à
   coder.
2. **C'est calculable et d'autres capacités en auront besoin** : on ajoute un
   type d'effet au moteur. Il devient disponible pour tous les packs.
3. **C'est une mécanique entière** (lancement de sorts, forme sauvage,
   invocations, arts martiaux, bottes d'arme) : c'est un **module du
   moteur**, et le contenu dit qui l'utilise et avec quels chiffres. La
   classe porte un réglage, le moteur ne teste plus son nom.
4. **Ça dépend de ce que l'application ne suit pas** (position, alliés,
   durée, cible) : un rappel textuel (`note`), comme aujourd'hui.

Exemple du point 3. Le moteur teste aujourd'hui le nom de la classe :

```ts
if (classId === "rogue") return level >= 6 ? 4 : 2;
if (classId === "bard" && level >= 2) return level >= 9 ? 4 : 2;
```

Après, la classe le déclare et le moteur lit :

```json
{ "id": "rogue", "expertise": { "byLevel": [[1, 2], [6, 4]] } }
{ "id": "bard", "expertise": { "byLevel": [[2, 2], [9, 4]] } }
```

Une classe ajoutée par un pack obtient ainsi l'expertise sans toucher au
code.

### Ce qui testait le nom d'une classe

18 endroits, remplacés au lot 2 par un réglage de la classe (`ClassDef` dans
[`classes.ts`](../packages/system-dnd2024/src/classes.ts) : `spellcasting`,
`expertise`, `toolExpertise`, `martialArts`, `wildShapeFrom`,
`invocationsKnown`, `bonusSkill`) :

| Mécanique                             | Classes testées             | Fichiers                                                                                                                                                          |
| ------------------------------------- | --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Progression des emplacements de sorts | paladin, rôdeur, occultiste | `spellcasting.ts`                                                                                                                                                 |
| Invocations occultes                  | occultiste                  | `invocations.ts`, `character-rules.ts`, `granted-spells.ts`, `resolve-choices.ts`, et côté web `character-form/state.ts`, `spell-substeps.tsx`, `roll-sources.ts` |
| Expertise                             | roublard, barde             | `classes.ts`, et côté web `tool-proficiency-list.tsx`                                                                                                             |
| Arts martiaux                         | moine                       | `classes.ts`                                                                                                                                                      |
| Forme sauvage                         | druide                      | `beasts.ts`                                                                                                                                                       |
| Choix propre au barbare               | barbare                     | `resolve-choices.ts`                                                                                                                                              |

L'inventaire de ce que chaque capacité applique ou laisse en rappel reste
[`FEATURE_EFFECTS.md`](FEATURE_EFFECTS.md).

## État de départ (11 novembre 2026)

- **Le moteur et le contenu sont mêlés** dans `packages/system-dnd2024` :
  `classes.ts`, `species.ts`, `feats.ts`, `subclasses.ts`, `monsters.ts`…
  contiennent à la fois les types, les règles et les entrées du SRD.
- **Une partie du contenu est dans l'application** : `apps/web/src/data`
  (sorts, armes, armures, outils, équipement, environ 6 700 lignes de JSON).
- **Les packs couvrent sept types d'entrées** : espèces, historiques,
  sous-classes, dons, sorts, monstres, outils. Pas les classes, ni les armes,
  les armures, l'équipement, les langues.
- **La liste des classes est fermée** : `CLASS_IDS` est une énumération de 12
  valeurs, et `classId` sur la fiche n'accepte qu'elles.
- **L'application importe le paquet partout** : une centaine de fichiers dans
  `apps/web`, 15 dans `packages/schemas`, et des tests
  `system === "dnd2024"` dans les pages.

## Lots

### Lot 1 — La frontière

- Définir l'interface que l'application consomme : fiche calculée, choix
  ouverts, étapes de création, jets, valeurs suivies en session, libellés.
- Regrouper les accès au paquet 5e derrière cette interface.
- Remplacer les tests `system === "dnd2024"` par des questions posées au
  système (« a-t-il un assistant ? », « quelle licence afficher ? »).
- Sortir de `packages/schemas` ce qui vient de la 5e (`localized`,
  `conditionSchema`, `creatureSizeSchema`…) ou le faire passer par
  l'interface.

Critère de sortie : une règle de lint interdit d'importer `system-dnd2024`
hors du dossier de l'adaptateur. Aucun changement visible, tests de bout en
bout verts.

Avancement (2026-11-13) : **le lot est terminé.** Plus aucun écran générique
ne teste le système ni ne nomme 5e. Les 80 scénarios de bout en bout sont
verts. 40 captures (session du joueur et du MJ, fiche, liste, création,
campagne, aventure ; téléphone et ordinateur) ont été comparées entre le
commit d'avant le lot et la fin du lot : identiques, à deux réserves près qui
ne viennent pas du lot — l'ordre des participants, qui varie d'une exécution
à l'autre, et une centaine de pixels d'ombre décalés d'un niveau sur 255.

Comment c'est rangé :

- [`apps/web/src/systems`](../apps/web/src/systems) — ce que l'application
  demande à un système. `RulesSystem` (`types.ts`) répond aux questions :
  nom, licence, packs, sous-titre d'un personnage, valeurs de combat,
  compagnons, personnalité, expérience, et ce qu'une fiche stocke (copie des
  entrées de pack, valeurs calculées, champs à effacer, parties modifiables en
  session). `SystemScreens` (`screen-types.ts`) fournit les écrans : fiche,
  fiche éditable par son propriétaire, écran d'édition, éléments de la carte
  « Mes personnages ». `SystemCreation` décrit la création : titre, étapes,
  création guidée ou formulaire, possible sans compte, et son écran. `PlayerPanel`
  donne ce que le personnage montre dans la session de son joueur ; la vue de
  session garde la mise en page. Le nom `GameSystem` est déjà pris par le système de jeu
  d'une campagne (`dnd5e`, `custom`…).
- `systems/dnd2024` — tout le code qui connaît la 5e : assistant, montée de
  niveau, éditeur, fiche, panneau du joueur en session, packs, et les modules
  `lib/` et `hooks/` qui lisent les règles. C'est le seul dossier qui importe
  le paquet `@adventure-keeper/system-dnd2024`.
- `systems/dnd2024/vocabulary.ts` — ce que les fonctionnalités façonnées par
  5e sans porter sur une fiche (ennemis, états, tailles, monnaies) lisent du
  paquet : 32 valeurs et 8 types, listés un par un.
- `systems/standard.ts`, `systems/standard-screens.tsx` — la fiche libre.

Deux règles de lint tiennent la frontière (`eslint.config.mjs`) :

1. Le paquet 5e ne s'importe que depuis `systems/dnd2024`. Aucune exception.
2. Le dossier `systems/dnd2024` ne s'importe pas depuis le reste de
   l'application. Les 37 fichiers qui le font encore sont listés dans
   [`eslint.system-boundary.mjs`](../eslint.system-boundary.mjs) : on en
   retire, on n'en ajoute pas.

Ce que contient encore cette liste, et qui y reste par décision :

- **Les fonctionnalités façonnées par la 5e** : ennemis et monstres (6 fichiers
  de `components/adventure`), états et tailles en session, butin et bourse,
  packs d'une campagne. Elles lisent `vocabulary.ts` ou un module du dossier
  5e. Les décrire par le système revient à décider ce qu'est un ennemi ou
  une bourse hors de la 5e : ce n'est pas l'objet de ce plan.
- **`GuidedRail`**, générique, vit encore dans le fichier du rail de
  l'assistant 5e (`creation-wizard/wizard-rail.tsx`).

`packages/schemas` garde sa dépendance au paquet 5e pour la forme des
documents stockés (décision du 13 novembre). `localized` et les autres
utilitaires de langue en sont sortis : ils vivent dans un troisième paquet,
[`packages/locale`](../packages/locale) (`@adventure-keeper/locale`), que
`schemas` et le paquet 5e importent tous deux. Le paquet 5e le réexporte,
donc son code et l'application gardent leurs imports.

Conséquence : les scripts qui chargent les règles depuis les sources (seed,
migration des packs, export des catalogues, tests de bout en bout)
compilent d'abord ce petit paquet. Les commandes `pnpm` correspondantes le
font seules (`build:locale`).

### Lot 2 — Des classes décrites en données

- Remplacer les 18 tests sur le nom d'une classe par des réglages portés par
  la classe (voir le tableau plus haut).
- Ouvrir `classId` : il accepte un identifiant de pack, comme `speciesId` et
  `backgroundId` le font déjà.
- Ranger les effets de `feature-rules.ts` sur les capacités elles-mêmes.

Critère de sortie : plus aucun nom de classe dans le code du moteur ni dans
`apps/web`. Les tests du moteur passent sans modification de leurs résultats.

Avancement (2026-11-14) : **terminé**, branche `feat/classes-en-donnees`.

- Les 18 tests sur un nom de classe sont remplacés par des réglages de la
  classe. Le moteur et l'application lisent `hasInvocations`,
  `invocationsKnown`, `toolExpertiseCount`, `hasWildShape`… sur la classe.
- `classId` accepte `"pack:slug"` sur une fiche.
- Les 846 tests unitaires et les 80 scénarios de bout en bout passent ; aucun
  résultat de test n'a été modifié (seul un import a changé de module).
- **Reporté au lot 3** : ranger les effets de `feature-rules.ts` sur les
  capacités. Ces effets contiennent des textes résolus dans la langue
  courante à chaque appel ; les déplacer entre deux fichiers TypeScript
  aurait été réécrit au lot 3, quand le SRD passe au format des packs et que
  chaque capacité porte ses effets dans le JSON.
- **Pour le lot 3** : d'autres tables restent indexées par l'identifiant de
  classe (sorts mineurs et préparés, caractéristique d'incantation, bottes
  d'arme, langues, sorts accordés, équipement de départ, capacités,
  sous-classes). Ce ne sont pas des tests sur un nom mais le contenu du SRD :
  une classe de pack devra porter les mêmes champs.

### Lot 3 — Le SRD en pack de base

- Étendre le format des packs aux types manquants : classes et leurs
  capacités, armes, armures, équipement, kits de départ, langues,
  invocations. Une classe de pack porte les réglages du lot 2 et les tables
  encore indexées par classe (sorts mineurs et préparés, caractéristique
  d'incantation, bottes d'arme, langues, sorts accordés, équipement de
  départ).
- Ranger les effets de `feature-rules.ts` sur les capacités elles-mêmes
  (reporté du lot 2).
- Écrire le SRD dans ce format, traductions comprises, et déplacer
  `apps/web/src/data`.
- Charger ce pack en premier, toujours, sans possibilité de le désactiver.
  Ses identifiants restent courts (`"barbarian"`, sans préfixe) : les fiches
  existantes ne changent pas.
- Ouvrir les classes aux packs des utilisateurs : une sous-classe, un sort ou
  un kit de départ peut viser une classe de pack ; l'assistant, la montée de
  niveau et la fiche les affichent comme les classes du SRD.
- Ajouter `imageUrl` (facultatif) aux classes, espèces, historiques et
  sous-classes, et l'afficher dans l'assistant à la place du carré teinté.
  Pour un pack d'utilisateur, l'image est hébergée par l'auteur, comme les
  images de personnage (`lib/image-storage`). Les illustrations du pack de
  base sont fournies par Rémi et s'ajoutent au fil de l'eau.
- Documenter les classes dans le guide du format et le schéma JSON, avec un
  exemple complet dans le pack de démonstration.
- Porter la licence et l'attribution du SRD (CC-BY-4.0) dans l'en-tête du
  pack.

Avancement (2026-11-19) : **terminé**, branche `chore/depot-public`.

- ✅ Le format couvre tout le SRD : aux sept types existants s'ajoutent
  `classes`, `invocations`, `languages`, `weapons`, `armors`, `gear` et
  `equipmentPacks`. Une classe de pack porte les réglages du lot 2, les tables
  encore indexées par classe, ses paquetages, ses « au choix » et ses
  aptitudes ; une espèce dit ce que le moteur testait sur son identifiant
  (`powerfulBuild`, `lineageTrait`, `breathDamage`…).
- ✅ Le SRD est écrit dans ce format, traductions comprises, dans
  [`srd/`](../packages/system-dnd2024/src/srd) ; `apps/web/src/data` y est
  passé. `SRD_PACK` l'assemble en un pack que l'import accepte tel quel.
- ✅ Les effets de `feature-rules.ts` sont sur les capacités ; le fichier et
  les fichiers `locales/en/` du moteur ont disparu.
- ✅ Le pack de base est chargé d'office, ses identifiants restent courts ;
  les gros catalogues se chargent à la demande (`SRD_CATALOGS`).
- ✅ Les classes sont ouvertes aux packs : création, fiche, montée de niveau ;
  un scénario de bout en bout crée un personnage d'une classe de pack.
- ✅ `imageUrl` sur les classes, espèces, historiques et sous-classes,
  affiché dans l'assistant.
- ✅ Guide du format, schéma JSON et pack d'exemple couvrent tous les types.
- Vérification : à chaque type, un outil temporaire relisait le SRD par les
  fonctions publiques du moteur et comparait au fichier ; à la fin, la fiche
  dérivée de chaque combinaison classe × espèce aux niveaux 1, 5, 11 et 20
  (864 cas, français et anglais) est identique à celle d'avant le lot.
- Restent dans le code, comme règles : l'historique personnalisé, les effets
  contextuels de quelques manifestations occultes (rappels selon
  l'emplacement, jets), la forme sauvage et le familier, les anciens noms de
  lignées.

Critère de sortie : `packages/system-dnd2024` ne contient plus aucune entrée
de contenu, seulement des types, des règles et le chargement du pack. Les
personnages du seed donnent les mêmes valeurs dérivées qu'avant. Un
personnage d'une classe de pack se crée, monte de niveau et joue une session.

### Lot 4 — Ménage

- Mettre à jour `CONTENT_PACKS.md`, `FEATURE_EFFECTS.md`, `FIRESTORE.md`,
  `I18N.md`, la page de guide du format et le schéma JSON publié.

Avancement (2026-11-19) : **terminé**. Le guide du format et le schéma JSON
sont générés depuis le format (lot 3) ; les documents pointent vers `srd/`.

### Ordre

Le lot 1 est indépendant. Les lots 2 et 3 se suivent : on ne peut pas sortir
les classes en données tant que le moteur teste leur nom.

## Risques

| Risque                               | Réponse                                                                                                                                                                                        |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Régression sur les valeurs calculées | Les tests du moteur (`character-rules.test.ts`, `mechanics.test.ts`, `features.test.ts`, `resolve-choices.test.ts`) ne changent pas ; on compare aussi les personnages du seed avant et après. |
| Fiches existantes                    | Les identifiants du SRD restent les mêmes : pas de migration.                                                                                                                                  |
| Poids du pack de base au chargement  | Le garder découpé par type d'entrée, chargé à la demande, comme le paquet l'est déjà.                                                                                                          |
| Format des packs trop large          | Chaque type ajouté reprend le type du moteur, comme les sept existants.                                                                                                                        |

## Hors périmètre

- Les systèmes de règles créés par les MJ
  ([`RULE_SYSTEMS.md`](RULE_SYSTEMS.md), mis de côté).
- Un autre système de jeu que la 5e 2024 et « standard ».
