# Systèmes de règles — plan de la mise à jour

> **Mis de côté le 11 novembre 2026.** 5e 2024 reste codé, avec son rendu sur
> mesure. Le plan retenu est [`RULES_AND_CONTENT.md`](RULES_AND_CONTENT.md) :
> une frontière entre l'application et le système, et le SRD en pack de base.
> Ce document garde l'étude du format générique, pour le jour où on y revient.
> Les « décisions prises » ci-dessous valaient pour cette piste seulement.

Plan établi le 11 novembre 2026. Rien n'est implémenté.

## Objectif

Séparer le contenu 5e de l'application. Un **système de règles** devient une
donnée : un MJ le crée dans l'application, le partage à ses joueurs, et
l'application s'y adapte. Un système décrit :

- de quoi se compose une fiche de personnage (valeurs saisies, valeurs
  calculées, ressources) ;
- comment se crée un personnage (l'assistant suit les étapes décrites) ;
- comment il progresse ;
- quels jets on lance et comment on les lit ;
- ce que la session suit (combat, repos, états) et les règles qui s'y
  ajoutent.

## Décisions prises

- **5e 2024 est réexprimé dans le format.** Il n'y a pas de système codé à
  part. Le format doit être assez riche pour porter 5e, et l'application ne
  contient plus aucune règle 5e.
- **L'assistant de création est piloté par les règles de création du
  système.** Les règles de création de la 5e 2024, écrites dans le format,
  doivent redonner l'assistant actuel.
- **La fiche est générique, comme l'assistant.** La fiche 5e est rendue par
  les blocs génériques à partir de la disposition décrite dans le système. On
  enrichit ces blocs jusqu'à retrouver le rendu actuel ; il n'y a pas de
  composant de fiche propre à un jeu.
- **L'affichage se règle, il ne se dessine pas.** L'auteur d'un système ne
  personnalise pas les éléments visuels : il choisit des cartes standard dans
  une palette et décide de leur contenu (quelles valeurs, quel titre, quel
  ordre). Pas de CSS ni de mise en page libre ; le thème de l'application
  s'applique à tous les systèmes.

## Vocabulaire

| Terme          | Sens                                                                                |
| -------------- | ----------------------------------------------------------------------------------- |
| Système        | Les règles d'un jeu, au format `ak-system/1`.                                       |
| Pack           | Du contenu ajouté à un système : classes, sorts, monstres…                          |
| Catalogue      | Un type d'entité que le système déclare (« classe », « sort ») et ses entrées.      |
| Fiche          | Les valeurs d'un personnage pour un système donné.                                  |
| Valeur dérivée | Une valeur calculée par une formule, jamais saisie.                                 |
| Effet          | Ce qu'une entrée de catalogue change sur la fiche.                                  |
| Moteur         | Le code générique qui lit un système et calcule une fiche. Il ne connaît aucun jeu. |

## État actuel

### Ce qui est déjà en place

- Le contenu 5e vit dans son paquet, `packages/system-dnd2024` (environ
  19 500 lignes, tests compris) : données SRD, moteur de calcul, packs.
- Une partie des règles est déjà de la donnée sérialisable : `Mechanic` et
  `Amount` ([`mechanics.ts`](../packages/system-dnd2024/src/mechanics.ts), 16
  types d'effets), `ChoiceDef`
  ([`choices.ts`](../packages/system-dnd2024/src/choices.ts), 8 sortes de
  choix, 6 sources).
- Les packs `ak-pack/1` ajoutent espèces, historiques, sous-classes, dons,
  sorts et monstres, avec traductions, partage et copie figée sur la fiche
  (`packContent`).
- Un second système existe : « standard » (identité, points de vie,
  inventaire, notes).
- L'assistant de création est en partie déclaratif
  ([`steps.ts`](../apps/web/src/systems/dnd2024/creation-wizard/steps.ts)).
- Le serveur temps réel ne dépend pas du paquet 5e.

### Ce qui lie l'application à la 5e

| Zone                                                    | Fichiers qui importent `system-dnd2024` |
| ------------------------------------------------------- | --------------------------------------- |
| `apps/web/src/components/character`                     | 39                                      |
| `apps/web/src/lib`                                      | 23                                      |
| `apps/web/src/components/session`                       | 15                                      |
| `packages/schemas`                                      | 15                                      |
| `apps/web/src/pages`                                    | 9                                       |
| `apps/web/src/components/adventure`                     | 6                                       |
| Autres (`hooks`, `packs`, `campaign`, `scripts`, `e2e`) | 10                                      |

S'y ajoutent :

- **Le schéma de la fiche** (`packages/schemas/src/character.ts`) : une union
  de deux formes figées, `standard` et `dnd2024`, avec une cinquantaine de
  champs 5e nommés (`speciesId`, `classId`, `weaponMasteries`,
  `wildShapeForms`…).
- **Les valeurs dérivées** (`CharacterDerived`, une cinquantaine de champs)
  calculées par `character-rules.ts` (1 038 lignes de code).
- **Les tests `system === "dnd2024"`** dans les pages et dans `lib`.
- **Les catalogues d'équipement et de sorts** dans `apps/web/src/data` (passés
  depuis dans le pack de base, `packages/system-dnd2024/src/srd`)
  (environ 6 700 lignes de JSON).
- **L'assistant** : deux étapes sur mesure (caractéristiques, boutique) et une
  vingtaine de types de sous-étapes, dont plusieurs propres à la 5e (sorts,
  bottes d'arme, formes sauvages, expertise, points de vie, langues).
- **La session** : combattants avec `armorClass`, `conditions` et `size` de
  5e ; onglet sorts, formes sauvages, familier, bourse en cinq monnaies.
- **Les ennemis** : bloc de caractéristiques 5e.
- **Le vocabulaire des packs** : `"system": "dnd2024"` obligatoire, types
  d'entrées fixes.

## Architecture cible

```
packages/
  rules-engine/      Nouveau. Format ak-system/1, langage de formules,
                     calcul d'une fiche, résolution des choix et des étapes
                     de création, validation. Aucune connaissance d'un jeu.
  schemas/           Ne dépend plus d'aucun système. La fiche devient une
                     enveloppe générique.
  system-dnd2024/    Ne contient plus que des données : la définition du
                     système, le SRD en pack de base, les traductions.
apps/web/            Rendus génériques : fiche, assistant, montée de niveau,
                     session, éditeur de système.
```

L'application ne parle qu'au moteur. Elle lui donne un système, des packs et
les valeurs d'une fiche ; il rend les valeurs dérivées, les choix ouverts, les
étapes à afficher et les erreurs.

## Le format `ak-system/1`

Un système est un document JSON validé par un schéma zod, comme les packs. Il
se compose des parties suivantes.

### 1. En-tête

Identifiant, nom, version, langues, licence et mention d'attribution. La
mention de licence affichée aujourd'hui pour le SRD (`useLicenceNotice`) vient
de là.

### 2. Champs

Les valeurs saisies ou choisies. Chaque champ a un identifiant, un type, des
bornes, une valeur par défaut et une visibilité.

- **Types** : nombre, texte, texte long, case à cocher, liste fermée,
  référence vers une entrée de catalogue, liste de références, liste d'objets
  (inventaire), dé.
- **Visibilité** : propriétaire, groupe, MJ. Elle reprend la règle actuelle
  (un compagnon ne voit ni l'inventaire, ni la bourse, ni l'XP) et décide de
  ce qui va dans `private/belongings`.

### 3. Valeurs dérivées

Un identifiant et une formule.

```json
{ "id": "mod.for", "formula": "floor((for - 10) / 2)" }
{ "id": "bonusMaitrise", "formula": "2 + floor((niveau - 1) / 4)" }
```

### 4. Ressources

Une valeur courante, un maximum calculé, et ce qui la recharge : points de
vie, emplacements de sorts, usages d'une capacité. Les événements de recharge
(« repos court », « repos long ») sont déclarés par le système.

### 5. Catalogues

Le système déclare ses types d'entités et leurs propres champs. « Classe »,
« espèce », « sort », « arme » ne sont plus des notions de l'application.
Une entrée de catalogue peut porter :

- des **effets** sur la fiche ;
- des **choix** qu'elle ouvre ;
- des **capacités par niveau** ;
- des **tables** (emplacements de sorts par niveau, par exemple).

Les entrées elles-mêmes viennent des packs. Le SRD devient le pack de base du
système 5e 2024.

### 6. Effets

La généralisation des `Mechanic` actuels. Un effet a une cible, une opération,
un montant et une condition.

```json
{
  "target": "ca",
  "op": "base",
  "amount": "10 + mod.dex + mod.con",
  "when": "!porte('armure')"
}
```

- **Opérations** : nouvelle base (on garde la meilleure), ajouter, fixer un
  minimum ou un maximum, donner une étiquette (maîtrise, résistance, sens),
  donner un avantage sur un jet, afficher un rappel.
- **Ordre d'application** fixé par le moteur : bases, ajouts, bornes.
- **Rappel** : ce qui ne se réduit pas à un chiffre reste un texte, comme
  aujourd'hui.

Les 16 types de `Mechanic` se ramènent à ces opérations. L'inventaire de
[`FEATURE_EFFECTS.md`](FEATURE_EFFECTS.md) sert de liste de contrôle.

### 7. Choix

La généralisation des `ChoiceDef`. Un choix a une source, un nombre à choisir
(une formule), une condition d'ouverture et une réserve : une requête sur un
catalogue, avec un filtre.

```json
{
  "id": "formes-sauvages",
  "count": "table('druide.formes', niveau)",
  "pool": { "catalog": "bete", "where": "fp <= table('druide.fpMax', niveau)" },
  "when": "aCapacite('forme-sauvage')"
}
```

### 8. Jets

Un jet a un nom, une expression de dés et une lecture du résultat.

- **Expression** : `1d20 + mod.dex`, `1d100`, `(reserve)d6`.
- **Lecture** : total, comparaison à un seuil, nombre de réussites, réussite
  ou échec critique.
- **Modificateurs** : avantage, désavantage, relance, donnés par les effets.

Le lanceur de dés et la feuille de jet lisent ces définitions.

### 9. Progression

Le ou les compteurs de progression (niveau, expérience dépensée), les seuils,
et ce que chaque palier ouvre. La montée de niveau utilise les mêmes types
d'étapes que la création.

### 10. Création

Une liste d'étapes prises dans une palette. Chaque étape a une condition
d'apparition (`when`) et une règle de validité (`valid`).

| Type d'étape                            | Dans l'assistant actuel                                   |
| --------------------------------------- | --------------------------------------------------------- |
| Choisir une entité dans un catalogue    | Classe, espèce, historique                                |
| Résoudre les choix ouverts              | Compétences, dons, options de classe                      |
| Choisir N entrées d'un catalogue filtré | Sorts, bottes d'arme, formes sauvages, expertise, langues |
| Répartir des valeurs selon une méthode  | Caractéristiques (tableau, achat par points, tirage)      |
| Dépenser un budget                      | Boutique, kit de départ                                   |
| Saisir des champs                       | Identité, alignement, histoire                            |
| Tirer ou fixer une valeur               | Points de vie                                             |
| Récapituler                             | Impact, relecture                                         |

Règle de conception : aucun type d'étape n'est réservé à un jeu. Si 5e en
demande un, c'est que la palette est incomplète.

### 11. Disposition de la fiche

Des sections et des blocs pris dans une palette : bloc de valeurs, liste de
compétences, jauge de ressource, bouton de jet, table d'entrées de catalogue,
inventaire, texte. Chaque bloc dit quelles valeurs il montre. Une disposition
pour le téléphone et une pour l'ordinateur, ou une seule qui s'adapte.

### 12. Session

- **Combattants** : quelles valeurs de la fiche la session suit (points de
  vie, défense), quel jet donne l'ordre des tours, quels états existent.
- **Ennemis et PNJ** : leur bloc de valeurs est un catalogue comme un autre.
- **Événements** : repos, début de tour, fin de combat, et ce qu'ils
  rechargent.
- **Règles supplémentaires de session** : textes et jets que le MJ ajoute
  pour sa table.

### 13. Traductions

Même principe que les packs : un texte par langue, avec repli sur la langue
du système.

## Le langage de formules

- **Des expressions, pas un langage de programmation** : nombres, opérateurs,
  comparaisons, `si(…)`, `min`, `max`, `floor`, `ceil`, `somme`, `compte`,
  lecture d'une table, test d'une étiquette. Ni boucle, ni affectation.
- **Références** : un champ (`for`), une valeur dérivée (`mod.for`), un
  attribut d'une entité choisie (`classe.deDeVie`).
- **Interprété par le moteur**, jamais passé à `eval`. Un système vient d'un
  autre utilisateur : c'est une donnée non fiable.
- **Borné** : taille maximale, profondeur maximale, détection des cycles à
  l'enregistrement.
- **Graphe de dépendances** : le moteur ne recalcule que ce qui dépend de la
  valeur modifiée.
- **Erreurs lisibles** : l'éditeur montre la formule en cause et la raison.

## Stockage, partage et versions

- **Système** : `systems/{id}`, sur le modèle de `contentPacks/{id}`
  (propriétaire, partage par compte ou par lien). La limite de 1 Mio par
  document Firestore impose de garder les catalogues dans les packs, hors de
  la définition.
- **Campagne** : elle fixe un système et une version. Le champ `system`
  actuel (`dnd5e`, `custom`…) et `characterSystem` sont remplacés.
- **Fiche** : `systemId`, `systemVersion`, `values` (les champs), `picks`
  (les choix), et une copie des valeurs dérivées utiles aux listes et à la
  session.
- **Changement de version** : une action explicite du MJ. Le moteur compare
  les deux versions et liste, fiche par fiche, les valeurs devenues invalides
  avant d'appliquer.
- **Règles maison** : une surcouche par campagne posée sur un système
  partagé, sans le copier.
- **Packs** : `ak-pack/2`, générique. Un pack vise un système et range ses
  entrées par catalogue. Les packs `ak-pack/1` sont convertis automatiquement
  (`packs/migrate.ts` existe déjà pour ce rôle).
- **Export et import** en JSON, avec un schéma JSON publié et une page de
  guide du format, comme pour les packs.

## Lots

Chaque lot laisse l'application livrable. Les tailles sont indicatives.

### Lot 0 — Cadrage du format (taille : moyenne)

- Écrire la spécification de `ak-system/1`.
- Prototyper le langage de formules.
- Exprimer sur papier les cas difficiles de la 5e : classe d'armure à plusieurs
  sources, emplacements de sorts et magie de pacte, formes sauvages, bottes
  d'arme, bonus de caractéristiques de l'historique, dons qui ouvrent des
  choix.

Critère de sortie : un barbare et un magicien de niveau 5 décrits en entier
dans le format, sans échappatoire.

### Lot 1 — La frontière (taille : grande)

- Définir l'interface « système » que l'application consomme.
- Brancher 5e 2024 dessus par un adaptateur, sans changer son code.
- Retirer les imports directs de `system-dnd2024` (une centaine de fichiers
  dans `apps/web`, 15 dans `packages/schemas`) et les tests
  `system === "dnd2024"`.

Critère de sortie : une règle de lint interdit d'importer `system-dnd2024`
hors de l'adaptateur. Aucun changement visible, tests de bout en bout verts.

### Lot 2 — Le moteur et le système « standard » (taille : moyenne)

- Créer `packages/rules-engine` : schéma du format, formules, calcul d'une
  fiche.
- Réécrire « standard » en données.
- Rendre sa fiche et son formulaire par les premiers composants génériques.
- Passer la fiche à l'enveloppe générique et migrer les fiches « standard ».

Critère de sortie : le système « standard » n'a plus de code propre.

### Lot 3 — 5e : valeurs dérivées (taille : grande)

- Réécrire `character-rules.ts` en formules et en effets.
- Faire tourner les deux moteurs côte à côte sur les tests existants
  (`character-rules.test.ts`, `mechanics.test.ts`, `features.test.ts`), sur
  les personnages du seed et sur un jeu de fiches réelles.

Critère de sortie : aucun écart entre les deux moteurs, puis suppression de
l'ancien calcul.

### Lot 4 — 5e : catalogues et packs (taille : grande)

- Déclarer les catalogues de la 5e (classe, sous-classe, espèce, historique,
  don, sort, arme, armure, outil, équipement, monstre, langue, état).
- Sortir le SRD en pack de base, y compris `apps/web/src/data`.
- Passer les packs à `ak-pack/2` et convertir les packs existants.
- Migrer les fiches 5e vers l'enveloppe générique, avec lecture des deux
  formes le temps de la migration.

Critère de sortie : `packages/schemas` ne dépend plus d'aucun système.

### Lot 5 — Création et progression (taille : grande)

- Construire la palette d'étapes et leur rendu, à partir des composants
  actuels (carrousel, illustrations, fiche d'impact).
- Écrire les règles de création et de montée de niveau de la 5e en données.
- Remplacer `creation-wizard` et `level-up` par l'assistant générique.

Critère de sortie : l'assistant générique donne le même parcours et le même
rendu que l'actuel, comparés par capture sur téléphone et sur ordinateur.

### Lot 6 — Fiche générique (taille : grande)

- Construire la palette de blocs de fiche.
- Décrire la fiche 5e en disposition, la rendre par ces blocs.
- Faire de même pour l'éditeur de fiche et la fiche du joueur en session.

Critère de sortie : `dnd2024-sheet.tsx` est supprimé, rendu comparé par
capture.

### Lot 7 — Session (taille : grande)

- Jets, ressources et repos lus depuis le système.
- Combattants, ordre des tours et états décrits par le système.
- Ennemis et PNJ comme entrées de catalogue.
- Règles supplémentaires de session.

Critère de sortie : une session se joue avec le système « standard » enrichi
d'un jet et d'une ressource, sans code propre.

### Lot 8 — Éditeur de système (taille : très grande)

- Maquettes d'abord (`docs/mockups`), dans le thème de l'application.
- Écrans : champs, formules avec aperçu en direct sur une fiche d'exemple,
  catalogues, étapes de création, disposition de la fiche, jets, session.
- Point de départ : vide, « standard », ou copie d'un système existant.
- Validation en continu, erreurs situées.

Critère de sortie : un MJ crée un petit système complet sans écrire de JSON.

### Lot 9 — Partage (taille : moyenne)

- Bibliothèque de systèmes, partage par compte et par lien.
- Version fixée par campagne, mise à jour avec rapport.
- Règles maison par campagne.
- Export, import, schéma JSON, guide du format.

### Lot 10 — Ménage (taille : petite)

- Supprimer le code restant de `system-dnd2024`.
- Mettre à jour `CONTENT_PACKS.md`, `FIRESTORE.md`, `I18N.md`,
  `FEATURE_EFFECTS.md` et les règles Firestore.

### Ordre et dépendances

```
                    ┌→ 5 ─┐
0 → 1 → 2 → 3 → 4 ──┼→ 6 ─┼→ 8 → 9 → 10
                    └→ 7 ─┘
```

Les lots 5, 6 et 7 peuvent avancer en parallèle une fois le lot 4 terminé.
L'éditeur (lot 8) vient après eux pour ne pas dessiner des écrans sur un
format qui bouge encore.

## Risques

| Risque                                           | Réponse                                                                                                                        |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| Le format devient trop complexe pour un MJ       | L'éditeur cache ce qui ne sert pas ; un système simple reste court. Le lot 2 (« standard ») sert de garde-fou.                 |
| Régressions sur 5e                               | Les deux moteurs tournent côte à côte jusqu'à égalité des résultats (lot 3).                                                   |
| Rendu 5e moins soigné une fois générique         | On enrichit les blocs jusqu'à retrouver le rendu, vérifié par capture.                                                         |
| Lenteur du calcul                                | Graphe de dépendances, calcul partiel, mesure sur une fiche de niveau 20.                                                      |
| Système malveillant ou cassé                     | Formules interprétées et bornées, tailles limitées, textes échappés.                                                           |
| Taille des documents Firestore                   | Catalogues dans les packs, définition du système à part.                                                                       |
| Contenu sous droits partagé par des utilisateurs | Partage privé d'abord ; l'ouverture publique suit [Packs publics](../INCOMING_UPDATES.md#maj-packs-publics), avec signalement. |
| Migration des fiches existantes                  | Script de migration, lecture des deux formes pendant la transition, essai sur le staging.                                      |
| Chantier long                                    | Chaque lot est livrable ; les lots 1 à 4 ont déjà une valeur seuls.                                                            |

## Points à trancher

- **Écriture des formules dans l'éditeur** : texte avec aperçu, ou assemblage
  de blocs ?
- **Langue des identifiants et des fonctions** dans les formules : français,
  anglais, ou libre avec des fonctions en anglais ?
- **Portée de la première version publiée de l'éditeur** : fiche et jets
  seulement, ou création et session dès le départ ?
- **Qui modifie** : le MJ seul, ou des co-auteurs ?
- **Multi-classes et multi-compteurs de progression** : à prévoir dans le
  format dès la version 1, ou plus tard ?
- **Systèmes sans personnage à niveaux** (achats à l'expérience, pas de
  progression) : couverts dès la version 1 ?

## Hors périmètre

- Automatiser les règles qui dépendent de la position, des alliés ou de la
  durée. Elles restent des rappels.
- Un catalogue public de systèmes.
- L'import de fiches depuis d'autres outils.
