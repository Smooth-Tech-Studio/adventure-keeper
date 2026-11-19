# Incoming updates

| Nom de la MAJ                                                      | Description                                                                                                | Attribution | Statut                |
| ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- | ----------- | --------------------- |
| [Transformer un PNJ en ennemi](#maj-pnj-vers-ennemi)               | Promouvoir un PNJ en ennemi quand il devient hostile, sans le ressaisir.                                   | —           | Mis de côté           |
| [Packs publics](#maj-packs-publics)                                | Ouvrir des packs publics, avec un bouton de signalement.                                                   | —           | —                     |
| [Révéler manuellement aux joueurs](#maj-revelation-manuelle)       | Révéler événements, quêtes, codex hors session, de façon homogène.                                         | —           | —                     |
| [Consulter la fiche des autres joueurs](#maj-fiche-autres-joueurs) | Voir les valeurs clés et l'histoire des compagnons, depuis la campagne et l'aventure.                      | —           | Fait (#255)           |
| [Composants partagés de la maquette](#maj-composants-partages)     | Sortir en composants ce que la maquette Design partage et que les pages écrivaient en ligne.               | —           | Fait (#253)           |
| [Fiches des compagnons : relecture](#maj-fiches-relecture)         | « Personnage choisi » restait affiché quand la lecture d'une fiche échouait.                               | —           | Fait (#254)           |
| [Erreurs de console](#maj-erreurs-console)                         | Un `<div>` dans un `<p>` de la chronique, le `<script>` de next-themes.                                    | —           | Fait (#256)           |
| [Serveur de session sur son ordinateur](#maj-app-serveur)          | Une petite app (Tauri) qui fait tourner le serveur temps réel chez le MJ, à télécharger sur le site.       | Claude      | En cours (#259)       |
| [Déploiement de staging](#maj-deploiement-staging)                 | Un push sur `staging` déploie un projet Firebase de staging, avec ses propres secrets.                     | Claude      | En cours (#261, #262) |
| [Publication du serveur à chaque merge](#maj-serveur-release-main) | Un merge sur `main` qui touche le serveur publie une release, avec une version calculée.                   | Rémi        | Fait (#271)           |
| [Noms des workflows](#maj-noms-workflows)                          | Points d'entrée nommés par déclencheur, briques par verbe et nature (`-reusable`, `-manual`).              | Rémi        | Fait (#272)           |
| [Tag de release refusé](#maj-serveur-tag-refuse)                   | Le tag `serveur-vX.Y.Z` échouait quand un merge avait changé un workflow pendant le build.                 | Claude      | En cours (#276)       |
| [Semer le staging](#maj-semer-staging)                             | Les comptes, personnages et campagne du seed local, sur le projet Firebase de staging.                     | Claude      | En cours              |
| [Le serveur, seule voie de la session](#maj-serveur-seul)          | Démarrer une séance passe toujours par le serveur temps réel ; plus de mode Firestore.                     | Rémi        | En cours              |
| [Projeter la carte depuis un joueur](#maj-projection-joueur)       | Un joueur met la carte sur l'écran de la pièce et joue depuis son téléphone.                               | Rémi        | En cours (#274)       |
| [Création bloquée sur les outils](#maj-validation-outils)          | « Choisissez 1 maîtrise(s) d'outil » alors que tout est choisi, dès qu'un don apporte un outil.            | Claude      | En cours (#277)       |
| [Pack hors SRD : Musicien](#maj-pack-musicien)                     | Le don Musicien propose n'importe quel outil au lieu des seuls instruments.                                | Rémi        | En cours              |
| [Staging et e2e des PR en pause](#maj-pause-staging)               | Plus rien d'automatique sur `staging`, plus d'e2e sur les PR vers `main` ; fichiers gardés.                | Rémi        | En cours (#279)       |
| [Dépôt public](#maj-depot-public)                                  | Repartir d'un dépôt neuf et public, sous licence non commerciale, avec les installeurs dans le même dépôt. | Rémi        | En cours              |
| [Règles et contenu séparés](#maj-regles-et-contenu)                | Une frontière entre l'application et la 5e, et le SRD sorti du code en pack de base.                       | —           | Fait                  |
| [Systèmes de règles créés par le MJ](#maj-systemes-de-regles)      | Fiche, création et règles de session décrites par un système que le MJ écrit et partage.                   | —           | Mis de côté           |

## Fiche personnage

### Consulter la fiche des autres joueurs <a id="maj-fiche-autres-joueurs"></a>

Un joueur veut voir les fiches de ses compagnons. Le plus utile : les
**valeurs clés** et leur **histoire**. Il veut y accéder **depuis la
campagne** et **depuis l'aventure**.

État actuel :

- **Lecture déjà autorisée** : `firestore.rules` permet à tout utilisateur
  connecté de lire un personnage (`/characters/{id}`), et la page
  `/characters/:id` affiche une fiche en lecture seule à qui n'en est pas
  propriétaire (`pages/characters/character-detail.tsx`).
- **Aucun chemin d'accès** : seul le personnage du joueur lui-même est lié
  depuis la campagne (`my-character-card.tsx`). La carte Membres
  (`members-card.tsx`) affiche le nom du personnage choisi, sans lien. La
  carte Participants de l'aventure (`participants-card.tsx`) liste les
  personnages, sans lien non plus. En session, seul le MJ peut ouvrir une
  fiche (`inspect-character-dialog.tsx`).
- **Histoire réservée au propriétaire** : `CharacterStorySection`
  (personnalité, chapitres, journal) n'est rendue que pour le propriétaire.
  Les règles prévoient pourtant déjà le partage : un chapitre ou une entrée de
  journal en visibilité `party` est lisible des membres de la campagne
  concernée, en `gm` du MJ (`storyReadable`). Il manque l'affichage côté
  lecteur, filtré sur `campaignId` + `visibility`, comme l'exigent les
  règles.

Objectif :

- Un lien (nom ou avatar cliquable) vers la fiche de chaque compagnon :
  carte Membres de la campagne, carte Participants de l'aventure, et
  pourquoi pas la liste du groupe en session côté joueur (dans une boîte de
  dialogue, sans quitter la partie).
- Une **vue « compagnon »** centrée sur l'essentiel : identité (espèce,
  classe, niveau), PV max, CA, initiative, vitesse, caractéristiques,
  maîtrises / compétences notables, puis l'histoire (lore + chapitres et
  entrées de journal partagés avec le groupe).
- Ouverte depuis une campagne, la vue filtre l'histoire sur **cette
  campagne** : on ne voit que ce qui y a été partagé.

Décisions (2026-10-16) :

- **Fiche complète en lecture seule**, pas de vue résumée pour l'instant.
- **Règle fixe** pour toutes les fiches, sans réglage par joueur ni par
  campagne. Un **compagnon** (autre joueur de la campagne) ne voit pas
  l'**inventaire** (armes et armures restent visibles), la **bourse** ni
  l'**XP** (le niveau reste visible). Tout le reste est visible : attaques,
  capacités, caractéristiques, compétences, sorts (préparés compris), PV. Le
  MJ voit tout.
- **Lore toujours visible** : c'est la présentation publique du personnage ;
  les secrets vont dans les chapitres « Moi » ou « Moi et le MJ ».
- **Lecture des fiches restreinte** au propriétaire et aux membres (et MJ)
  des campagnes où le personnage est engagé.

Fait (branche `feat/incoming-quick-wins`) :

- Noms de personnages cliquables dans la carte Membres (tous les personnages
  du joueur, l'actif marqué d'un point) et la carte Participants. Le lien
  porte la campagne (`/characters/:id?campaign=…`) et le fil d'Ariane.
- Ouverte depuis une campagne, la fiche montre en lecture seule la
  personnalité, les chapitres et le journal partagés avec cette campagne
  (« Groupe », plus « MJ » pour le MJ), dans les onglets Histoire et Journal.
- Inventaire, bourse et XP masqués aux compagnons.
- Lecture des fiches restreinte au propriétaire et aux membres (et MJ) des
  campagnes de la fiche : `campaignIds` sur le personnage, ajouté quand le
  joueur l'engage, et vérifié par `firestore.rules` (dix premières
  campagnes). Migration : `pnpm characters:migrate-campaigns`, à appliquer en
  production **avant** de déployer les règles.

Reste à faire :

- ~~Le masquage est **visuel** : un compagnon peut toujours lire l'inventaire,
  la bourse et l'XP dans les données.~~ Fait (PR #255) : inventaire, bourse,
  XP et notes de la fiche standard sont dans `characters/{id}/private/belongings`,
  lisible du propriétaire et du MJ seulement. **Déploiement** : les règles,
  puis l'appli, puis `pnpm characters:migrate-belongings --prod --apply`.
- ~~Le lien depuis la liste du groupe en session, côté joueur.~~ Fait
  (PR #222) : un clic sur un compagnon ouvre sa fiche
  dans une boîte de dialogue.

### Création bloquée sur les outils <a id="maj-validation-outils"></a>

Retour de test en production (brouillon « Gti » : barbare, historique Artiste
et don Musicien du pack hors SRD). Toutes les étapes du parcours sont
valides, mais « Créer » affiche « Choisissez 1 maîtrise(s) d'outil. ».

Cause : le contrôle final (`validateForm`) comparait les outils attendus de la
classe et de l'historique à la longueur de `toolProficiencies`. Ce champ
contient aussi les outils d'un don (Musicien, Doué) et il est dédoublonné. Le
compte tombait donc faux dans trois cas :

- un don apporte un outil : trop d'outils, création refusée ;
- la classe et l'historique prennent le même outil : un de moins, création
  refusée ;
- l'outil de l'historique manque mais un don en apporte un : création
  acceptée à tort.

Correction : le contrôle vérifie chaque choix d'outil de la classe et de
l'historique, comme le parcours. Les fiches sans `choices` (antérieures au
parcours guidé) gardent l'ancien compte.

### Pack hors SRD : Musicien <a id="maj-pack-musicien"></a>

Dans le pack « D&D 2024 — Contenu hors SRD » (1.4.0), le choix du don
Musicien a `pool: { kind: "any" }` : on peut y prendre des outils
d'alchimiste ou de brasseur. Il faut `pool: { kind: "group", group:
"instrument" }`, comme l'historique Artiste. Le pack vit dans Firestore, pas
dans le dépôt : la correction passe par une nouvelle version du pack.

## Campagnes / Aventures

### Révéler manuellement aux joueurs <a id="maj-revelation-manuelle"></a>

Question : les événements, quêtes, etc. peuvent-ils être révélés à la main ?
État actuel :

| Élément             | Révélation manuelle                                                                                                                      | Où                                                                                     |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Quêtes              | Oui, à tout moment (case « Visible des joueurs », bouton œil)                                                                            | `quests-card.tsx` (campagne) et `session-quests-block.tsx`                             |
| Codex               | Oui, bouton « Révéler »                                                                                                                  | `codex-page.tsx` et `session-codex-block.tsx`                                          |
| Événements          | **Seulement en session** : la révélation est rattachée à une session (`setEventRevealed` exige un `sessionId`) et passe par la chronique | `session-events-block.tsx` ; `events-card.tsx` ne fait qu'afficher le badge « Révélé » |
| PNJ, lieux, ennemis | Pas de notion de révélation                                                                                                              | —                                                                                      |

Pistes à trancher :

- Permettre de révéler un **événement hors session** (depuis la fiche
  d'aventure), sans entrée de chronique, ou rattaché à la dernière session.
- **Harmoniser** l'action (même icône, même libellé, même emplacement) sur
  quêtes, codex et événements, et rendre l'état visible d'un coup d'œil côté
  MJ.
- Étendre la révélation aux **PNJ** et **lieux**. Décidé (2026-10-25) :
  - un **lieu** est révélé à un joueur dès qu'il s'y est rendu (le lieu a été
    montré pendant une séance où il était présent) ;
  - un **PNJ** est révélé quand les joueurs le rencontrent : le MJ le révèle,
    comme une entrée du codex.
- Révélation **partielle** (titre visible, détails cachés) ou **ciblée** (à un
  seul joueur) : sans doute plus tard.

Vérifié le 21/10/2026 : toujours à faire. Seul le bloc Récit de la séance révèle un événement (`use-session-story.ts`, `setEventRevealed` exige un `sessionId`) ; la carte Événements de l'aventure n'affiche que le badge.

### Transformer un PNJ en ennemi <a id="maj-pnj-vers-ennemi"></a>

> **Mis de côté** (2026-10-15).

Aujourd'hui `adventure-npc` (nom, personnalité, lore, lieu, couleur de pion) et
`adventure-enemy` (bloc de stats : CA, PV, caractéristiques, attaques, FP…) sont
deux entités **sans passerelle** : un PNJ n'a aucune présence en session de jeu,
et un `session-combatant` ne peut être que `participant` ou `enemy`. Quand un PNJ
devient hostile en cours de partie, le MJ doit recréer une fiche ennemi à la
main.

Objectif : une action **« Promouvoir en ennemi »** sur un PNJ (fiche d'aventure
et/ou vue session MJ) qui pré-remplit le formulaire d'ennemi à partir du PNJ
(nom, couleur, `locationId`, description issue de personnalité + lore) puis
laisse le MJ compléter le bloc de stats — éventuellement via le `monster-picker`
si le PNJ correspond à un monstre du SRD.

Pistes à trancher :

- **Copie** (créer un `adventure-enemy` indépendant, le PNJ reste dans la liste)
  vs **conversion** (le PNJ disparaît au profit de l'ennemi).
- Garder un lien `sourceNpcId` sur l'ennemi pour la traçabilité.
- Variante plus légère : un bloc de stats optionnel directement sur le PNJ, qui
  le rendrait instanciable comme combattant sans passer par `adventure-enemy`.

En partie couvert (PR #217) : un PNJ peut recevoir un « Profil de combat » (un ennemi de l'aventure) et entrer en combat comme allié. Reste la bascule en ennemi hostile.

## Packs de contenu

### Packs publics <a id="maj-packs-publics"></a>

Les packs sont privés ou partagés par lien / invitation. Des **packs publics**
viendraient avec un bouton de signalement. Le prérequis est levé : l'import
refuse désormais les champs inconnus.

Vérifié le 21/10/2026 : rien de commencé (ni champ public sur les packs, ni signalement).

## Interface

### Composants partagés de la maquette <a id="maj-composants-partages"></a>

La maquette Design (canvas « Adventure Keeper ») découpe les pages en 17
composants partagés. Dix existaient déjà dans le code (`Navbar`,
`BreadcrumbsBar`, `CropIcon`, `VitalTile`, `GuidedRail`, `EntityRow`,
`AdventureRow`, `CurrentAdventure` / `LiveBar`, la carte de séance,
`ParticipantMiniCard`). Les sept autres étaient écrits en ligne dans leur page.

Proposé : les sortir en composants, sans rien changer au rendu.

- `AppFooter` (`components/app-footer.tsx`), sorti de `RootLayout`.
- `CampaignListCard` (`components/campaign/campaign-list-card.tsx`), sorti de « Mes campagnes ».
- `CharacterListCard` (`components/character/character-list-card.tsx`), sorti de « Mes personnages ».
- `MemberRow` (`components/campaign/member-row.tsx`), sorti de `MembersCard`.
- `CodexEntryRow` (`components/codex/codex-entry-row.tsx`), sorti de `CodexCard`.
- `QuestRow`, exporté de `quests-card.tsx` (il partage `QuestMark` et `QuestControls` avec la carte).
- `WizardProgress`, exporté de `wizard-screen.tsx` (l'en-tête des assistants).

Vérifié par captures (ordinateur et téléphone ; « Mes campagnes », « Mes
personnages », la campagne vue MJ et joueur, l'assistant de création de
campagne) : rendu identique au pixel près.

### Fiches des compagnons : relecture <a id="maj-fiches-relecture"></a>

✅ (PR #254) « Le groupe » de la campagne, les noms proposés dans
« Participants » et les portraits de la chronique lisaient chaque fiche une fois
et avalaient l'erreur : un échec passager laissait « personnage choisi » à
l'écran jusqu'au rechargement. La lecture est maintenant retentée
(`getCompanionSheet`), et l'échec final est écrit dans la console.

### Erreurs de console <a id="maj-erreurs-console"></a>

✅ (PR #256) Un `<div>` dans un `<p>` (la ligne sous le titre d'une séance,
dans la chronique), et le `<script>` que `next-themes` rend sur chaque page,
déclaré en `application/json` pour rester inerte.

## Sessions en direct

### Serveur de session sur son ordinateur <a id="maj-app-serveur"></a>

Héberger le serveur de session en direct sur son propre ordinateur, sans VPS
ni nom de domaine, avec une petite app rapide à installer, téléchargeable
depuis le site.

Aujourd'hui : le serveur temps réel (`apps/realtime-server`) s'installe sur une
machine joignable depuis Internet, avec un nom de domaine et du HTTPS (Docker +
Caddy, voir `docs/REALTIME_SERVER.md`). Le site étant en `https`, un serveur
simplement lancé sur un PC n'est pas joignable par les navigateurs des joueurs.

Proposé (PR #259, branche `feat/app-serveur-local`) :

- **Adventure Keeper Serveur** (`apps/realtime-desktop`), une fenêtre Tauri qui
  lance le serveur (un exécutable Node autonome) et un **tunnel Cloudflare**
  gratuit : une adresse publique `https://….trycloudflare.com` à chaque
  lancement, sans compte ni réglage de la box. La fenêtre montre l'état,
  l'adresse (« Copier ») et le nombre de connexions ; la fermer arrête le
  serveur.
- **Boîte de lancement** : « Chercher » trouve l'app sur cet ordinateur et
  remplit l'adresse ; lien vers la page de téléchargement.
- **Page `/serveur`** (publique, lien en pied de page) : l'installeur pour le
  système détecté, les autres à côté, la première ouverture (app non signée).
- **Distribution** : tag `serveur-vX.Y.Z` → la CI construit Windows (NSIS),
  macOS Apple Silicon et Intel (DMG), Linux (AppImage, .deb) et publie sur le
  dépôt public `TheComics/adventure-keeper-serveur`.

- **Plus de données par la salle** : l'état de jeu des personnages (PV,
  emplacements, jets…) et la présence passent par le serveur ; l'onglet du MJ
  les recopie dans Firestore toutes les 5 minutes et à la fin de la séance.
  Jetons et ±PV partent à chaque geste (plus de regroupement).

Décisions : tunnel Cloudflare (plutôt que réseau local ou MJ seul) ; Windows,
macOS et Linux ; fenêtre native Tauri ; installeurs sur un dépôt public dédié
(le dépôt principal est privé).

Reste à faire :

- Créer le dépôt public `TheComics/adventure-keeper-serveur` (avec un premier
  commit, un README suffit) ✅, puis la GitHub App de publication
  (`SERVEUR_APP_ID`, `SERVEUR_APP_PRIVATE_KEY`).
- Premier build CI et essai de l'app sur chaque système.
- Plus tard : signer les apps (Windows, Apple) pour supprimer l'avertissement
  à la première ouverture.

### Le serveur, seule voie de la session <a id="maj-serveur-seul"></a>

Rémi veut que démarrer une séance passe toujours par le serveur temps réel,
quitte à retravailler lourdement le fonctionnement. Décidé le 12 novembre
2026 : un **serveur officiel** hébergé par Rémi (VPS, Docker + Caddy) est le
serveur par défaut, le site y pointe sans réglage ; « mon serveur » (app de
bureau ou VPS perso) reste une option avancée, même code. À terme, le serveur
officiel pourra porter une **limite de temps** et des **abonnements**.

État actuel :

- Deux modes choisis au lancement : Firestore (par défaut) ou un serveur que
  le MJ héberge (app de bureau + tunnel, ou VPS). Même interface d'écriture
  (`lib/live-store.ts`), mais des ternaires `realtime ? … : …` dans la page,
  la carte et la vue joueur, et deux politiques de regroupement des écritures.
- La salle ne tient que les combattants, le combat, la brume et l'état de jeu
  des personnages. Lieu, horloge, document montré, butin, présence Firestore
  (`connectedUids`) restent sur le doc session.
- Le serveur ne parle jamais à Firestore : c'est l'onglet du MJ qui recopie
  (personnages toutes les 5 min, le reste à la fin). Un onglet MJ fermé
  brutalement laisse combattants, combat et brume non recopiés.
- Compatibilité avec d'anciens serveurs (sans brume, sans personnages) codée
  dans le client et la salle.

Proposé :

- Un seul chemin d'écriture : supprimer `firestoreLiveStore`, les tampons à
  300/800 ms de ce que la salle porte, `subscribeCombatants`,
  `connectedUids`, et la compatibilité ascendante.
- La salle porte tout ce qui bouge pendant la séance, lieu affiché, horloge
  et document montré compris ; Firestore garde ce que les autres pages
  lisent (statut, numéro, présents, lieux visités, butin, vaincus, résumé)
  et reçoit un instantané à intervalle régulier et à la fin.
- Le serveur recopie lui-même dans Firestore, par l'API REST avec le jeton
  Firebase du MJ (règles appliquées, aucun secret sur le serveur), pour ne
  plus dépendre de l'onglet du MJ ; le client renvoie un jeton frais avant
  son expiration.
- Protocole revu autour d'un état et de patches typés, avec une table de
  droits, pour accueillir pings, curseurs et dés partagés sans une op par type.
- Règles Firestore allégées : les combattants et `mapReveals` ne sont plus
  écrits que par le serveur ou le MJ.

Décidé : serveur officiel par défaut, « mon serveur » en option avancée
(voir ci-dessus). Pour les limites et abonnements à venir, le serveur
identifie déjà le MJ (uid du jeton) : les droits d'abonnement passeront par
des _custom claims_ Firebase, lus dans le jeton, et la salle gardera qui l'a
ouverte et quand.

À trancher :

- Le serveur écrit-il dans Firestore (jeton du MJ par REST), ou reste-t-on
  sur l'onglet du MJ ?
- Un serveur officiel par projet Firebase (production, staging), ou un seul
  qui accepte les deux projets ?
- Déploiement du serveur officiel : à la main, ou depuis le workflow de
  publication (#271) vers le VPS.
- Faut-il garder les séances déjà jouées en mode Firestore lisibles telles
  quelles (chronique, reprise) ? A priori oui : la reprise lit Firestore.
- Mode émulateur en développement et en E2E : `pnpm dev` et Playwright
  lancent déjà le serveur ; tous les scénarios de session devront le prendre.

### Projeter la carte depuis un joueur <a id="maj-projection-joueur"></a>

Deux joueurs dans la même pièce : l'un met la carte sur l'écran (son
ordinateur, une TV) et joue depuis son téléphone.

État actuel :

- L'onglet `…/session/:id/carte` marchait déjà pour un joueur, mais seul le
  MJ avait « Projeter la carte » dans le menu ; le joueur passait par
  « Ouvrir dans un onglet → Carte ».
- Les onglets d'une session se repèrent par des verrous du navigateur, donc
  dans un seul navigateur : l'ordinateur ne voit pas la vue complète ouverte
  sur le téléphone. La carte du joueur affichait alors « La vue principale est
  fermée » par-dessus la carte ; seule la projection du MJ en était dispensée.

Fait :

- Plus de bandeau sur l'onglet `carte`, MJ comme joueur
  (`pages/sessions/game-session.tsx`).
- « Projeter la carte » dans le menu de la carte du joueur, à la place de
  « Ouvrir dans un onglet → Carte » (`player-session-view.tsx`).
- Scénario E2E dans `e2e/13-live-session.spec.ts` (onglets détachés).

## Système de règles

### Règles et contenu séparés <a id="maj-regles-et-contenu"></a>

Garder la 5e 2024 comme système de l'application, avec sa fiche, son assistant
et sa session sur mesure, mais séparer l'application, les règles
essentielles (le moteur, du code) et le contenu (le SRD et les packs, des
données).

Plan complet : [`docs/RULES_AND_CONTENT.md`](docs/RULES_AND_CONTENT.md).

État actuel :

- **Moteur et contenu sont mêlés** dans `packages/system-dnd2024` ; une
  partie du contenu est dans `apps/web/src/data`.
- **L'application importe le paquet partout** : une centaine de fichiers de
  `apps/web`, 15 de `packages/schemas`, et des tests `system === "dnd2024"`.
- **Les effets des capacités sont déjà des données** (`mechanics`, `uses`,
  `roll`), rangées à part dans `feature-rules.ts`.
- **18 endroits testent le nom d'une classe** (occultiste, roublard, barde,
  moine, druide, paladin, rôdeur, barbare).
- **Les packs ne couvrent pas** les classes, les armes, les armures,
  l'équipement ni les langues. La liste des classes est fermée.

Décisions (2026-11-11) :

- **Le système actuel est conservé** : 5e 2024 reste codé, rendu sur mesure.
- **Une frontière** : l'application passe par une interface « système ».
- **Le SRD devient le pack de base** : tout le contenu sort du code.
- **Où vont les capacités** : leurs effets sont du contenu, portés par la
  capacité. Un cas qui ne rentre pas dans le vocabulaire devient, dans
  l'ordre : un nouveau type d'effet du moteur s'il est calculable et
  réutilisable ; un module du moteur réglé par la classe s'il s'agit d'une
  mécanique entière (sorts, forme sauvage, invocations) ; sinon un rappel
  textuel.

- **Les packs des utilisateurs peuvent ajouter des classes.**
- **Un pack ne modifie pas les règles de base** : il ajoute, sans remplacer
  ni retirer une entrée du SRD.
- **Une campagne 5e a toujours le pack de base** ; il ne se désactive pas.
- **Le format reste `ak-pack/1`** : les nouveaux types sont des ajouts
  facultatifs, sans conversion des packs existants.
- **Les illustrations sont fournies par l'auteur du pack** : champ `imageUrl`
  facultatif sur les classes, espèces, historiques et sous-classes. Sans lui,
  le carré teinté actuel reste. Rémi fournira celles du pack de base.

Lots :

1. La frontière. **Fait** (fusionné dans `chore/depot-public`) :
   - ✅ Module `apps/web/src/systems` : `RulesSystem` répond aux questions,
     `SystemScreens` fournit les écrans (fiche, édition, création, carte de
     la liste, panneau du joueur en session).
   - ✅ Le code qui connaît la 5e est dans `systems/dnd2024`.
   - ✅ Lint : le paquet 5e ne s'importe que depuis ce dossier ; le dossier
     ne s'importe pas depuis le reste de l'application, hors les 37 fichiers
     listés dans `eslint.system-boundary.mjs`.
   - ✅ Plus aucun écran générique ne teste le système.
   - ✅ `localized` sorti de `packages/schemas` : nouveau paquet
     `packages/locale`.
   - ✅ 80 scénarios de bout en bout verts ; 40 captures comparées avant et
     après, téléphone et ordinateur.
   - Décidé (2026-11-13) : ennemis, états, butin et packs restent façonnés
     par la 5e et lisent `systems/dnd2024/vocabulary.ts`.
   - Décidé (2026-11-13) : `packages/schemas` garde sa dépendance au paquet
     5e pour la forme des documents ; seul `localized` en sort.
2. Des classes décrites en données. **Fait** (fusionné dans `chore/depot-public`) :
   - ✅ Plus aucun test sur un nom de classe : la classe déclare ses
     mécaniques (sorts, expertise, arts martiaux, forme sauvage,
     invocations, Savoir primal).
   - ✅ `classId` accepte une entrée de pack.
   - Reporté au lot 3 : les effets de `feature-rules.ts` rangés sur les
     capacités.
3. Le SRD en pack de base. **Fait** (`chore/depot-public`) :
   - ✅ Le format couvre tout le SRD : nouveaux types `classes`,
     `invocations`, `languages`, `weapons`, `armors`, `gear`,
     `equipmentPacks` ; une classe de pack se crée, monte de niveau et joue
     (scénario de bout en bout).
   - ✅ Le SRD est écrit dans ce format, avec son anglais, dans
     `packages/system-dnd2024/src/srd` ; `apps/web/src/data` y est passé ;
     `SRD_PACK` passe l'import des packs tel quel.
   - ✅ Les effets de `feature-rules.ts` sont sur les capacités ; ce fichier
     et les fichiers anglais du moteur ont disparu.
   - ✅ `imageUrl` sur les classes, espèces, historiques et sous-classes.
   - ✅ Vérifié : fiche dérivée identique avant et après pour 864
     combinaisons classe × espèce × niveau, en français et en anglais.
   - Correctifs trouvés en route : la copie des entrées de pack gardée sur la
     fiche oubliait la classe ; le matériel d'un paquetage de pack aussi.
4. Ménage de la documentation. **Fait** : `CONTENT_PACKS.md` (tous les types,
   le SRD pack de base), `FEATURE_EFFECTS.md`, `FIRESTORE.md`, `I18N.md`,
   `RULES_AND_CONTENT.md`.

### Systèmes de règles créés par le MJ <a id="maj-systemes-de-regles"></a>

Un MJ crée son propre système de règles dans l'application et le partage à
ses joueurs : composition de la fiche, déroulement de la création, règles de
session.

**Mis de côté le 2026-11-11.** Réexprimer la 5e dans un format générique
coûtait un long chantier et une fiche moins soignée. L'étude est gardée dans
[`docs/RULE_SYSTEMS.md`](docs/RULE_SYSTEMS.md) (format `ak-system/1`, lots,
risques). La frontière posée par « Règles et contenu séparés » permettra d'y
revenir sans tout reprendre, par exemple avec des systèmes génériques à côté
de la 5e.

## Déploiement

### Déploiement de staging <a id="maj-deploiement-staging"></a>

Rémi crée un projet Firebase de staging ; la CI doit y déployer.

État actuel :

- Un push sur `staging` ne lançait que la CI ; seul `main` déployait, avec des
  secrets au niveau du dépôt (projet `adv-keeper`).

Proposé :

- Environnements GitHub `staging` et `production`, chacun avec ses secrets ;
  les workflows de déploiement prennent `environment` en paramètre.
- `staging.yml` déploie règles puis Hosting sur le projet de staging.
- `firebase.json` ne fixe plus `site`.

- Application serveur : le projet Firebase est fixé à la compilation ; un push
  sur `staging` construit une variante « Staging » (autre identifiant) et la
  publie dans la pré-version `staging` du dépôt des installeurs ; le site de
  staging y pointe. Décidé : option « variante compilée » plutôt qu'un serveur
  lancé à la main.

À faire par Rémi : créer les environnements et leurs secrets, activer
Hosting et Firestore sur le projet de staging, donner les rôles à son compte
de service (voir `docs/DEPLOYMENT.md`).

### Staging et e2e des PR en pause <a id="maj-pause-staging"></a>

Rémi met le staging en pause et allège les PR, sans supprimer les workflows.

- `staging.yml` : plus de déclencheur au push sur `staging`, lancement manuel
  seulement (`workflow_dispatch`). Lancé à la main, il construit aussi l'app
  serveur de staging.
- `pull-request.yml` : seules les PR vers `main` lancent la CI ; le job `e2e`
  est en commentaire. Les e2e tournent toujours au push sur `main`, avant le
  déploiement (`main.yml`), et à la main.
- Pour réactiver : les lignes à rétablir sont en commentaire dans chaque
  fichier.

### Semer le staging <a id="maj-semer-staging"></a>

Le projet de staging est vide ; Rémi veut y retrouver les données du seed.

Proposé et décidé :

- `scripts/seed.ts --project <id> --yes` : mode distant, qui refuse la
  production et n'efface que les `seed-*`.
- Un compte de service dédié (Datastore User, Firebase Authentication Admin),
  pas celui de la CI.
- Mot de passe aléatoire ou `SEED_PASSWORD`, jamais `test1234` en distant.

À faire par Rémi : créer le compte de service et sa clé, puis lancer la commande
de `docs/DEPLOYMENT.md` §5.4.

### Publication du serveur à chaque merge <a id="maj-serveur-release-main"></a>

Rémi a mergé sur `main` et attendait des installeurs du serveur : rien n'a
tourné.

État actuel :

- `release-serveur-reusable.yml` ne publiait en production que sur un tag
  `serveur-vX.Y.Z` (jamais poussé) ; `main` n'était pas écouté.

Proposé :

- Écouter `main` (mêmes chemins que `staging`), canal `production`.
- Version calculée au début du run : `version` de `tauri.conf.json` est un
  plancher, la release prend le plus grand entre ce plancher et la dernière
  release publiée plus un correctif ; passée à `tauri build --config`.
- Le commit publié reçoit le tag `serveur-vX.Y.Z` ; un run à la fois par
  canal.
- Le workflow devient réutilisable, appelé par `main.yml` après CI et
  tests de bout en bout, et par `staging.yml` après la CI : les installeurs
  sortent d'un `main` vert, en parallèle du déploiement du site.

Décidé : version auto-incrémentée plutôt qu'une release « latest » écrasée,
pour garder l'historique des versions côté MJ. Le déclencheur par tag est
retiré. Décidé : une seule pipeline par branche plutôt qu'un workflow serveur
à part (il publiait sans attendre les gardes de `main`).

### Noms des workflows <a id="maj-noms-workflows"></a>

Rémi relève que `ci-main.yml` et `ci-staging.yml` font de la CI, du
déploiement et une release : le préfixe ne dit que la première moitié, et
trois façons de nommer cohabitent (`ci-…`, `firebase-…`, `…-reusable`).

Décidé : les points d'entrée portent le nom de ce qui les déclenche
(`pull-request.yml`, `main.yml`, `staging.yml`), les briques un verbe et leur
nature (`deploy-hosting-reusable.yml`, `deploy-firestore-reusable.yml`,
`release-serveur-reusable.yml`, `deploy-hosting-manual.yml`,
`deploy-firestore-manual.yml`). `ci-reusable.yml` et `e2e-reusable.yml` ne
changent pas. L'historique des runs reste visible sous les anciens noms.

### Tag de release refusé <a id="maj-serveur-tag-refuse"></a>

Le premier run de production (#271) a publié `v0.1.1` mais échoué sur le tag
`serveur-v0.1.1` : 403 « Resource not accessible by integration », alors que
le jeton avait `contents: write`.

Constaté par essais : le jeton du run ne peut poser un tag que sur un commit
qui est encore la tête d'une branche, ou dont les fichiers de workflows sont
ceux de `main`. Le merge de #272 (renommage des workflows) avait atterri
pendant le build de #271.

Décidé : l'étape de tag ne fait plus échouer le run, elle émet un
avertissement ; les notes de la release nomment le commit. Si le tag devient
indispensable, installer la GitHub App des releases sur ce dépôt aussi, avec
la permission « Workflows », et poser le tag avec son jeton.

### Dépôt public <a id="maj-depot-public"></a>

Le quota gratuit de GitHub Actions d'une organisation (2 000 minutes et 500 Mo
pour un dépôt privé) est épuisé : plus de déploiement. Un dépôt public a des
minutes illimitées. Rémi repart d'**un dépôt neuf, public, sur son profil**,
avec un seul commit initial ; l'ancien dépôt reste privé, en archive.

État actuel :

- Aucun secret dans l'arbre ni dans l'historique (vérifié) ; les secrets de CI
  sont dans GitHub.
- Pas de fichier `LICENSE` ni de champ `license` dans les `package.json`.
- L'historique contient le contenu hors SRD retiré du code (36 sous-classes,
  58 dons, 30 sorts, 12 historiques, Aasimar, 6 monstres, 2 jeux) : résumés
  courts, sans texte de règles, mais à ne pas publier
  (`docs/LICENSING_AUDIT.md`).
- Les installeurs du serveur sont publiés dans un dépôt public séparé,
  `adventure-keeper-serveur`, via une GitHub App.
- Le dépôt compte 74 mentions de « D&D » ou « Player's Handbook ».

Décidé :

- **Dépôt neuf**, un seul commit initial, auteur avec l'adresse noreply de
  GitHub (l'historique n'est donc pas repris, ni les adresses des auteurs).
- **Licence non commerciale** : PolyForm Noncommercial 1.0.0 (code lisible,
  usage commercial interdit, droits réservés à Rémi). L'attribution SRD
  CC-BY-4.0 reste à part, dans le README et sur `/credits`.
- **Installeurs dans le même dépôt** : le dépôt étant public, les releases y
  vont directement. La GitHub App et le dépôt `adventure-keeper-serveur`
  disparaissent ; le jeton du workflow (`contents: write`) suffit.

- **Nettoyage** : `docs/LICENSING_AUDIT.md` supprimé (la mention SRD reste
  dans le README et sur `/credits`), ainsi que les trois scripts de migration
  ponctuels (`packs:migrate`, `characters:migrate-campaigns`,
  `characters:migrate-belongings`) et leurs passages dans `docs/`.
- `LICENSE` et champ `license` des `package.json` : faits.

Proposé :

- ~~Ajouter `LICENSE`~~ et `license` dans les `package.json`.
- ~~Remplacer « D&D 2024 » par « 5e 2024 »~~ : fait, dans les commentaires et
  la doc (aucune chaîne d'interface n'en contenait). Les identifiants `dnd2024`
  restent : ils sont stockés sur les fiches.
- ~~Workflow de release~~ : fait. Les installeurs vont dans les releases du
  dépôt, avec le jeton du workflow ; la release de production reprend le tag
  `serveur-vX.Y.Z`, la pré-version de staging s'appelle `serveur-staging` (un
  tag `staging` entrerait en conflit avec la branche). Liens du site et badges
  du README pointent vers `Smooth-Tech-Studio/adventure-keeper` (le dépôt actuel est renommé pour libérer le nom).
- Actions : approbation obligatoire pour les contributeurs externes ;
  `pull_request` (jamais `pull_request_target`) pour la CI des PR.
- Protéger `main` : PR obligatoire, CI verte requise.

- ✅ Règles du dépôt : `.github/CODEOWNERS` (équipe `maintainers`) ; la CI
  des PR vers `main` tourne aussi sur une PR de documentation, pour que le
  contrôle exigé ne reste jamais en attente.
- ✅ Plus de « dnd » visible : fichiers de pack et de campagne en « 5e »
  (anciennes valeurs encore lues), lien de l'accueil `?system=5e`.

À faire par Rémi : créer le dépôt, recréer les environnements `staging` et
`production` avec leurs secrets, faire tourner la clé du compte de service
Firebase, supprimer la GitHub App et le dépôt `adventure-keeper-serveur`, mettre l'ancien dépôt en
archive privée, prévenir `LucieB-coder` que son code (7 commits) passe sous
cette licence.
