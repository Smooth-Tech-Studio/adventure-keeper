# Stockage des images

L'app ne stocke aucune image : une carte, un portrait ou un document est un
**lien** vers une image hébergée ailleurs. Coller un lien de partage Dropbox ou
Google Drive marche déjà (il est converti en lien direct, `lib/image-url.ts`).

Pour éviter ce va-et-vient, un joueur peut **relier son Dropbox** (page
Profil → « Stockage des images ») : partout où l'app demande le lien d'une
image, un bouton « Importer depuis l'appareil » envoie le fichier dans le
dossier de l'app sur **son** Dropbox, le partage par lien, et remplit le champ.

## Quels stockages ont une API ?

| Service              | API d'envoi | Lien direct utilisable dans `<img>`                                                                                     | Depuis le navigateur seul                        | Retenu                                                           |
| -------------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ | ---------------------------------------------------------------- |
| **Dropbox**          | oui         | **oui** : le lien de partage avec `raw=1` sert l'image elle-même, de façon fiable                                       | **oui** : OAuth 2 PKCE, sans secret, CORS ouvert | ✅ maintenant                                                    |
| Google Drive         | oui         | **fragile** : Drive n'est pas fait pour servir des images (`thumbnail?id=` / `uc?export=view` limités, parfois bloqués) | oui (Google Identity Services)                   | plus tard                                                        |
| OneDrive (Microsoft) | oui (Graph) | oui (lien « embed »)                                                                                                    | oui (MSAL)                                       | plus tard                                                        |
| Firebase Storage     | oui         | oui                                                                                                                     | oui, déjà dans le projet                         | non : il faut désormais le forfait payant (Blaze) pour un bucket |
| Cloudinary, ImgBB…   | oui         | oui                                                                                                                     | souvent, mais compte à créer chez eux            | non                                                              |

Dropbox est le plus simple **et** le plus fiable pour afficher les images ;
le code est rangé derrière un type `StorageProvider`
(`lib/image-storage/`) pour en ajouter un autre.

## Ce que fait l'app

- **Connexion** (`lib/image-storage/dropbox.ts`) : OAuth 2 avec PKCE, depuis
  le navigateur, retour sur `/stockage/dropbox`. Droits demandés :
  `files.content.write`, `sharing.write`, `account_info.read`. L'app n'a accès
  qu'à **son propre dossier** (`Applications/<nom de l'app>/`).
- **Jetons** : rangés dans `users/{uid}/private/storage`, lisible par son seul
  propriétaire (règles Firestore). Le jeton d'accès (4 h) est renouvelé par le
  jeton de rafraîchissement : la connexion vaut pour tous les appareils.
- **Import** : le fichier (une image, 20 Mo au plus) part dans
  `/images/<année-mois>/<horodatage>-<nom>`, puis un lien de partage public
  est créé ; le champ reçoit sa version directe (`raw=1`).
- **Déconnexion** : efface les jetons. Les images déjà importées restent sur
  le Dropbox du joueur, et leurs liens continuent de marcher.

> Comme un lien de partage collé à la main, une image importée est **publique
> pour qui a le lien**.

## Mise en place (une fois)

1. Sur <https://www.dropbox.com/developers/apps> → **Create app** :
   - _Scoped access_ ;
   - _App folder_ (l'app ne voit que son dossier) ;
   - un nom (ce sera le nom du dossier : `Applications/<nom>`).
2. Onglet **Permissions** : cocher `files.content.write`, `sharing.write`,
   `account_info.read`, puis **Submit**.
3. Onglet **Settings** → **OAuth 2 / Redirect URIs** : ajouter
   - `https://<votre-domaine>/stockage/dropbox` (le site déployé),
   - `http://localhost:5173/stockage/dropbox` (le développement).
   - Laisser « Allow public clients (Implicit Grant & PKCE) » sur **Allow**.
4. Copier l'**App key** :
   - en local : `VITE_DROPBOX_APP_KEY=…` dans `apps/web/.env.local` ;
   - au déploiement : secret GitHub `DROPBOX_APP_KEY` (lu par
     `deploy-hosting-reusable.yml`, voir [DEPLOYMENT.md](DEPLOYMENT.md)).
5. Une app Dropbox en développement accepte **50 comptes**. Au-delà, demander
   le passage en production (**Apply for production**, onglet Settings).

Sans clé, rien ne change : pas de carte « Stockage des images », pas de bouton
d'import, les liens collés marchent comme avant.
