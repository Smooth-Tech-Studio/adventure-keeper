# Serveur temps réel (self-host)

Une session peut se jouer de deux façons, au choix du MJ quand il la lance :

- **Firestore** (par défaut) : rien à installer, tout passe par Firestore ;
- **un serveur temps réel** que vous hébergez : bouton serveur à côté de
  « Démarrer la session », adresse du serveur, « Tester », « Démarrer ».

Le serveur tient une **salle** par session, en mémoire : les **combattants**
(jetons, PV, conditions), le **combat** (round, tour, ordre), la **brume** des
lieux cachés, l'**état de jeu des personnages** (PV, PV temporaires, jets
contre la mort, concentration, emplacements de sorts, dés de vie, capacités
dépensées, états, épuisement, forme sauvage, initiative, derniers jets) et
**qui est connecté**. Chaque changement est relayé en WebSocket à tous les
onglets connectés. Le reste — lieu affiché, horloge, fiches, notes des
joueurs, XP en attente, butin — reste dans Firestore, où il ne coûte presque
rien.

## Pourquoi

Firestore facture chaque écriture, et chaque document modifié est relu par
chaque client abonné. Glisser un jeton, c'est une écriture toutes les 300 ms
(déjà regroupées, voir plus bas), relue par chaque onglet. Par le serveur :

- **aucune écriture Firestore** pour les jetons, les PV, le combat et la brume
  pendant la session ;
- les jetons **glissent en continu** chez tout le monde (un message à chaque
  mouvement pendant le glisser), et chaque clic ±PV d'un ennemi part aussitôt ;
- la brume **se lève chez les joueurs pendant que le MJ peint** (le masque
  part toutes les 50 ms tant que la gomme ou le pinceau est sorti : c'est le
  masque entier, quelques Ko, d'où ce léger étalement) ;
- la salle sait qui est connecté (présence), ce qui ouvrira la voie aux pings,
  curseurs et dés partagés.

## Comment ça marche

```
navigateur ──wss──▶ serveur (salle = session) ──▶ disque (un JSON par salle)
     │
     └──────────▶ Firestore (session, lieux, fiches…)
```

- **Lancement** : le MJ choisit l'adresse ; la session reçoit
  `realtime: { url, memberKey }` (lisible par les membres de la campagne
  seulement), et la **clé MJ** va dans `private/gm` (lisible par le MJ seul).
- **Entrée dans la salle** : chaque onglet envoie la clé de membre (+ la clé MJ
  pour le MJ) et son jeton Firebase. Le serveur vérifie le jeton (il doit venir
  du projet Firebase configuré) : il sait **qui** parle ; les clés disent **s'il
  est de la table**, et **s'il est le MJ**. Le serveur ne lit jamais Firestore et
  ne garde que des empreintes (SHA-256) des clés.
- **Droits** (les mêmes que `firestore.rules`) : le MJ change tout ; un joueur
  déplace les jetons, règle PV et conditions, joue l'ordre du tour, et ajoute
  ou retire **son** familier. Seul le MJ peint la brume. Un joueur tient l'état
  de **son** personnage, sauf les états et l'épuisement, que fixe le MJ.
- **Personnages** : l'onglet du MJ fait entrer l'état de chaque personnage dans
  la salle, tel que Firestore l'a (`participant.track` ; sans effet si la salle
  l'a déjà, elle est alors en avance). Il le recopie dans Firestore **toutes
  les 5 minutes** et quand l'onglet passe en arrière-plan (seulement ce qui a
  changé) : une séance jamais terminée laisse quand même des fiches à jour.
- **Présence** : c'est celle de la salle. Firestore ne retient que la venue de
  chaque joueur (`attendeeUids`, pour la chronique), une fois par séance — plus
  d'écriture à chaque arrivée, départ ou reconnexion.
- **Reprise** : la salle est enregistrée sur disque (une écriture par seconde au
  plus) ; un redémarrage ne perd rien. Un onglet qui perd la connexion se
  reconnecte seul et reçoit l'état complet (« Connexion au serveur temps
  réel… » s'affiche en attendant).
- **Amorçage** : à l'ouverture d'une salle vide, le MJ y recopie ce que
  Firestore a (l'état repris de la séance précédente, brume comprise).
- **Fin de session** : « Terminer la session » recopie la salle dans Firestore
  (combattants, combat, le masque de brume de chaque lieu, et l'état des
  personnages) : la séance
  suivante repart de là, quel que soit son
  mode, et la chronique garde ses ennemis vaincus.

Code : `apps/realtime-server/` (serveur), `packages/schemas/src/realtime.ts`
(protocole), `apps/web/src/lib/realtime/room-client.ts` (client),
`apps/web/src/lib/live-store.ts` (Firestore ou salle, même interface).

## Sur l'ordinateur du MJ : Adventure Keeper Serveur

Le plus simple : l'app de bureau **Adventure Keeper Serveur**, à télécharger sur
la page `/serveur` du site (Windows, macOS, Linux). Rien d'autre à installer,
ni domaine ni réglage de la box :

- elle lance le serveur (un exécutable autonome, Node compris) sur
  `127.0.0.1:8787`, et un **tunnel Cloudflare** (`cloudflared`, une « quick
  tunnel » gratuite, sans compte) qui lui donne une adresse publique
  `https://….trycloudflare.com`, nouvelle à chaque lancement ;
- la fenêtre affiche l'état, l'adresse (« Copier ») et les connexions ; la
  fermer arrête le serveur (les salles restent sur disque, dans le dossier de
  données de l'app) ;
- dans le site, « Chercher » (boîte de lancement) demande l'adresse à l'app
  (`http://127.0.0.1:8787/health` → `publicUrl`). Chrome demande d'abord
  l'autorisation d'accéder aux appareils locaux ; ensuite la recherche se fait
  toute seule à l'ouverture de la boîte.

Limites : l'ordinateur doit rester allumé et connecté pendant la séance ; les
quick tunnels de Cloudflare n'ont pas de garantie de disponibilité (largement
assez pour une table de jeu). L'app n'est pas signée : avertissement à la
première ouverture (expliqué sur `/serveur`).

### Construire et publier l'app

Code : `apps/realtime-desktop/` (Tauri 2 : `src-tauri/` en Rust, `ui/` la
fenêtre), `apps/realtime-server/scripts/build-sea.mjs` (l'exécutable du
serveur), `apps/realtime-server/src/tunnel.ts` (le tunnel). Le serveur garde
ses variables ; l'app lui passe en plus `HOST`, `CLOUDFLARED_PATH` et
`STATUS_JSON=1` (état en lignes `AK_STATUS {json}`, arrêt sur `quit`).

- **En local** (Rust et, sous Linux, les paquets WebKitGTK de Tauri) :
  `pnpm --filter @adventure-keeper/realtime-desktop desktop:dev`.
- **Une version** : chaque push sur `main` qui touche `apps/realtime-desktop`,
  `apps/realtime-server` ou `packages/schemas` en publie une. Le pipeline
  `main.yml` appelle `release-serveur-reusable.yml` (job `serveur`) une
  fois la CI et les tests de bout en bout passés, en parallèle du déploiement
  du site. Il construit les cinq installeurs et les publie dans la release
  `serveur-vX.Y.Z` de ce dépôt, sous des noms fixes : la page `/serveur`
  pointe toujours vers `releases/latest/download/…`. Le tag de la release est
  posé sur le commit publié, sauf si un push sur `main` a modifié un workflow
  pendant le build : le jeton du run ne peut alors pas taguer ce commit, la
  release est posée sur la pointe de la branche, le run l'indique en
  avertissement, et les notes de la release nomment le commit construit. Lancé à la main (onglet Actions), le workflow ne fait que
  construire (installeurs en artefacts du run).
- **Le numéro de version** se calcule au début du run, pour que chaque push
  publie sans toucher à un fichier : `version` dans `src-tauri/tauri.conf.json`
  est un plancher, et la release prend le plus grand entre ce plancher et la
  dernière release publiée plus un correctif (0.1.0, 0.1.1, 0.1.2…). Pour
  ouvrir une nouvelle série (0.2.0), monter le plancher (et, par cohérence,
  `Cargo.toml` et `package.json`) : le push suivant la publie. La version
  calculée est passée à `tauri build --config '{"version":…}'`, qui prime sur
  le fichier : c'est elle que l'app et les installeurs affichent. Les runs
  d'une même branche s'enchaînent un par un, sinon deux pushes rapprochés
  calculeraient la même version.
- **La variante de staging** : l'app sert un seul projet Firebase, fixé à la
  compilation (`AK_FIREBASE_PROJECT_ID`, lu par `main.rs` ; `adv-keeper` par
  défaut). Origines autorisées et site ouvert par le bouton en découlent
  (`<projet>.web.app`, `<projet>.firebaseapp.com`). Quand `staging.yml` est
  lancé (à la main, tant que le staging est en pause), il appelle le même
  workflow après la CI :
  il construit une variante « Adventure Keeper Serveur Staging » (autre nom et
  autre identifiant : elle s'installe à côté de la vraie) et la publie dans la
  pré-version `serveur-staging` (pas `staging`, qui entrerait en conflit avec
  la branche), dont il remplace les installeurs. `releases/latest` (production) ne la voit
  jamais. Le site de staging pointe vers elle (`VITE_DESKTOP_RELEASE_TAG`,
  posé par `deploy-hosting-reusable.yml`). Le build tourne dans
  l'environnement GitHub du canal et lit l'ID du projet de staging dans son
  `VITE_FIREBASE_PROJECT_ID`, comme le déploiement du site.
  Les deux apps écoutent sur le port 8787 : une seule à la fois.
  Si un build échoue (un runner macOS jamais attribué, par exemple), la
  publication part quand même avec les autres installeurs ; le run reste rouge.
  Sur le staging, l'ancien installeur reste pour le système manquant. Une
  version de production exige Windows, Linux et macOS Intel, mais pas macOS
  Apple Silicon : sans lui, le lien de la page `/serveur` pour cette puce
  renvoie une 404 jusqu'à la version suivante.
- **Publication** : le jeton du run suffit (`contents: write` sur le job de
  publication) ; aucun secret à poser.
- **cloudflared** : version et empreintes SHA-256 épinglées dans
  `apps/realtime-desktop/scripts/prepare-sidecars.mjs`.

## Installer un serveur

Pour un serveur toujours en ligne, hors de l'ordinateur du MJ : il faut une
machine joignable depuis Internet (un petit VPS suffit : le serveur
tient en un fichier et quelques dizaines de Mo de mémoire), un **nom de
domaine**, et du **HTTPS** : le site étant en `https`, le navigateur refuse une
connexion `ws://` non chiffrée.

### Variables

| Variable                 | Rôle                                                                                            |
| ------------------------ | ----------------------------------------------------------------------------------------------- |
| `FIREBASE_PROJECT_ID`    | **Obligatoire** : l'identifiant du projet Firebase de l'app. Seuls ses comptes entrent.         |
| `ALLOWED_ORIGINS`        | Les adresses du site, séparées par des virgules (`https://mon-projet.web.app`). `*` par défaut. |
| `PORT`                   | Port d'écoute (8787).                                                                           |
| `DATA_DIR`               | Où enregistrer les salles (`./data`). Les salles intouchées depuis 60 jours sont effacées.      |
| `FIREBASE_AUTH_EMULATOR` | `1` = accepter les jetons non signés de l'émulateur. **Développement uniquement.**              |

### Avec Docker et Caddy (HTTPS automatique)

1. Faire pointer un nom (ex. `jeu.mondomaine.fr`) vers la machine.
2. Sur la machine, cloner le dépôt, puis dans `apps/realtime-server/` :

   ```bash
   cp docker-compose.example.yml docker-compose.yml   # puis y mettre votre projet et votre site
   cat > Caddyfile <<'EOF'
   jeu.mondomaine.fr {
     reverse_proxy realtime:8787
   }
   EOF
   docker compose up -d
   ```

   Caddy obtient le certificat tout seul (ports 80 et 443 ouverts).

3. Vérifier : `https://jeu.mondomaine.fr/health` répond
   `{"ok":true,"service":"adventure-keeper-realtime",…}`.
4. Dans l'app : page de l'aventure → bouton serveur → `https://jeu.mondomaine.fr`
   → « Tester » → « Démarrer la session ».

### Sans Docker (Node 26)

```bash
pnpm install
pnpm turbo run build --filter=@adventure-keeper/realtime-server
# Le serveur tient en un fichier : apps/realtime-server/dist/server.js
FIREBASE_PROJECT_ID=mon-projet ALLOWED_ORIGINS=https://mon-projet.web.app \
  DATA_DIR=/var/lib/adventure-keeper node apps/realtime-server/dist/server.js
```

…derrière un proxy HTTPS qui laisse passer les WebSockets (Caddy le fait
d'office ; avec nginx, `proxy_http_version 1.1` et les en-têtes `Upgrade` /
`Connection`). Pour qu'il redémarre seul, un service systemd :

```ini
[Service]
Environment=FIREBASE_PROJECT_ID=mon-projet
Environment=ALLOWED_ORIGINS=https://mon-projet.web.app
Environment=DATA_DIR=/var/lib/adventure-keeper
ExecStart=/usr/bin/node /opt/adventure-keeper/server.js
Restart=always
User=adventure-keeper
```

### En développement

`pnpm dev` lance aussi le serveur sur `http://localhost:8787`, en mode
émulateur. Démarrer une session avec cette adresse. Les tests de bout en bout
en lancent un sur le port 8797 (`e2e/13-realtime-server.spec.ts`).

## Limites et pistes

- L'**horloge** et le **lieu** restent dans Firestore (peu d'écritures). À
  chaque changement de lieu, Firestore garde aussi la fiche du lieu visité
  (nom, carte) pour la chronique ; seul le masque de brume passe par la salle.
- Si le serveur s'arrête en pleine séance, la table attend qu'il revienne
  (rien n'est perdu) ; passer une séance en cours de Firestore au serveur (ou
  l'inverse) n'est pas prévu : on termine la séance et on relance.
- **Serveur plus ancien** (sans les personnages) : le site le voit (`participants`
  absent de l'état de la salle) et écrit alors les personnages dans Firestore,
  comme sans serveur. La présence, elle, vient de la salle dans tous les cas.
- Pendant la séance, les autres pages (aventure, fiche) lisent l'état des
  personnages dans Firestore : il y a jusqu'à 5 minutes de retard.
- Pings, curseurs, dés partagés : la salle est là pour les accueillir.

## Sans serveur : les écritures regroupées

Sans serveur, les écritures en rafale passent par un tampon
(`lib/write-buffer.ts`, `hooks/use-buffered-writes.ts`) : un jeton glissé est
écrit au plus toutes les 300 ms et au lâcher, les PV et l'horloge réglés au +/−
une fois les clics finis. Avec un serveur, ce qui part dans la salle n'est pas
regroupé (`delay: 0`) ; l'horloge et les notes, restées dans Firestore, le sont.
