# Sécurité

## Signaler une vulnérabilité

Merci de **ne pas** ouvrir de ticket public pour une faille de sécurité.

Utiliser le signalement privé de GitHub : onglet
[**Security**](https://github.com/Smooth-Tech-Studio/adventure-keeper/security)
du dépôt, puis **Report a vulnerability**. Seuls les mainteneurs voient le
rapport.

Indiquer si possible :

- ce qui est touché (site, règles Firestore, serveur de session, app
  Adventure Keeper Serveur) ;
- les étapes pour reproduire, ou une preuve de concept ;
- l'impact estimé (accès aux données d'un autre joueur, d'une autre campagne…).

Le projet est maintenu sur le temps libre : un premier retour est donné dès
que possible, généralement sous quelques jours. Une fois la correction
publiée, le rapport peut être rendu public, avec mention de son auteur s'il
le souhaite.

## Versions concernées

Seule la version en production est suivie : le site
<https://adv-keeper.smthstd.fr> et la dernière release `serveur-vX.Y.Z` de
l'app Adventure Keeper Serveur.

## Périmètre

Sont notamment dans le périmètre :

- les règles de sécurité Firestore (`firestore.rules`) : lecture ou écriture
  de données qui ne devraient pas être accessibles ;
- le serveur de session en direct (`apps/realtime-server`) et l'app de bureau
  (`apps/realtime-desktop`) : authentification, origines acceptées, accès à
  une session sans y être invité ;
- l'application web (`apps/web`) : XSS, fuite de jetons.

Hors périmètre : les services tiers eux-mêmes (Firebase, Dropbox,
Cloudflare), le déni de service par volume, et les rapports d'outils
automatiques sans démonstration d'impact.
