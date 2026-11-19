# Adventure Keeper

[![CI et déploiement](https://github.com/Smooth-Tech-Studio/adventure-keeper/actions/workflows/main.yml/badge.svg?branch=main)](https://github.com/Smooth-Tech-Studio/adventure-keeper/actions/workflows/main.yml?query=branch%3Amain)
[![Licence : PolyForm Noncommercial 1.0.0](https://img.shields.io/badge/licence-PolyForm%20Noncommercial%201.0.0-blue)](LICENSE)

Une plateforme web pour les tables de jeu de rôle : campagnes, personnages,
aventures et sessions en direct, au même endroit pour le MJ et ses joueurs.
Compatible avec la cinquième édition (SRD 5.2.1), avec aussi une fiche libre
pour les autres jeux.

**Site : <https://adv-keeper.smthstd.fr>**

## Fonctionnalités

- **Création de personnage guidée** (5e 2024) : classe, espèce, historique,
  caractéristiques, sorts, équipement, avec les valeurs de la fiche calculées
  en direct. Essayable sans compte.
- **Fiche de personnage** calculée (CA, PV, attaques, sauvegardes, capacités),
  modifiable bloc par bloc, avec montée de niveau guidée. Une fiche libre
  existe pour les autres systèmes.
- **Campagnes et aventures** : membres, lieux, PNJ, ennemis tirés du bestiaire,
  quêtes, codex et chronique, import et export en fichier.
- **Sessions en direct** : carte et jetons partagés, combat et initiative,
  brume de guerre, dés, onglets détachés pour un second écran ou la TV de la
  table. Le serveur de session peut tourner sur l'ordinateur du MJ (app
  **Adventure Keeper Serveur**, Windows, macOS, Linux).
- **Packs de contenu** : une table ajoute ses propres classes, espèces, sorts,
  monstres, objets… au format `ak-pack/1`, par-dessus le SRD, qui est lui-même
  écrit dans ce format.
- **Français et anglais.**

## Démarrage rapide

Prérequis : **Node 26** (voir `.nvmrc`), **pnpm 11** (`corepack enable`) et
**Java** pour l'émulateur Firestore.

```bash
pnpm install
pnpm dev              # émulateurs Firebase + application → http://localhost:5173
pnpm emulators:seed   # dans un autre terminal : comptes, personnages et campagnes de test
```

`pnpm dev` démarre les émulateurs Firebase (Auth et Firestore) et l'application,
qui s'y connecte d'elle-même : aucun projet Firebase n'est nécessaire.
L'interface des émulateurs est sur <http://127.0.0.1:4000>.

Le seed crée trois comptes, `alice@test.dev`, `bob@test.dev` et
`carol@test.dev` (mot de passe `test1234`), avec leurs personnages et deux
campagnes. Le parcours de test est décrit dans
[`docs/SEED_SCENARIO.md`](docs/SEED_SCENARIO.md).

Pour développer contre un vrai projet Firebase, copier `apps/web/.env.example`
vers `apps/web/.env.local`, le remplir, puis lancer `pnpm dev:app`. Le détail,
et la mise en place du déploiement, sont dans
[`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).

## Commandes

| Commande              | Effet                                                                 |
| --------------------- | --------------------------------------------------------------------- |
| `pnpm dev`            | Émulateurs + application, en rechargement à chaud                     |
| `pnpm dev:app`        | Application seule, contre le projet de `apps/web/.env.local`          |
| `pnpm dev:https`      | Comme `pnpm dev`, servi en HTTPS (certificat auto-signé)              |
| `pnpm dev:expose`     | Comme `pnpm dev`, ouvert au réseau local (pour essayer sur un mobile) |
| `pnpm emulators:seed` | Remplit les émulateurs de données de test (relançable)                |
| `pnpm build`          | Construit tous les paquets (Turborepo)                                |
| `pnpm typecheck`      | Vérifie les types de tout le dépôt                                    |
| `pnpm lint`           | ESLint                                                                |
| `pnpm format`         | Prettier                                                              |
| `pnpm test`           | Tests unitaires (Vitest)                                              |
| `pnpm test:e2e`       | Tests de bout en bout (Playwright, avec leurs propres émulateurs)     |

## Structure du dépôt

Monorepo pnpm + Turborepo.

```
apps/
  web/                React + Vite + Tailwind + shadcn/ui, hébergé sur Firebase Hosting
  realtime-server/    Serveur de session en direct (Node + WebSocket)
  realtime-desktop/   Adventure Keeper Serveur : ce serveur dans une app de bureau (Tauri)
packages/
  system-dnd2024/     Moteur de règles 5e 2024, format des packs et pack de base du SRD (src/srd)
  schemas/            Schémas Zod et types du modèle de données Firestore
  locale/             Langue courante et outils de traduction partagés
e2e/                  Scénarios de bout en bout (Playwright)
scripts/              Seed des émulateurs, export des catalogues
docs/                 Documentation technique
firestore.rules       Règles de sécurité Firestore
```

Pile : React 19, React Router 7, Vite 8, Tailwind CSS 4, shadcn/ui, Zod 4,
i18next, Firebase (Authentication, Firestore, Hosting), Tauri, GitHub Actions.

## Documentation

| Document                                            | Sujet                                                   |
| --------------------------------------------------- | ------------------------------------------------------- |
| [`DEPLOYMENT.md`](docs/DEPLOYMENT.md)               | Projets Firebase, environnements et déploiement continu |
| [`FIRESTORE.md`](docs/FIRESTORE.md)                 | Modèle de données                                       |
| [`CONTENT_PACKS.md`](docs/CONTENT_PACKS.md)         | Format des packs de contenu et pack de base du SRD      |
| [`FEATURE_EFFECTS.md`](docs/FEATURE_EFFECTS.md)     | Ce que chaque capacité du SRD applique sur la fiche     |
| [`RULES_AND_CONTENT.md`](docs/RULES_AND_CONTENT.md) | Séparation entre l'application, le moteur et le contenu |
| [`REALTIME_SERVER.md`](docs/REALTIME_SERVER.md)     | Serveur de session en direct et app de bureau           |
| [`I18N.md`](docs/I18N.md)                           | Traductions                                             |
| [`IMAGE_STORAGE.md`](docs/IMAGE_STORAGE.md)         | Import des images vers le Dropbox du joueur             |
| [`SEED_SCENARIO.md`](docs/SEED_SCENARIO.md)         | Parcours de test avec les données du seed               |

## Contribuer

Les évolutions et les retours se suivent dans les
[tickets](https://github.com/Smooth-Tech-Studio/adventure-keeper/issues).

`main` (production) et `staging` ne reçoivent que des pull requests. Les PR
se font vers `staging` ; `staging` passe ensuite sur `main` par sa propre PR.
Pour être fusionnée, une PR doit :

- passer la CI (`ci / build` : format, lint, types, tests, build) et les tests
  de bout en bout (`e2e / e2e`) ;
- être à jour avec sa branche cible ;
- être approuvée par un mainteneur (voir `.github/CODEOWNERS`), ses
  discussions résolues.

Avant d'ouvrir une PR, lancer `pnpm format`, `pnpm lint`, `pnpm typecheck` et
`pnpm test`. La CI d'un premier contributeur attend l'accord d'un mainteneur
avant de tourner.

Une faille de sécurité ne se signale pas dans un ticket public : voir
[`SECURITY.md`](SECURITY.md).

## Licence

Le code est publié sous la licence
[PolyForm Noncommercial 1.0.0](LICENSE) : libre de le lire, de le modifier et
de l'utiliser à des fins non commerciales ; tout usage commercial est exclu.

## Crédits

Compatible avec la cinquième édition. Cette œuvre inclut du matériel issu du
System Reference Document 5.2.1 (« SRD 5.2.1 ») de Wizards of the Coast LLC,
disponible à l’adresse https://www.dndbeyond.com/srd. Le SRD 5.2.1 est régi
par la Licence Creative Commons Attribution 4.0 International, disponible à
l’adresse https://creativecommons.org/licenses/by/4.0/legalcode.

La même mention est affichée dans l'application, page `/credits`.
