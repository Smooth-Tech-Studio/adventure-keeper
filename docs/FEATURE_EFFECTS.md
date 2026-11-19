# Effets des capacités — inventaire

Ce que chaque capacité du SRD change **réellement** sur la fiche et en séance,
et ce qui reste du texte. Les effets sont des données
([`mechanics.ts`](../packages/system-dnd2024/src/mechanics.ts), au format des
packs — voir [`CONTENT_PACKS.md`](CONTENT_PACKS.md#effets-des-capacités-mechanics-uses)),
portées par la capacité elle-même dans le pack de base du SRD
([`srd/`](../packages/system-dnd2024/src/srd) : `classes.json`,
`subclasses.json`, `species.json`), comme dans un pack d'utilisateur ; les
options de classe (Ordre primitif…) aussi, dans `options` de la classe.

Légende :

- ✅ **appliqué** : le chiffre de la fiche change (CA, vitesse, initiative,
  sauvegardes, tests, PV, critique) ou la feuille de jet en tient compte
  (avantage coché, bonus de dégâts) ;
- 🔢 **compteur** : les utilisations par repos sont suivies en séance
  (« Capacités »), avec le bon nombre au bon niveau ;
- 📝 **rappel** : affiché dans le bloc de combat ou en indice sur la feuille de
  jet, sans calcul — la règle dépend de ce que l'app ne suit pas (position,
  alliés, durée, cible) ;
- ⏳ **à faire** : un effet calculable qui ne l'est pas encore ;
- — : rien à calculer (récit, exploration, choix déjà géré ailleurs).

« (déjà) » : appliqué avant ce lot.

## Les choix qui étaient imposés

| Classe  | Choix                       | Avant                                                    | Maintenant                                                                                            |
| ------- | --------------------------- | -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Druide  | Ordre primitif (niv. 1)     | tout druide portait l'armure intermédiaire, pas de choix | Magicien (sort mineur + Sag. en Arcanes / Nature) ou Gardien (armes de guerre + armure intermédiaire) |
| Clerc   | Ordre divin (niv. 1)        | ni armure lourde ni sort mineur en plus                  | Protecteur (armes de guerre + armure lourde) ou Thaumaturge                                           |
| Clerc   | Impacts bénis (niv. 7)      | texte seul                                               | Frappe divine (rappel) ou Incantation puissante (Sag. aux dégâts des sorts mineurs)                   |
| Druide  | Fureur élémentaire (niv. 7) | texte seul                                               | Incantation puissante ou Frappe primitive (rappel)                                                    |
| Barbare | Savoir primal (niv. 3)      | la compétence de plus n'était pas proposée               | une compétence de barbare au choix                                                                    |

Restent à proposer (⏳) : Expertise du rôdeur (Fin explorateur, niv. 2 et 9) et
du magicien (Érudition, niv. 2) — seules celles du roublard et du barde le sont ;
les deux langues de Fin explorateur ; la langue de l'Argot des voleurs ; les
options de Métamagie ; l'élément d'Affinité élémentaire (ensorceleur draconique)
et de Protégé de dame Nature (cercle de la Terre) ; le second style de combat du
Champion (niv. 7) ; les sorts de Maîtrise des sorts / Sorts de prédilection.

## Classes

### Barbare

| Capacité                          | État  | Détail                                                                                                                               |
| --------------------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Rage                              | 🔢 📝 | 2 → 6 utilisations ; bonus de dégâts en rappel (déjà) ; résistances et avantages pendant la Rage non suivis (pas d'état « en rage ») |
| Défense sans armure               | ✅    | CA 10 + Dex + Con sans armure, bouclier permis                                                                                       |
| Bottes d'arme                     | ✅    | (déjà)                                                                                                                               |
| Sens du danger                    | ✅    | avantage coché aux sauvegardes de Dextérité                                                                                          |
| Témérité, Coup brutal             | 📝    | choix au moment de l'attaque                                                                                                         |
| Savoir primal                     | ✅    | compétence au choix ; Force pour les tests en Rage : ⏳                                                                              |
| Déplacement rapide                | ✅    | +3 m sans armure lourde                                                                                                              |
| Instinct sauvage                  | ✅    | avantage à l'initiative                                                                                                              |
| Rage implacable, Rage persistante | 📝    |                                                                                                                                      |
| Puissance indomptable             | ⏳    | plancher = valeur de Force sur les tests de Force                                                                                    |
| Champion primitif                 | ✅    | Force et Constitution +4 (max 25)                                                                                                    |

### Barde

| Capacité                              | État | Détail                                                                                                |
| ------------------------------------- | ---- | ----------------------------------------------------------------------------------------------------- |
| Inspiration bardique                  | 🔢   | Charisme (min. 1) par repos long, court dès le niveau 5 (Source d'inspiration) ; dé d6 → d12 en texte |
| Expertise                             | ✅   | (déjà)                                                                                                |
| Touche-à-tout                         | ✅   | ½ maîtrise aux tests non maîtrisés, initiative comprise                                               |
| Contre-charme, Inspiration supérieure | 📝   |                                                                                                       |
| Secrets magiques                      | —    | listes de sorts élargies : ⏳ dans le choix des sorts                                                 |

### Clerc

| Capacité                   | État  | Détail                  |
| -------------------------- | ----- | ----------------------- |
| Ordre divin                | ✅    | voir plus haut          |
| Conduit divin              | 🔢    | 2 → 4 utilisations      |
| Calcination de mort-vivant | 📝    |                         |
| Impacts bénis              | ✅ 📝 | voir plus haut          |
| Intervention divine        | 🔢    | une fois par repos long |

### Druide

| Capacité                    | État  | Détail                                                                                                                                                                                   |
| --------------------------- | ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Druidique                   | ✅    | (déjà) Communication avec les animaux préparé                                                                                                                                            |
| Ordre primitif              | ✅    | voir plus haut                                                                                                                                                                           |
| Forme sauvage               | 🔢 ✅ | 2 → 4 utilisations ; formes connues (4 / 6 / 8, FP 1/4 → 1, vol au niveau 8) ; en séance, la transformation : CA, vitesses, For/Dex/Con et attaques de la bête, niveau en PV temporaires |
| Compagnon sauvage           | ✅    | invoquer un familier depuis la carte « Familier »                                                                                                                                        |
| Fureur élémentaire          | ✅ 📝 | voir plus haut                                                                                                                                                                           |
| Regain sauvage, Archidruide | 📝    |                                                                                                                                                                                          |

### Guerrier

| Capacité                         | État  | Détail                                |
| -------------------------------- | ----- | ------------------------------------- |
| Style de combat                  | ✅    | (déjà, selon le style)                |
| Second souffle                   | 🔢 ✅ | 2 → 4 utilisations, soin lancé (déjà) |
| Fougue                           | 🔢    | 1, puis 2 au niveau 17                |
| Inflexible                       | 🔢    | 1 → 3 au niveau 17                    |
| Attaque supplémentaire et suites | 📝    |                                       |

### Moine

| Capacité                                                    | État | Détail                                                      |
| ----------------------------------------------------------- | ---- | ----------------------------------------------------------- |
| Arts martiaux                                               | ✅   | (déjà) dé, Dextérité, armes de moine                        |
| Défense sans armure                                         | ✅   | CA 10 + Dex + Sag sans armure **ni bouclier**               |
| Credo du Moine                                              | 🔢   | autant de points que le niveau (compteur, pas de pastilles) |
| Déplacement sans armure                                     | ✅   | +3 m → +9 m sans armure ni bouclier                         |
| Métabolisme surnaturel                                      | 🔢   | une fois par repos long                                     |
| Survivant discipliné                                        | ✅   | maîtrise de toutes les sauvegardes                          |
| Esprit et corps                                             | ✅   | Dextérité et Sagesse +4 (max 25)                            |
| Frappes renforcées, Mouvement acrobatique, Autosubsistance… | 📝   |                                                             |

### Paladin

| Capacité                              | État | Détail                                      |
| ------------------------------------- | ---- | ------------------------------------------- |
| Imposition des mains                  | 🔢   | réserve de 5 × niveau PV                    |
| Châtiment de paladin, Fidèle destrier | 🔢   | une fois par repos long sans emplacement    |
| Conduit divin                         | 🔢   | 2, puis 3 au niveau 11                      |
| Aura de protection                    | ✅   | Charisme (min. 1) à toutes les sauvegardes  |
| Frappes radiantes                     | ⏳   | +1d8 radiants en dé ajouté au jet de dégâts |
| Auras de courage / étendue            | 📝   |                                             |

### Rôdeur

| Capacité                        | État | Détail                                           |
| ------------------------------- | ---- | ------------------------------------------------ |
| Ennemi juré                     | 🔢   | 2 → 6 lancers gratuits de Marque du chasseur     |
| Fin explorateur                 | ⏳   | Expertise et langues à choisir                   |
| Arpenteur                       | ✅   | +3 m sans armure lourde, escalade et nage        |
| Infatigable, Voile de la nature | 🔢   | Sagesse (min. 1) par repos long                  |
| Chasseur précis                 | 📝   | avantage rappelé sur la feuille de jet d'attaque |
| Sens sauvages                   | ✅   | vision aveugle 9 m                               |
| Tueur implacable                | ⏳   | dé de Marque du chasseur d6 → d10                |

### Roublard

| Capacité                            | État  | Détail                                    |
| ----------------------------------- | ----- | ----------------------------------------- |
| Expertise, Attaque sournoise        | ✅ 📝 | (déjà)                                    |
| Savoir-faire                        | ⏳    | plancher de 10 au d20 des tests maîtrisés |
| Esprit fuyant                       | ✅    | maîtrise des sauvegardes de Sag. et Cha.  |
| Coup de chance                      | 🔢    | une fois par repos court                  |
| Esquive instinctive, Insaisissable… | 📝    |                                           |

### Ensorceleur

| Capacité                | État | Détail                  |
| ----------------------- | ---- | ----------------------- |
| Sorcellerie innée       | 🔢   | 2 par repos long        |
| Réserve arcanique       | 🔢   | points = niveau         |
| Restauration ensorcelée | 🔢   | une fois par repos long |
| Métamagie               | ⏳   | options à choisir       |

### Occultiste

| Capacité                                                            | État | Détail                  |
| ------------------------------------------------------------------- | ---- | ----------------------- |
| Manifestations occultes                                             | ✅   | (déjà)                  |
| Rouerie magique, Communication avec le protecteur, Arcanum mystique | 🔢   | une fois par repos long |

### Magicien

| Capacité                                  | État | Détail                  |
| ----------------------------------------- | ---- | ----------------------- |
| Restauration magique                      | 🔢   | une fois par repos long |
| Érudition                                 | ⏳   | Expertise à choisir     |
| Maîtrise des sorts, Sorts de prédilection | ⏳   | sorts à choisir         |

## Sous-classes

| Sous-classe            | Capacité                      | État | Détail                                                                |
| ---------------------- | ----------------------------- | ---- | --------------------------------------------------------------------- |
| Champion               | Critique amélioré / supérieur | ✅   | critique sur 19, puis 18 (feuille de jet)                             |
| Champion               | Athlète accompli              | ✅   | avantage à l'initiative et en Athlétisme                              |
| Champion               | Survivant                     | ⏳   | avantage connu du moteur, pas encore du suivi des jets contre la mort |
| Credo de la Paume      | Plénitude physique            | 🔢   | Sagesse (min. 1) par repos long                                       |
| Voleur                 | Monte-en-l'air                | ✅   | vitesse d'escalade                                                    |
| Sorcellerie draconique | Résistance draconique         | ✅   | CA 10 + Dex + Cha sans armure, +1 PV / niveau                         |
| Sorcellerie draconique | Ailes draconiques             | 🔢   | une fois par repos long                                               |
| Protecteur Fiélon      | Chance du Ténébreux           | 🔢   | Charisme (min. 1) par repos long                                      |
| Évocateur              | Évocation améliorée           | ✅   | Intelligence aux dégâts des sorts d'évocation                         |
| Voie du Berserker      | Présence intimidante          | 🔢   | une fois par repos long                                               |
| Toutes                 | Sorts de sous-classe          | ✅   | (déjà) toujours préparés                                              |
| Les autres capacités   |                               | 📝   | situationnelles                                                       |

## Espèces

Vitesse, vision dans le noir, résistances, PV du nain et Souffle du drakéide
étaient déjà calculés.

| Espèce   | Trait                              | État | Détail                                            |
| -------- | ---------------------------------- | ---- | ------------------------------------------------- |
| Nain     | Connaissance de la pierre          | 🔢   | bonus de maîtrise par repos long                  |
| Nain     | Résistance naine                   | 📝   | avantage contre Empoisonné (rappel)               |
| Elfe     | Ascendance féerique                | 📝   | avantage contre Charmé (rappel)                   |
| Gnome    | Ruse gnome                         | ✅   | avantage coché aux sauvegardes d'Int., Sag., Cha. |
| Goliath  | Ascendance gigante, Forme de géant | 🔢   |                                                   |
| Halfelin | Brave                              | 📝   | avantage contre Effrayé (rappel)                  |
| Halfelin | Chance                             | ⏳   | relancer un 1 au d20                              |
| Orc      | Acharnement, Poussée d'adrénaline  | 🔢   |                                                   |
| Drakéide | Vol draconique                     | 🔢   |                                                   |
| Humain   | Ingénieux                          | ⏳   | inspiration héroïque au repos long                |

## Dons

| Don                     | État | Détail                                                                                   |
| ----------------------- | ---- | ---------------------------------------------------------------------------------------- |
| Vigilant                | ✅   | bonus de maîtrise à l'initiative (le rappel disait « déjà appliqué », il ne l'était pas) |
| Styles de combat        | ✅   | (déjà) Archerie, Défense ; rappels pour les autres                                       |
| Sauvagerie martiale     | 📝   | (déjà)                                                                                   |
| Initié à la magie, Doué | ✅   | (déjà) choix et sorts                                                                    |

## En séance

- L'**initiative** de la fiche, de la création de combat et du jet du joueur
  suit `initiativeBonus` (Dextérité + Vigilant + Touche-à-tout…).
- La **feuille de jet** coche « Avantage » d'elle-même quand une capacité le
  donne sans condition (Sens du danger, Ruse gnome, Athlète accompli…), et
  rappelle celles qui dépendent d'une condition.
- Les **bonus de dégâts** (Incantation puissante, Évocation améliorée)
  s'ajoutent au jet ; le **critique** suit la plage du Champion.
- Les **capacités à utilisations** prennent leur nombre au bon niveau ; une
  réserve de plus de 10 points (Credo, Imposition des mains) s'affiche en
  compteur.

## Pistes

- Un état « en Rage » activable en
  séance : résistances, avantage aux tests de Force, bonus de dégâts ajouté au
  jet plutôt que rappelé.
- Les dés ajoutés aux dégâts (Frappes radiantes, Frappe divine, Frappe
  primitive) : un effet `damageDice` sur le modèle de `damageBonus`.
- Les planchers de d20 (Savoir-faire, Puissance indomptable) et la relance
  du halfelin dans la feuille de jet.
