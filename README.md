# adventure-keeper

A collaborative web platform for tabletop role-playing games, helping groups
manage campaigns, characters, sessions, notes, and shared game resources in one
place.

> **Backlog / retours à trier :** [INCOMING_UPDATES.md](INCOMING_UPDATES.md)
> (notes brutes, non priorisées).

## État de la CI

- **Production** (`main`) : CI, tests de bout en bout, puis déploiement.
  [![CI et déploiement (main)](https://github.com/Smooth-Tech-Studio/adventure-keeper/actions/workflows/main.yml/badge.svg?branch=main)](https://github.com/Smooth-Tech-Studio/adventure-keeper/actions/workflows/main.yml?query=branch%3Amain)
- **Staging** (`staging`) : en pause, lancement manuel seulement. CI, puis
  déploiement du projet Firebase de staging.
  [![CI et déploiement (staging)](https://github.com/Smooth-Tech-Studio/adventure-keeper/actions/workflows/staging.yml/badge.svg?branch=staging)](https://github.com/Smooth-Tech-Studio/adventure-keeper/actions/workflows/staging.yml?query=branch%3Astaging)

Chaque pastille montre le dernier run de la branche : verte quand toutes les
étapes ont réussi, rouge sinon. Un clic ouvre les runs. Les deux pipelines
construisent et publient aussi l'app serveur (installeurs en release) quand le
push touche le serveur, l'app ou les schémas ; sa version se calcule à chaque
run (voir `docs/REALTIME_SERVER.md`).

## Monorepo

pnpm workspaces + Turborepo.

```
adventure-keeper/
├── apps/
│   ├── web/                 # Front-end : Vite + React + TS + Tailwind v4 + shadcn/ui
│   │                        # Hébergé sur Firebase Hosting. Auth + Firestore.
│   └── realtime-server/     # Serveur temps réel self-host (Node + WebSocket), facultatif
│                            # Une salle par session : jetons, PV, combat. Voir docs/REALTIME_SERVER.md
├── packages/
│   ├── schemas/             # @adventure-keeper/schemas
│   │                        # Schémas Zod + types du modèle Firestore (agnostique du système de jeu)
│   └── system-dnd2024/      # @adventure-keeper/system-dnd2024
│                            # Données SRD 5.2 (espèces, classes…) + moteur de création de perso 5E (2024)
├── firebase.json            # Hosting + Firestore + émulateurs
├── firestore.rules          # Règles de sécurité Firestore
├── firestore.indexes.json   # Index composites
├── .github/workflows/       # CI + déploiement Hosting (prod + previews) + rules/index Firestore
├── scripts/
│   └── seed.ts              # Données de test pour les émulateurs (pnpm emulators:seed)
├── docs/
│   ├── FEATURE_EFFECTS.md   # Effets des capacités : ce qui est appliqué, ce qui reste
│   ├── IMAGE_STORAGE.md     # Import des images vers le Dropbox du joueur (mise en place)
│   ├── DEPLOYMENT.md        # Mise en place Firebase + pipeline, pas à pas
│   └── FIRESTORE.md         # Modèle de données
├── INCOMING_UPDATES.md      # Backlog : idées / retours à trier (notes brutes)
└── turbo.json
```

## Démarrage rapide

```bash
pnpm install
pnpm dev              # émulateurs Firebase + front → http://localhost:5173
pnpm emulators:seed   # (autre terminal) crée les comptes / personnages / campagnes de test
```

`pnpm dev` lance les **émulateurs Firebase** (Auth + Firestore) et le front ensemble.
Le front s'y connecte automatiquement via `apps/web/.env.development` — aucun projet
Firebase réel n'est nécessaire. Prérequis : **Java** (émulateur Firestore) ; le CLI
`firebase` est une dépendance de développement, installée par `pnpm install`.
Interface des émulateurs : <http://127.0.0.1:4000>.

`pnpm dev:https` fait la même chose mais sert le front en **HTTPS** (certificat
auto-signé — à accepter une fois dans le navigateur), utile pour les fonctions à
« contexte sécurisé » (WebAuthn, service workers…). Les émulateurs restent en
`http://127.0.0.1` (autorisé depuis une page HTTPS car loopback).

### Comptes de test (`pnpm emulators:seed`)

Mot de passe commun : **`test1234`**. Le script est idempotent (chaque exécution
remet l'état à zéro).

| Compte           | Rôle                                                                                       |
| ---------------- | ------------------------------------------------------------------------------------------ |
| `alice@test.dev` | MJ de « La Crypte oubliée » (aventure « L'entrée de la crypte » active) + joueuse chez Bob |
| `bob@test.dev`   | MJ de « Rumeurs à la taverne » + joueur chez Alice                                         |
| `carol@test.dev` | joueuse chez Alice                                                                         |

4 personnages sont créés (Elfe roublard, Nain guerrier, Humaine magicienne, Humain clerc).

### Développer contre un vrai projet Firebase

Copier `apps/web/.env.example` vers `apps/web/.env.local` (git-ignoré, prioritaire
clé par clé sur `.env.development`), y mettre les 6 valeurs Firebase **et**
`VITE_FIREBASE_USE_EMULATORS=false`, puis `pnpm dev:app` (front + `schemas`, sans
émulateurs).

Voir **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)** pour créer le projet Firebase,
récupérer les identifiants et configurer le déploiement continu.

## Scripts (racine)

| Commande                     | Effet                                                           |
| ---------------------------- | --------------------------------------------------------------- |
| `pnpm dev`                   | émulateurs Firebase **+** `schemas` (watch) **+** front (watch) |
| `pnpm dev:https`             | comme `pnpm dev`, front servi en HTTPS (cert auto-signé)        |
| `pnpm dev:app`               | front + `schemas` seuls (émulateurs exclus)                     |
| `pnpm emulators`             | émulateurs Auth + Firestore                                     |
| `pnpm emulators:seed`        | remplit les émulateurs de données de test (idempotent)          |
| `pnpm build`                 | build de tous les packages (Turborepo)                          |
| `pnpm typecheck`             | `tsc --noEmit` sur tout le monorepo                             |
| `pnpm lint`                  | ESLint (flat config, `typescript-eslint` + `react-hooks`)       |
| `pnpm test`                  | Vitest (fonctions pures : règles perso, XP, items…)             |
| `pnpm format`                | Prettier --write                                                |
| `pnpm firebase:deploy:rules` | déploie règles + index Firestore                                |

## Stack

- **Front** : Vite 6, React 19, TypeScript, React Router 7
- **UI** : Tailwind CSS v4, shadcn/ui (style _new-york_), lucide-react, sonner
- **Formulaires** : react-hook-form + zod
- **Backend** : Firebase Authentication (e-mail/mot de passe) + Cloud Firestore
- **Hébergement** : Firebase Hosting
- **CI/CD** : GitHub Actions + `FirebaseExtended/action-hosting-deploy`

## Pages

| Route                                                       | Page                                                                                 | Auth     |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------ | -------- |
| `/`                                                         | Accueil (présentation)                                                               | publique |
| `/login`                                                    | Connexion                                                                            | publique |
| `/signup`                                                   | Création de compte                                                                   | publique |
| `/campaigns`                                                | Mes campagnes (liste)                                                                | connecté |
| `/campaigns/new`                                            | Créer une campagne (→ MJ)                                                            | connecté |
| `/campaigns/:id`                                            | Détail campagne : membres, personnage du membre, aventures                           | connecté |
| `/campaigns/:id/adventures/new`                             | Créer une aventure (MJ)                                                              | connecté |
| `/campaigns/:id/adventures/:adventureId`                    | Détail aventure : participants, lieux, « Démarrer la session »                       | connecté |
| `/campaigns/:id/adventures/:adventureId/session/:sessionId` | Session de jeu en direct                                                             | connecté |
| `…/session/:sessionId/:pane`                                | Un seul bloc de la session, plein écran, sans navbar (`carte`, `carte-mj`, `outils`) | connecté |
| `/characters`                                               | Mes personnages (liste)                                                              | connecté |
| `/characters/new`                                           | Créer un personnage (5E 2024 ou standard)                                            | connecté |
| `/characters/:id/edit`                                      | Modifier une fiche (propriétaire)                                                    | connecté |

Les routes `connecté` redirigent vers `/login` si l'utilisateur n'est pas
authentifié (`ProtectedRoute`). La barre de navigation affiche une icône de
connexion en haut à droite quand l'utilisateur est déconnecté, et les liens
Campagnes / Personnages + un menu de compte (avatar) sinon.

Création / édition de personnage (**5E 2024**, même formulaire) : espèce /
classe / historique / alignement **non pré-remplis** ; **niveau** 1–20
(sélecteur, alimente PV max / bonus de maîtrise) ; caractéristiques de base
saisies à la main avec bouton « Valeurs conseillées » (tableau standard de la
classe) et aide Point Buy ; bonus d'historique `+2/+1` ou `+1/+1/+1` ; valeurs
ajustées, modificateurs, PV max et bonus de maîtrise recalculés en direct ;
**langues maîtrisées** (liste 5E (2024) non modifiable, popup d'ajout ;
Commun + langue d'espèce + langue de classe accordées automatiquement) ;
**sorts** pour les classes lanceuses (sorts mineurs + sorts à emplacement,
limite selon classe et niveau, popup de sélection filtré par classe, « carte »
métadonnées au clic) ; listes armes / armures / inventaire éditées via popup
(crayon pour rouvrir, poubelle rouge pour supprimer, une seule arme
principale) ; couleur ; image via un **lien** (URL) avec sélection d'une zone
carrée comme icône. Données de référence dans `@adventure-keeper/schemas`
(`src/dnd/` : espèces, classes, historiques, langues, sorts + limites de
lancement de sorts).

**Session de jeu en direct.** Le MJ crée des aventures dans une campagne, y
ajoute des participants (membres ayant choisi un personnage), des lieux et des
ennemis, puis **démarre une session** depuis l'aventure. Les participants
**rejoignent** la session.

- **Carte du lieu + jetons** : la carte du lieu courant (choisi par le MJ)
  avec un jeton par combattant placé ; le MJ déplace les jetons à la souris /
  au doigt (position stockée en fractions 0–1, synchro temps réel).
- **Liste des combattants** : participants + ennemis, avec PV/PVmax (+/− pour
  le MJ), CA, couleur ; le MJ ajoute au combat, place/retire de la carte,
  retire.
- **Panneau du personnage** (joueur) : PV avec +/−, CA, équipement de la
  fiche, notes de session éditables, calculateur
  de modificateur de jet (d20).
- **Pilotage MJ** : pause / reprise / fin, lieu courant, horloge en jeu, liste
  des connectés.

- **Onglets détachés** : la carte (vue joueurs, ou vue MJ éditable) ou les
  outils (panneau MJ, fiche joueur) s'ouvrent seuls dans un autre onglet, en
  plein écran — pour un 2e écran ou la TV de la table (« Projeter la carte »,
  bouton plein écran). Les outils s'adaptent à la largeur disponible (1 à 3
  colonnes). Les onglets d'un même navigateur se voient (Web Locks,
  `hooks/use-session-tabs.ts`) : la page principale retire ce qui est ouvert
  ailleurs et le réaffiche à la fermeture ; on ne quitte la session qu'en
  fermant le dernier onglet.
- **Affichage par appareil** : masquer la carte (téléphone du joueur à la
  table), la liste des joueurs ou le panneau MJ — mémorisé en `localStorage`.

Tout passe par Firestore `onSnapshot` (temps réel, sans backend dédié). Une
piste de serveur temps réel, pour sortir l'état vivant de Firestore et ses
quotas, est décrite dans [`docs/REALTIME_SERVER.md`](docs/REALTIME_SERVER.md).

## Crédits

Compatible avec la cinquième édition. Cette œuvre inclut du matériel issu du
System Reference Document 5.2.1 (« SRD 5.2.1 ») de Wizards of the Coast LLC,
disponible à l’adresse https://www.dndbeyond.com/srd. Le SRD 5.2.1 est régi
par la Licence Creative Commons Attribution 4.0 International, disponible à
l’adresse https://creativecommons.org/licenses/by/4.0/legalcode.

La même mention est affichée dans l'application, page `/credits` (lien en pied
de page).
