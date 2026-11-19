# Scénario de test : « La Crypte oubliée »

Un parcours pour essayer l'app de bout en bout avec les données de
`scripts/seed.ts` (`pnpm emulators:seed`). Le mot de passe des trois comptes est
la constante `PASSWORD` du seed, sur les émulateurs ; sur le projet de staging,
c'est `SEED_PASSWORD` (voir `docs/DEPLOYMENT.md` §5.4).

| Compte           | Rôle dans « La Crypte oubliée »         |
| ---------------- | --------------------------------------- |
| `alice@test.dev` | MJ                                      |
| `bob@test.dev`   | Joueur : Thorin Poing-de-Fer (guerrier) |
| `carol@test.dev` | Joueuse : Mira l'Érudite (magicienne)   |

Ouvrez une fenêtre par compte (fenêtres privées ou profils différents) : le MJ
d'un côté, un ou deux joueurs de l'autre.

## L'histoire

Les héros sont arrivés à Val-Brume (**séance 1, déjà jouée** : « Rumeurs à
Val-Brume »). Ils ont vidé la cave du tavernier Garrick, puis trouvé la lettre
de l'archiviste Bertram, disparu : le portail de la crypte, sous le cimetière
des Saules, ne s'ouvre qu'au glas de minuit.

Ce soir, ils partent pour le cimetière (**« L'entrée de la crypte »**, à
jouer). Des gobelins y pillent les tombes, Frère Osric en sait plus qu'il ne
le dit, et la Confrérie du Linceul retient Bertram dans l'ossuaire, où erre le
spectre de Dame Ysolde.

## 1. Avant la séance : ce que voient les joueurs (Bob)

1. **Campagne** : deux quêtes révélées (« Les rats du Corbeau ivre » accomplie,
   « Retrouver l'archiviste Bertram » en cours), avec leurs étapes de la
   séance 1. Les deux quêtes cachées n'apparaissent pas.
2. **Codex** : Val-Brume, le Corbeau ivre, Garrick, l'Ordre de la Lanterne
   (réputation +2) et la lettre de Bertram. Pas de Frère Osric, de Confrérie ni
   de médaillon.
3. **« Rumeurs à Val-Brume »** (terminée) : chronique de la séance 1, avec le
   résumé, le temps fort, le butin, la lettre remise et le journal de Thorin
   (partagé avec le groupe). Le journal de Mira est privé : Bob ne doit pas le
   voir.
4. **« L'entrée de la crypte »** : visible, mais son contenu ne s'ouvre qu'en
   direct. **« Le cœur de la crypte »** (brouillon) n'apparaît pas.
5. **Fiche de Thorin** : onglet Histoire, puis chapitres et journal sous la
   fiche. « La dette » n'est visible que du MJ.

## 2. La séance (Alice démarre, Bob et Carol rejoignent)

1. **Alice** ouvre « L'entrée de la crypte », puis **Démarrer la session**.
   Elle règle l'horloge : jour 2, 21:00, « 4 du mois des Brumes ». Elle affiche
   **Le cimetière des Saules**.
2. **Bob et Carol** rejoignent depuis la campagne : carte, pions, horloge.
3. **Temps fort « Des pilleurs au cimetière »** : Alice le révèle. Combat :
   trois « Combattant gobelin » (fiche SRD avec attaques), initiative, deux
   tours. Deux gobelins tombent, le troisième fuit.
4. **Frère Osric** : Alice révèle sa fiche du codex. Sa note secrète (« a laissé
   entrer la Confrérie ») reste côté MJ. Une note rapide : « Osric ment ».
5. **L'horloge** : Alice avance à 23:30. Le panneau signale que « Le glas de
   minuit » est dû. Alice le révèle, puis « Le portail s'ouvre ».
6. **Le portail scellé** (lieu caché) : les joueurs voient une carte entièrement
   voilée. Alice gomme le brouillard petit à petit. Combat contre un squelette.
   - Pendant que la session est en direct, Bob ouvre la page de l'aventure : la
     carte Lieux ne doit montrer ni l'image d'un lieu caché ni les
     descriptions MJ. Ce correctif vit sur `fix/format-campaign-file` : il
     n'est visible qu'une fois cette branche fusionnée.
7. **L'ossuaire** (caché) : Alice révèle « Dame Ysolde se manifeste », la quête
   « Le médaillon d'Ysolde » et la fiche « La Confrérie du Linceul »
   (réputation −2). Combat contre le molosse squelette, avec états
   (« À terre ») : le suivi des états est activé sur l'aventure.
8. **Fin** : Bertram est libéré. Alice passe « Retrouver l'archiviste
   Bertram » en accomplie, ajoute un butin (« Médaillon terni ») et épingle une
   citation.

## 3. Après la séance

1. **Alice** termine la session, écrit le résumé (avec des `[[Frère Osric]]`,
   `[[La Confrérie du Linceul]]`), puis le publie.
2. **Bob** voit le résumé publié (repère « non lu » sur la campagne) et écrit
   une entrée de journal partagée avec le groupe. Elle apparaît dans la
   chronique de la séance.
3. **Quêtes** : les nouvelles étapes « séance 1 · L'entrée de la crypte »
   s'affichent.
4. **Alice** passe « L'entrée de la crypte » en terminée et « Le cœur de la
   crypte » en à venir : les joueurs voient alors son titre.

## Bonus

- **Export / import** : exporter la campagne, puis créer une nouvelle campagne
  depuis ce fichier. Essayer le guide « Créez une campagne unique avec une
  IA » (bouton « Copier un prompt »).
- **Création de personnage** sur téléphone : glisser entre les cartes du
  carrousel et ouvrir « Détails ».
- **Paramètres** (roue dentée) : langue et thème clair / sombre.
