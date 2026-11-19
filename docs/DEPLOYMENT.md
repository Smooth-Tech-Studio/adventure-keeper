# Déploiement — Adventure Keeper (web)

Ce guide couvre, de zéro à la mise en production :

1. Création du projet Firebase
2. Récupération des identifiants de configuration (les 6 variables `VITE_FIREBASE_*`)
3. Lancement en local
4. Premier déploiement manuel
5. Mise en place du pipeline CI/CD GitHub Actions
6. Déploiement des règles Firestore
7. Domaine personnalisé & rollback

> Toutes les commandes se lancent depuis la **racine du monorepo**, sauf mention contraire.

---

## 0. Prérequis

| Outil         | Version                                     | Vérifier                                                     |
| ------------- | ------------------------------------------- | ------------------------------------------------------------ |
| Node.js       | 26 (voir `.nvmrc`)                          | `node -v`                                                    |
| pnpm          | 11 (voir `package.json` → `packageManager`) | `pnpm -v` (`corepack enable` sinon)                          |
| Firebase CLI  | celle de `package.json`                     | `pnpm exec firebase --version` (installé par `pnpm install`) |
| Java          | ≥ 11                                        | `java -version` — requis par les émulateurs Firebase         |
| Compte Google | —                                           | avec accès à <https://console.firebase.google.com>           |

```bash
pnpm install
```

---

## 1. Créer le projet Firebase

1. Ouvrir <https://console.firebase.google.com> → **Ajouter un projet**.
2. Nom du projet : `adventure-keeper` (ou autre). Firebase génère un **Project ID**
   unique, du type `adventure-keeper` ou `adventure-keeper-a1b2c`.
   → **Notez ce Project ID**, c'est la valeur `VITE_FIREBASE_PROJECT_ID` et
   l'identifiant utilisé partout ailleurs.
3. Google Analytics : facultatif, vous pouvez désactiver.

### 1.1 Activer l'authentification e-mail / mot de passe

Console → **Build → Authentication → Get started** →
onglet **Sign-in method** → **Email/Password** → _Enable_ → _Save_.

### 1.2 Créer la base Firestore

Console → **Build → Firestore Database → Create database** →
choisir l'emplacement (ex. `eur3` / `europe-west`) →
démarrer en **production mode** (les règles de ce repo seront déployées à l'étape 6).

### 1.3 (Facultatif) Activer Cloud Storage

Non utilisé pour l'instant (les images de personnage sont de simples liens).
À activer plus tard si vous stockez des fichiers (cartes, aides de jeu) :
Console → **Build → Storage → Get started**.

---

## 2. Enregistrer l'application Web et récupérer la config

1. Console → **Project settings** (roue dentée en haut à gauche) →
   onglet **General** → section **Your apps** → icône **`</>`** (Web).
2. Surnom de l'app : `adventure-keeper-web`.
   Cochez **« Also set up Firebase Hosting »** → sélectionnez le site
   (par défaut le Project ID).
3. Firebase affiche un objet `firebaseConfig`. Chaque champ correspond à une variable :

   | Champ `firebaseConfig` | Variable d'environnement            |
   | ---------------------- | ----------------------------------- |
   | `apiKey`               | `VITE_FIREBASE_API_KEY`             |
   | `authDomain`           | `VITE_FIREBASE_AUTH_DOMAIN`         |
   | `projectId`            | `VITE_FIREBASE_PROJECT_ID`          |
   | `storageBucket`        | `VITE_FIREBASE_STORAGE_BUCKET`      |
   | `messagingSenderId`    | `VITE_FIREBASE_MESSAGING_SENDER_ID` |
   | `appId`                | `VITE_FIREBASE_APP_ID`              |

   > On peut retrouver ces valeurs à tout moment dans **Project settings → General →
   > Your apps → SDK setup and configuration → Config**.
   > Ces clés Web ne sont **pas secrètes** (elles finissent dans le bundle
   > front-end) ; la sécurité repose sur les **règles Firestore** et la
   > configuration Authentication.

### 2.1 Fichier `.env.local`

```bash
cp apps/web/.env.example apps/web/.env.local
# puis éditez apps/web/.env.local avec les 6 valeurs
```

### 2.2 Domaines autorisés (Auth)

Console → **Authentication → Settings → Authorized domains**.
`localhost` y est déjà. Après le premier déploiement, ajoutez
`VOTRE_PROJET.web.app` et `VOTRE_PROJET.firebaseapp.com` (souvent ajoutés
automatiquement), ainsi que votre domaine personnalisé le cas échéant.

---

## 3. Lancer en local

Par défaut, le front tourne contre les **émulateurs Firebase** (Auth + Firestore) :
`apps/web/.env.development`, versionné, pointe dessus. Aucun projet réel n'est
nécessaire pour développer.

```bash
pnpm dev              # émulateurs + front Vite, dans le même terminal
# front : http://localhost:5173 · UI des émulateurs : http://127.0.0.1:4000
pnpm emulators:seed   # (autre terminal) comptes, personnages et campagne de test
```

Le seed recrée à chaque fois les mêmes données (comptes `alice@test.dev`,
`bob@test.dev`, `carol@test.dev`, mot de passe `test1234`). Il refuse de tourner
contre autre chose qu'un émulateur local, sauf si on le demande
explicitement (§5.4 : le projet de staging).

Pour développer contre le **vrai projet**, mettez ses valeurs dans
`apps/web/.env.local` (§2.1, ignoré par git) : il prend le pas sur
`.env.development`. Retirez-y `VITE_FIREBASE_USE_EMULATORS`.

Les vérifications que la CI lance (§5) se rejouent en local :

```bash
pnpm format:check && pnpm lint && pnpm typecheck && pnpm test && pnpm build
```

### Tests de bout en bout

`pnpm test:e2e` (ou `pnpm test:e2e:ui` pour les suivre) lance les tests
Playwright du dossier `e2e/`. Ils démarrent **leurs propres émulateurs**
(`firebase.e2e.json` : Auth 9399, Firestore 8380) et un build de l'app servi sur
le port 5183 : rien de commun avec `pnpm dev`, qui peut tourner en même temps.
Ces émulateurs sont vidés à chaque lancement. Il faut Java et la Firebase CLI
(§0) ; la première fois, `pnpm exec playwright install chromium`.

---

## 4. Premier déploiement manuel

À faire une fois, pour valider la config avant d'automatiser.

```bash
pnpm exec firebase login

# Associer le dépôt local au projet (remplace la valeur de .firebaserc) :
pnpm exec firebase use --add
#   → choisir le Project ID, alias : "default"

# Build du monorepo (schemas puis web) :
pnpm build

# Déploiement hosting + règles :
pnpm exec firebase deploy
```

À la fin, l'URL `https://VOTRE_PROJET.web.app` est affichée.
Éditez `.firebaserc` et `firebase.json` (`hosting.site`) pour y mettre votre
Project ID / site réel, puis committez.

---

## 5. Pipeline CI/CD (GitHub Actions)

Les branches suivent ce chemin : une branche de travail → PR vers `staging` →
PR `staging` → `main`. Un push sur `main` déploie la **production**, et
seulement si la CI **et** les tests de bout en bout passent sur ce même commit.

> **En pause** : rien ne tourne plus automatiquement sur `staging` (ni au push,
> ni sur les PR qui la visent), et les PR vers `main` ne lancent plus les tests
> de bout en bout. Les fichiers restent : `staging.yml` se lance à la main
> (onglet **Actions**), et chaque fichier indique, en commentaire, les lignes à
> rétablir pour réactiver son déclencheur.

### Les workflows (`.github/workflows/`)

| Fichier                         | Déclencheur                          | Rôle                                                                            |
| ------------------------------- | ------------------------------------ | ------------------------------------------------------------------------------- |
| `ci-reusable.yml`               | appelé par les autres                | la CI elle-même : install, `format:check`, `lint`, `typecheck`, `test`, `build` |
| `pull-request.yml`              | PR vers `main`                       | CI                                                                              |
| `staging.yml`                   | manuel (en pause sur `staging`)      | CI, puis déploiement des règles et du Hosting du projet de **staging**          |
| `main.yml`                      | push sur `main`                      | CI et tests de bout en bout, puis les déploiements **s'ils passent**            |
| `e2e-reusable.yml`              | appelé par `main.yml`, ou manuel     | tests Playwright contre les émulateurs (§3), rapport en artefact si échec       |
| `deploy-hosting-reusable.yml`   | appelé par `main.yml`, `staging.yml` | build + déploiement du canal **live** de l'environnement reçu en paramètre      |
| `deploy-firestore-reusable.yml` | appelé par `main.yml`                | `firebase deploy --only firestore:rules,firestore:indexes`                      |
| `release-serveur-reusable.yml`  | appelé par `main.yml`, `staging.yml` | installeurs de l'app serveur, publiés en release (voir `REALTIME_SERVER.md`)    |
| `deploy-hosting-manual.yml`     | manuel (onglet **Actions**)          | redéploie le Hosting, depuis `main` uniquement                                  |
| `deploy-firestore-manual.yml`   | manuel (onglet **Actions**)          | redéploie règles et index, depuis `main` uniquement                             |

Dans `main.yml` :

- **`ci`** rejoue la CI sur le commit poussé ; un nouveau push annule celle en cours.
- **`e2e`** lance les tests de bout en bout en parallèle (quelques
  minutes, sans aucun secret : l'app de test parle aux émulateurs). Ils ne
  tournent pas sur les PR, pour ne pas les ralentir.
- **`deploy-hosting`** attend `ci` et `e2e`, et ne part que si les deux ont réussi.
- **`deploy-firestore`** attend `ci` et `e2e`, et ne part que si le push modifie
  `firestore.rules`, `firestore.indexes.json` ou `firebase.json` (job
  `changes`, qui compare `github.event.before` et le commit poussé).
- **`serveur`** attend `ci` et `e2e`, et ne part que si le push touche
  `apps/realtime-desktop`, `apps/realtime-server` ou `packages/schemas` (même
  job `changes`). Il construit l'app serveur sur quatre systèmes et la publie
  en release ; `staging.yml` fait de même après `ci`, pour la variante de
  staging.
- Chaque déploiement a son groupe de `concurrency` sans annulation : deux
  déploiements de production ne se chevauchent jamais, et aucun n'est coupé en route.

Rien ne se déploie depuis une PR : pas de canal de prévisualisation pour
l'instant.

### Staging et production : deux environnements GitHub

Les deux workflows de déploiement reçoivent un paramètre `environment`
(`production` par défaut, `staging` depuis `staging.yml`). Chaque
environnement GitHub (**Settings → Environments**) porte ses propres secrets :
`FIREBASE_SERVICE_ACCOUNT` et les six `FIREBASE_*` de la configuration (plus,
au besoin, `DROPBOX_APP_KEY`), avec les valeurs du projet Firebase
correspondant. Les workflows les passent à Vite sous leur nom `VITE_*`.

> ⚠️ Un environnement auquel il manque un secret retombe sur le secret du même
> nom au niveau du dépôt, c'est-à-dire la production. Le déploiement de staging
> refuse donc de partir si `FIREBASE_PROJECT_ID` est vide ou vaut
> `adv-keeper`. Le plus sûr : déplacer aussi les secrets de production dans
> l'environnement `production` et vider ceux du dépôt.

`firebase.json` ne fixe plus de `site` Hosting : le déploiement vise le site par
défaut du projet, ce qui marche pour les deux.

> ⚠️ Le déploiement des règles passe `--force` : les index présents dans la
> console mais **absents** de `firestore.indexes.json` seront supprimés
> (comportement « infra as code » voulu). Gardez le fichier à jour.

Il reste à fournir les **secrets**.

### 5.1 Générer le compte de service Firebase

**Option A — automatique (recommandée)**

```bash
firebase init hosting:github
```

La CLI :

- crée un **compte de service Google Cloud** avec les droits de déploiement,
- ajoute le secret `FIREBASE_SERVICE_ACCOUNT_<PROJECT_ID>` dans le dépôt GitHub,
- propose de (ré)écrire les workflows.

  ⚠️ Répondez **non** à la réécriture des workflows (`Set up the workflow to run
a build script before every deploy?` → vous pouvez accepter `pnpm install &&
pnpm build` ; `Set up automatic deployment to your site's live channel when a
PR is merged?` → **N**), les fichiers de ce repo sont déjà configurés.
  Si la CLI a créé un secret nommé `FIREBASE_SERVICE_ACCOUNT_ADVENTURE_KEEPER`,
  soit vous renommez le secret en `FIREBASE_SERVICE_ACCOUNT`, soit vous adaptez
  les workflows `deploy-hosting-reusable.yml` et `deploy-firestore-reusable.yml`.

**Option B — manuelle**

1. <https://console.cloud.google.com> → bon projet → **IAM & Admin → Service Accounts → Create service account**.
   - Nom : `github-actions-deployer`.
   - Rôles (hosting) :
     - **Firebase Hosting Admin** (`roles/firebasehosting.admin`)
     - **Cloud Run Viewer** (`roles/run.viewer`) _(requis par `action-hosting-deploy`)_
     - **Firebase Authentication Viewer** (`roles/firebaseauth.viewer`) _(optionnel)_
     - **API Keys Viewer** (`roles/serviceusage.apiKeysViewer`) _(optionnel)_
   - Rôles (rules & index Firestore — pour `deploy-firestore-reusable.yml`) :
     - **Firebase Rules Admin** (`roles/firebaserules.admin`) → déploie `firestore:rules`
     - **Cloud Datastore Index Admin** (`roles/datastore.indexAdmin`) → déploie `firestore:indexes`
   - _(Alternative large : un seul rôle **Firebase Admin** `roles/firebase.admin` couvre tout.)_
2. Onglet **Keys → Add key → Create new key → JSON**. Un fichier `.json` est téléchargé.
3. GitHub → dépôt → **Settings → Secrets and variables → Actions → New repository secret** :
   - Nom : `FIREBASE_SERVICE_ACCOUNT`
   - Valeur : **contenu intégral du fichier JSON** (copier-coller tel quel, pas de base64).
4. **Supprimez le fichier JSON local** une fois le secret créé.

> Le workflow `deploy-firestore-reusable.yml` réutilise le **même secret**
> `FIREBASE_SERVICE_ACCOUNT` : il écrit le JSON dans un fichier temporaire et
> pointe `GOOGLE_APPLICATION_CREDENTIALS` dessus, ce qui authentifie
> `firebase-tools` (Application Default Credentials). Si le compte de service
> n'a pas les deux rôles Firestore ci-dessus, ce workflow échouera avec une
> erreur `PERMISSION_DENIED` — les autres workflows ne sont pas affectés.
>
> Si vous avez utilisé **`firebase init hosting:github`**, la CLI n'accorde que
> les rôles _hosting_ : ajoutez les deux rôles Firestore manuellement dans
> **IAM & Admin → IAM** (repérez l'e-mail `…@PROJET.iam.gserviceaccount.com`,
> crayon → _Add another role_).

### 5.2 Secrets GitHub à créer

Dépôt → **Settings → Secrets and variables → Actions**.

| Secret                         | Valeur                                                                     |
| ------------------------------ | -------------------------------------------------------------------------- |
| `FIREBASE_SERVICE_ACCOUNT`     | JSON complet du compte de service (§5.1)                                   |
| `FIREBASE_API_KEY`             | la valeur de `VITE_FIREBASE_API_KEY` (tableau §2)                          |
| `FIREBASE_AUTH_DOMAIN`         | celle de `VITE_FIREBASE_AUTH_DOMAIN`                                       |
| `FIREBASE_PROJECT_ID`          | celle de `VITE_FIREBASE_PROJECT_ID` (sert aussi à l'action de déploiement) |
| `FIREBASE_STORAGE_BUCKET`      | celle de `VITE_FIREBASE_STORAGE_BUCKET`                                    |
| `FIREBASE_MESSAGING_SENDER_ID` | celle de `VITE_FIREBASE_MESSAGING_SENDER_ID`                               |
| `FIREBASE_APP_ID`              | celle de `VITE_FIREBASE_APP_ID`                                            |
| `DROPBOX_APP_KEY` (facultatif) | Clé de l'app Dropbox ([IMAGE_STORAGE.md](IMAGE_STORAGE.md))                |

Les secrets n'ont pas le préfixe `VITE_` : ce sont les workflows qui les
donnent à Vite sous ce nom, au moment de la construction.

`GITHUB_TOKEN` est fourni automatiquement par GitHub Actions — rien à faire.

### 5.3 Activer et tester

```bash
git remote add origin git@github.com:VOTRE_COMPTE/adventure-keeper.git
git push -u origin main
```

- Le push sur `main` lance **main: CI, CD (production)** : la CI et les tests de bout
  en bout, puis le déploiement du Hosting → site en ligne sur
  `https://VOTRE_PROJET.web.app`.
- Une PR vers `main` lance **Pull request: CI** ; son résultat
  s'affiche dans la PR. Rien n'est déployé.
- Si la CI ou les tests de bout en bout échouent sur `main`, rien ne part :
  corrigez, poussez à nouveau. Pour un échec E2E, l'artefact
  **playwright-report** de l'exécution contient le rapport et, pour chaque test
  échoué, une capture et une trace (`pnpm exec playwright show-trace trace.zip`).
  Les tests se relancent à la main depuis **Actions → End-to-end tests → Run
  workflow**, sur n'importe quelle branche.
  Pour redéployer sans nouveau commit : **Actions → Deploy Firebase Hosting
  (manual) → Run workflow**, sur la branche `main`.

---

### 5.4 Semer le projet de staging

Le staging peut recevoir les mêmes comptes, personnages et campagne que les
émulateurs (`scripts/seed.ts`, scénario dans `docs/SEED_SCENARIO.md`). Le mode
distant est volontaire : il **refuse `adv-keeper`** (la production), refuse de
partir sans `--yes`, et n'efface que les documents et comptes `seed-*`.

**Un compte de service dédié**, distinct de celui de la CI (qui n'a aucun droit
sur Authentication ni sur les données) : Google Cloud → IAM → Comptes de
service du projet de staging, avec les rôles **Cloud Datastore User**
(`roles/datastore.user`) et **Firebase Authentication Admin**
(`roles/firebaseauth.admin`), puis une clé JSON.

**Un mot de passe de votre choix** : le staging est joignable depuis Internet et
`test1234` est écrit dans le dépôt. Sans `SEED_PASSWORD`, le script en génère un
au hasard et l'affiche une fois, à la fin.

```bash
GOOGLE_APPLICATION_CREDENTIALS=/chemin/hors/du/depot/cle-seed.json \
SEED_PASSWORD='un mot de passe d'au moins 8 caractères' \
pnpm emulators:seed --project <id-du-projet-staging> --yes
```

Sans `--yes`, le script annonce ce qu'il ferait et s'arrête. Il est rejouable :
chaque passage recrée les mêmes données. Une fois terminé, supprimez la clé (ou
désactivez-la dans Google Cloud) ; elle ne sert qu'à ça.

## 6. Règles & index Firestore

`firestore.rules` et `firestore.indexes.json` sont versionnés et déployés
**automatiquement** par `main.yml` quand un push sur `main` les modifie, une
fois la CI et les tests de bout en bout passés (§5). Prérequis : les rôles rules/index sur le compte de
service (§5.1) + les secrets `FIREBASE_SERVICE_ACCOUNT` et
`FIREBASE_PROJECT_ID`.

Déploiement **manuel** (local ou premier essai), équivalent :

```bash
pnpm firebase:deploy:rules
# = firebase deploy --only firestore:rules,firestore:indexes
```

Forcer un déploiement sans changement de fichier : onglet **Actions → Deploy
Firestore rules and indexes (manual) → Run workflow**, sur la branche `main` (le
workflow refuse toute autre branche).

---

## 7. Domaine personnalisé

Console → **Hosting → Add custom domain** → suivez les instructions DNS
(enregistrements `A` ou `TXT` de vérification). Une fois vérifié, ajoutez le
domaine dans **Authentication → Settings → Authorized domains**.

## 8. Rollback

- Console → **Hosting → Release history** → _Rollback_ sur une version précédente.
- ou CLI : `firebase hosting:rollback`.

---

## Récapitulatif des informations à récupérer

| Où                                                                      | Quoi                            | Utilisé pour                                                 |
| ----------------------------------------------------------------------- | ------------------------------- | ------------------------------------------------------------ |
| Console Firebase → création projet                                      | **Project ID**                  | `.firebaserc`, `firebase.json`, secret `FIREBASE_PROJECT_ID` |
| Project settings → General → Your apps → Config                         | **6 valeurs `VITE_FIREBASE_*`** | `apps/web/.env.local` + secrets GitHub (sans `VITE_`)        |
| `firebase init hosting:github` **ou** GCP → Service Accounts → clé JSON | **JSON du compte de service**   | secret GitHub `FIREBASE_SERVICE_ACCOUNT`                     |
| Authentication → Sign-in method                                         | activer **Email/Password**      | connexion / création de compte                               |
| Firestore → Create database                                             | base créée + emplacement        | stockage des données                                         |
