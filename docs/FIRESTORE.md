# Modèle de données Firestore

Toutes les structures sont typées et validées dans le package
[`@adventure-keeper/schemas`](../packages/schemas) (Zod + types TypeScript
inférés). Ce document en donne la vue d'ensemble ; le code fait foi.

## Arborescence des collections

```
users/{uid}                                   → UserProfile
characters/{characterId}                      → Character                (5e 2024, top-level)
  private/belongings                          → CharacterBelongings      (inventaire, bourse, XP, notes : propriétaire et MJ)
  chapters/{chapterId}                        → CharacterChapter         (chapitres du passé)
  journal/{entryId}                           → JournalEntry             (journal du personnage)
invites/{inviteId}                            → CampaignInvite           (lien ou e-mail, top-level)
contentPacks/{docId}                          → ContentPackDoc           (pack de contenu d'un joueur)

campaigns/{campaignId}                         → Campaign
  members/{uid}                                → CampaignMember
  packs/{packId}                               → CampaignPack            (copie d'un pack autorisé par le MJ)
  adventures/{adventureId}                     → Adventure               (créées par le MJ)
    locations/{locationId}                     → AdventureLocation       (lieux / cartes — moitié publique)
    locationSecrets/{locationId}               → AdventureLocationSecret (moitié MJ : description, carte complète)
    enemies/{enemyId}                          → AdventureEnemy          (ennemis + stats)
    events/{eventId}                           → AdventureEvent          (temps forts prévus par le MJ)
    participants/{characterId}                 → AdventureParticipant    (état de jeu : PV / notes / XP en attente)
    liveSessions/{sessionId}                   → LiveSession             (session de jeu en direct)
      combatants/{combatantId}                 → SessionCombatant        (roster du combat + jetons sur la carte)
      mapReveals/{locationId}                  → SessionMapReveal        (brume levée + instantané du lieu)
      private/gm                               → LiveSessionGm           (brouillon du résumé + notes du MJ)
      quotes/{quoteId}                         → SessionQuote            (citations épinglées)
  codex/{entryId}                              → CodexEntry              (fiches du monde, révélées aux joueurs)
    private/gm                                 → CodexEntryGm            (secret du MJ)
  quests/{questId}                             → Quest                   (tableau de quêtes)
  notes/{noteId}                               → Note                    (modélisé, UI à venir)
  resources/{resourceId}                       → Resource                (modélisé, UI à venir)
```

Noms de collections et helpers de chemin :

```ts
import { COLLECTIONS, paths } from "@adventure-keeper/schemas";

paths.character("abc"); // "characters/abc"
paths.campaign("c1"); // "campaigns/c1"
paths.adventures("c1"); // "campaigns/c1/adventures"
paths.enemies("c1", "a1"); // "campaigns/c1/adventures/a1/enemies"
paths.participant("c1", "a1", "abc"); // ".../participants/abc"
```

## Conventions

- **Champs d'audit** : chaque document porte `createdAt` / `updatedAt`
  (`Timestamp`). À l'écriture, `serverTimestamp()`.
- **Identifiants** :
  - `users/{uid}`, `members/{uid}` → `uid` Firebase Auth.
  - `participants/{characterId}` → id du personnage.
  - les autres → id auto-généré (`addDoc`).
- **Dénormalisation** :
  - `campaigns.memberIds: string[]` — tous les membres (MJ inclus). Pilote les
    règles et la requête « mes campagnes »
    (`where("memberIds", "array-contains", uid)`).
  - `characters.adjustedAbilityScores` / `abilityModifiers` / `maxHitPoints` /
    `proficiencyBonus` sont recalculés à chaque écriture via
    `computeCharacterDerived()` (mêmes règles côté formulaire et côté données).
- **Portée d'un personnage** : `characters/{id}` est **global**, possédé par un
  joueur, réutilisable dans plusieurs campagnes. Un `AdventureParticipant` porte
  un **inventaire et des notes propres à l'aventure**, sans modifier la fiche.
- **Qui lit une fiche** : son propriétaire, et le MJ et les membres des
  campagnes où elle a été engagée. La fiche les liste dans `campaignIds`,
  ajoutés par son propriétaire en même temps que la liste de ses personnages
  dans la campagne (`setMemberCharacter`, `joinCampaign`). La liste ne fait
  que grandir : une fiche retirée de la liste reste lisible de la campagne
  où elle a joué. Les règles ne vérifient que les **dix premières**
  campagnes.
- **Ce que les compagnons ne lisent pas** : `inventory`, `money`,
  `experiencePoints` et les `notes` d'une fiche standard
  (`CHARACTER_PRIVATE_FIELDS`) ne sont pas dans `characters/{id}`, que lisent
  tous les membres des campagnes de la fiche, mais dans
  `characters/{id}/private/belongings`, lu par le propriétaire et par le MJ
  d'une de ses campagnes (les **neuf premières**). `lib/characters.ts` lit et
  écrit les deux documents ensemble : la fiche lue reste entière. Une fiche
  pas encore migrée garde ces champs sur `characters/{id}` ; l'appli les lit
  là, et sa première écriture les déplace.

## Entités

### UserProfile — `users/{uid}`

Miroir du compte Firebase Auth. `uid`, `email`, `displayName`, `photoURL?`,
`bio?`, `locale` (défaut `"fr"`).

### Character — `characters/{characterId}` (5e 2024)

Fiche possédée par `ownerId`. `campaignIds?` : les campagnes où elle a été
engagée (voir « Qui lit une fiche »). L'inventaire, la bourse, l'XP (et les
notes d'une fiche standard) sont rangés à part, dans `private/belongings`
(voir « Ce que les compagnons ne lisent pas »). Champs saisis :

- `name`, `speciesId` (10 espèces), `speciesChoice?` (lignée / ascendance /
  héritage : la lignée elfique et l'héritage du Tieffelin modifient la fiche —
  vitesse, vision dans le noir, résistances, sorts accordés ; voir
  `dnd/species` → `lineages`), `speciesSpellAbility?` (`int` / `wis` / `cha` :
  caractéristique d'incantation des sorts de l'espèce, défaut = celle de la
  classe, sinon Charisme), `size?` (`tiny` … `gargantuan` : la taille choisie,
  seulement pour les espèces qui laissent le choix — Aasimar, Humain, Tieffelin :
  Petite ou Moyenne ; sinon l'espèce la fixe et le champ est absent, Moyenne par
  défaut ; voir `dnd/species` → `speciesSizes`),
  `classId` (12 classes), `backgroundId` (16 historiques), `alignment` (9),
  `lore?`, `level` (1–20, sélecteur ; alimente PV max et bonus de maîtrise).
- `languages: LanguageId[]` — langues **choisies** par le joueur (le popup ne
  propose que la liste 5e 2024, aucune création). Les langues accordées par la
  base (Commun), l'espèce et la classe (Druidique/Druide, Argot des
  voleurs/Roublard, langue thématique de l'espèce) sont **calculées** via
  `grantedLanguages()`, jamais stockées. Dictionnaire :
  `@adventure-keeper/schemas` → `dnd/languages`.
- `baseAbilityScores` — les 6 caractéristiques, **non pré-remplies** ; le
  formulaire propose un bouton « Valeurs conseillées » (tableau standard de la
  classe) + une aide Point Buy 27 pts non bloquante.
- `backgroundAbilityBonuses` — répartition du bonus d'historique : `+2/+1` ou
  `+1/+1/+1` sur les 3 caractéristiques de l'historique.
- `cantrips: string[]` / `spells: string[]` — ids de sorts choisis (mineurs et
  sorts à emplacement), uniquement pour les classes lanceuses de sorts. Le
  formulaire limite le nombre selon la classe et le niveau
  (`cantripsKnown()` / `preparedSpellsCount()` dans `dnd/spellcasting`), et ne
  propose que les sorts de la classe (≤ `maxSpellLevel()`). Aucun texte de sort
  n'est stocké : la « carte » d'un sort affiche ses **métadonnées** (nom,
  niveau, école, incantation, portée, composantes, durée, concentration,
  rituel, classes) depuis `dnd/spells` — la description complète reste dans le
  livre de règles.
- `eldritchInvocations: { id, spellId? }[]` — « manifestations occultes » de
  l'Occultiste (ids de `dnd/invocations` ; `spellId` = le sort mineur auquel
  s'attachent Décharge déchirante / répulsive et Lance occulte, répétables sur
  des sorts différents). Nombre limité selon le niveau (`invocationsKnown()`),
  prérequis de niveau / de Pacte / de sort mineur vérifiés par
  `validInvocations()`. Vide pour les autres classes. Les anciennes fiches
  stockant de simples ids restent lues (`normalizeInvocationPicks`).
  `pactWeaponId?` — id de l'arme de corps à corps désignée comme arme de pacte
  (Pacte de la lame : attaque et dégâts au Charisme, maîtrisée).
- `weapons: Item[]`, `armors: Item[]`, `tools: Item[]`, `inventory: Item[]`.
  Un **Item** =
  `{ id, name, lore?, consumable, quantity }`, édité dans un popup (crayon pour
  rouvrir, poubelle rouge pour supprimer). Un item créé depuis le **catalogue
  5e** (armes / armures / outils / matériel — JSON du pack de base chargé à la
  demande, `packages/system-dnd2024/src/srd/*.json`, comme `spells.json`) porte
  en plus `catalogId`,
  `priceCp`, `weightKg?` et le bloc structuré de sa catégorie : `weapon`
  (`category`, `damageDice`, `damageType`, `properties[]`, `mastery?`, `range?`,
  `versatileDice?`), `armor` (`category`, `baseAc?`, `acBonus?`, `addsDex`,
  `maxDex?`, `strengthMin?`, `stealthDisadvantage`, `equipped`) ou `tool`
  (`category`, `ability`).
- `toolProficiencies: string[]` — maîtrises d'outils **choisies** (ids
  catalogue : « au choix » de classe / historique). Les maîtrises fixes de
  classe + historique sont **calculées**, pas stockées. `toolExpertise: string[]`
  (≤ 2). `weaponMasteries: string[]` — ids d'items d'arme auxquels le joueur
  affecte un emplacement de Maîtrise d'arme (nombre selon classe + niveau).
- `wildShapeForms: string[]` — druide : les bêtes connues pour la Forme
  sauvage (ids du bestiaire, autant que le niveau en permet).
  `companions: Companion[]` — le familier : `id`, `kind` (`familiar`), `name`,
  `monsterId?`, `formName?`, `armorClass`, `maxHitPoints`, `currentHitPoints`,
  `speed`, `dexModifier`, `attacks[]` — chiffres **copiés** du bestiaire à
  l'invocation, comme un ennemi.
- `money` — `platinum` (pièces de platine) / `gold` (pièces d'or) / `electrum`
  (pièces d'électrum) / `silver` (pièces d'argent) / `copper` (pièces de
  cuivre). `platinum` et `electrum` valent 0 sur les fiches antérieures.
- `color?` (`#rrggbb`), `imageUrl?` (lien vers une image hébergée ailleurs,
  pas d'upload) + `imageCrop?` (`{ x, y, w, h }` en fractions 0–1 — zone carrée
  réutilisée comme icône, rognée en CSS sans retraitement).

Champs calculés (dénormalisés) : `adjustedAbilityScores` (base + historique),
`abilityModifiers` (`floor((score-10)/2)`), `maxHitPoints`
(dé de vie de la classe + mod. CON au niveau 1), `proficiencyBonus`,
`armorClass` (armure `equipped` selon sa catégorie + bouclier ; `10 + Dex` sans
armure), `speed` (base d'espèce, −10 ft sous armure lourde si Force
insuffisante), `armorProficient` (`false` si une armure équipée est hors de la
formation de la classe), `masterySlots`, `toolCheckModifiers`
(`{ [catalogId]: mod }`) et `weaponAttacks[]`
(`{ itemId, name, ability, attackBonus, damageDice, damageBonus, damageType,
proficient, mastery, masteryActive }`).
Liés à l'espèce : `size` (taille retenue), `darkvision` (ft, celle de la lignée si elle en donne une),
`resistances[]` (types de dégâts résistés : Nain, Aasimar, Drakéide, héritage
du Tieffelin), `speciesSpellcasting` (`{ ability, saveDc, attackBonus }` des sorts
de l'espèce) et `grantedSpells[]` (sorts « toujours préparés » de la classe,
de l'espèce **et** des manifestations occultes qui donnent un sort à volonté,
`source: "class" | "species" | "invocation"`).

Effets automatiques des manifestations occultes : Armure d'ombres (CA 13 + Dex
sans armure, dans `armorClass`), Vision du diable (`darkvision` 120 ft), Vision
sorcière (`truesight`), Présent des profondeurs (`swimSpeed`), Pacte de la lame
(`weaponAttacks[].ability: "cha"`, `pact: true`), rappels dans `combatNotes`.
Le calculateur de jets y ajoute, en « Autres sources », Décharge déchirante
(+ Cha aux dégâts du sort mineur choisi, par rayon pour Décharge occulte),
Buveuse de vie (+1d6 avec l'arme de pacte) et l'avantage d'Esprit occulte sur
un jet de sauvegarde de Constitution en concentration.

Données de référence 5e 2024 (espèces, classes, historiques, compétences,
alignements) et règles de calcul : `@adventure-keeper/schemas` →
`dnd/abilities`, `dnd/species`, `dnd/classes`, `dnd/backgrounds`,
`dnd/character-rules`.

### Campaign — `campaigns/{campaignId}`

`name`, `description?`, `system`, `systemLabel?`, `ownerId` (le MJ),
`memberIds[]`, `coverImageUrl?`, `isArchived`.

### CampaignMember — `campaigns/{campaignId}/members/{uid}`

`uid`, `role` (`gm` | `player`), `status` (`invited` | `active`),
`displayName`, `photoURL?`, `invitedEmail?` (ancien ajout direct par e-mail),
`inviteId?` (invitation utilisée pour rejoindre), `characterId?`, `joinedAt?`.

### CampaignInvite — `invites/{inviteId}`

Invitation à une campagne, top-level pour qu'un futur membre puisse la lire.
`kind` (`link` | `email`), `status` (`pending` | `accepted` | `declined` |
`revoked`), `campaignId`, et un instantané de ce qu'affiche l'écran pour
rejoindre : `campaignName`, `characterSystem`, `gmUid`, `gmName`. E-mail
seulement : `invitedUid`, `invitedName`, `respondedAt?`.

- **Lien** : l'id du document est le secret de l'URL `/join/{inviteId}`. Il
  reste `pending` (utilisable par plusieurs joueurs) jusqu'à ce que le MJ le
  désactive (`revoked`).
- **E-mail** : adressée à un compte existant, elle apparaît dans ses
  notifications. « Accepter » ouvre `/join/{inviteId}` ; elle passe `accepted`
  quand le joueur rejoint, `declined` s'il refuse.
- **Rejoindre** = un seul batch : création de `members/{uid}` (avec
  `inviteId` + `characterId`, vérifiés par les règles), ajout de l'uid à
  `campaigns/{id}.memberIds`, et pour un e-mail passage à `accepted`. On ne
  peut pas rejoindre sans personnage.

### ContentPackDoc — `contentPacks/{docId}` et CampaignPack — `campaigns/{id}/packs/{packId}`

Packs de contenu (format `ak-pack/1`) : bibliothèque d'un joueur, et copie
qu'un MJ autorise dans sa campagne. Détails dans
[`CONTENT_PACKS.md`](CONTENT_PACKS.md).

### Adventure — `campaigns/{campaignId}/adventures/{adventureId}`

Scénario créé par le MJ. `title`, `summary?`, `status`
(`draft` | `active` | `completed`), `order`, `createdBy`. Les aventures créées
avant octobre 2026 peuvent encore porter `standardEquipment` /
`standardEquipmentOffered` (équipement standard, retiré) : champs ignorés.

### AdventureLocation — `.../adventures/{id}/locations/{locationId}`

Un lieu tient en deux docs de même id, car les règles Firestore s'appliquent
par document, pas par champ :

- `locations/{id}` (lu par les joueurs dès qu'une session est en direct) :
  `name`, `hidden`, `order`, et `imageUrl` **seulement si le lieu n'est pas caché** ;
  `scale?` (`{from, to, metres, widthMetres}` : l'échelle de la carte, mesurée à
  la création ou à l'édition du lieu — deux points sur l'aperçu, leur distance
  réelle, et la largeur de la carte qui s'en déduit). Afficher la grille en
  session est un choix de chaque appareil (pas stocké ici).
- `locationSecrets/{id}` (**MJ seul**) : `description?`, `storagePath?` et
  l'`imageUrl` complète, cachée ou non.

Un joueur obtient la carte d'un lieu caché uniquement par l'instantané
`mapReveals/{locationId}` de la session, écrit quand le MJ affiche ce lieu (son
URL reste donc lisible tant que le lieu a été montré). `setLocationHidden` retire
ou remet `imageUrl` sur le doc public. Les lieux antérieurs à la scission portent
encore ces champs sur le doc public : le client du MJ les déplace au chargement
(`migrateLegacyLocations`), donc tant que le MJ n'a pas rouvert l'aventure, ils
restent lisibles.

### AdventureEnemy — `.../adventures/{id}/enemies/{enemyId}`

`name`, `description?`, `color?` (jeton), `size?`, `count`, `armorClass`,
`maxHitPoints`, `speed`, `abilityScores?`, `challengeRating?`, `attacks[]`
(`name`, `toHit?`, `reach?`, `damage?`, `notes?`), `imageUrl?`, `notes?`.
Le MJ crée des ennemis sur la page de l'aventure ; en session il en instancie
des combattants.

### AdventureEvent — `.../adventures/{id}/events/{eventId}`

`title`, `description?`, `trigger?`, `dueDay?` / `dueTime?` (moment prévu sur
l'horloge du jeu : le panneau du MJ dit « c'est l'heure », sans révéler seul),
`order`, `isRevealed`,
`revealedSessionId?`. Le MJ les prévoit sur la page de l'aventure et les coche
en séance ; le temps fort est alors copié sur la séance (`revealedEvents`), où
les joueurs le lisent même quand le contenu de l'aventure leur est fermé.

### AdventureParticipant — `.../adventures/{id}/participants/{characterId}`

`characterId`, `playerId`, `characterName`, `currentHitPoints?`, `notes?`,
`pendingXp?` (XP attribuée par le MJ, en attente d'encaissement) + les compteurs
de combat écrits par le joueur : `temporaryHitPoints?`, `deathSaves?`
(`{successes, failures}`), `heroicInspiration?`, `concentration?`
(`{spellId?, label}` | null), `spellSlotsUsed?` (`{"1".."9" | "pact": n}`),
`hitDiceUsed?`, `conditions?` (`Condition[]`), `exhaustion?` (0–6),
`initiativeRoll?` (l'initiative lancée depuis la fiche, reprise par la création
de combat puis effacée), `wildShape?` (`{monsterId, name}` | null : la bête dont
le druide a pris la forme). **Uniquement
de l'état de jeu** : l'équipement et l'inventaire ne sont pas copiés ici, la
session les lit et les écrit directement sur la fiche `characters/{characterId}`
(que le joueur possède). Le MJ crée/retire ces docs ; en session, le joueur y
écrit ses PV, compteurs et notes en direct.

### LiveSession — `.../adventures/{id}/liveSessions/{sessionId}`

Session de jeu en direct lancée par le MJ. `status`
(`live` | `paused` | `ended`), `startedBy`, `startedAt`, `endedAt?`,
`currentLocationId?` (le lieu affiché), `clockLabel?` (heure en jeu, `HH:MM`),
`gameDay?` (compteur de jours du jeu : il avance quand l'horloge passe minuit,
repris à la séance suivante comme `gameDate`),
`connectedUids: string[]` (qui est connecté), `attendeeUids: string[]` (qui a
rejoint au moins une fois), `visitedLocationIds`. Une seule session `live` par
aventure à la fois. Les clients s'y abonnent en temps réel (`onSnapshot`).

C'est aussi **la séance racontée** : `number` (rang dans l'aventure, posé au
démarrage), `revealedEvents[]` (instantané des temps forts révélés), et le
résumé **publié** : `title?`, `recap?` (Markdown), `recapPublishedAt?`. Un membre
ne peut pas écrire ces champs. Le brouillon et les notes privées vivent dans
`private/gm` (`titleDraft?`, `recapDraft?`, `gmNotes?`), lisible par le MJ seul :
les règles s'appliquant par document, un brouillon posé sur la séance serait
lisible des joueurs. `hiddenEntryIds` : entrées de journal écartées de la
chronique par le MJ. Publier copie le brouillon sur la séance et note
`Adventure.lastRecapAt` (badge « Nouveau résumé » et entrée de la cloche, tant
que le joueur n'a pas rouvert l'aventure — `lib/recap-seen.ts`, sur l'appareil).
`realtime?` (`{url, memberKey}`) : la séance se joue par un serveur temps réel
self-host ([REALTIME_SERVER.md](REALTIME_SERVER.md)) — combattants et combat
vivent alors dans sa salle, et ne reviennent ici qu'à la fin de la séance ; la
clé MJ de la salle est dans `private/gm` (`realtimeGmKey`). Écrit par le MJ seul.
`defeated[]` (`id` du combattant, `name`) : les ennemis tombés à 0 PV, notés
quand ils quittent le combat ou à sa fin (le combat est effacé ensuite) ; le
pré-remplissage les regroupe (« Gobelin ×3 »).

### SessionCombatant — `.../liveSessions/{sessionId}/combatants/{combatantId}`

Un combattant du combat en cours : `kind` (`participant` | `enemy` |
`companion`), `refId` (`characterId`, `enemyId` modèle, ou
`"<characterId>:<companionId>"` pour le familier d'un personnage), `name`, `color?`, `maxHitPoints`,
`currentHitPoints`, `armorClass`, `size?` (taille de la créature : le pion
couvre autant de cases à l'échelle de la carte), `onMap` + `x` / `y` (fractions 0–1 de l'image
du lieu → position du jeton), `playerId?`. Le MJ gère le roster et déplace les
jetons ; les PV du joueur sont synchronisés ici **et** sur `AdventureParticipant`.
Un joueur peut créer et retirer le jeton de **son** familier (`kind:
"companion"`, `playerId` = lui), et l'insérer dans l'ordre d'initiative.

> **Coût** : chaque écriture est relue par tous les clients abonnés. Les
> écritures en rafale passent donc par un tampon (`lib/write-buffer.ts`,
> `hooks/use-buffered-writes.ts`) : un jeton glissé est écrit au plus toutes les
> 300 ms et au lâcher, les PV et l'horloge réglés au +/− une fois les clics
> terminés (800 ms). Voir [`REALTIME_SERVER.md`](REALTIME_SERVER.md).

### CharacterChapter / JournalEntry — `characters/{id}/chapters`, `characters/{id}/journal`

L'histoire du personnage, sous la fiche (elle survit aux campagnes). Champs
communs : `ownerId`, `characterId`, `body` (Markdown), `visibility`
(`private` | `gm` | `party`) et `campaignId?`, obligatoire hors `private` :
`gm` = le MJ de cette campagne, `party` = ses membres (MJ compris). Les règles
lisent la campagne **en direct** (un nouveau venu lit les entrées passées) ;
une requête d'un autre lecteur doit donc filtrer sur `campaignId` **et**
`visibility` (une requête par visibilité).

- Chapitre : `title`, `order`, `imageUrl?` (illustration, lien externe). Le
  champ `lore` de la fiche reste le prologue ;
  `personality?` (`traits`, `ideals`, `bonds`, `flaws`) est sur la fiche 5e.
- Entrée de journal : `characterName`, `title?` et un contexte figé pour
  l'affichage (`campaignName?`, `adventureId?`, `adventureTitle?`, `sessionId?`,
  `sessionNumber?`). La chronique lit les entrées d'une séance par une requête
  _collection-group_ `journal` ; le MJ en écarte une en ajoutant son id à
  `LiveSession.hiddenEntryIds` (elle reste dans le journal).

### CodexEntry — `campaigns/{id}/codex/{entryId}`

Le monde tel que le groupe le connaît : `kind` (`npc` | `place` | `faction` |
`item` | `deity` | `document` | `other`), `name`, `summary` (ce que les joueurs
savent, Markdown), `imageUrl?`, `url?` (document hébergé ailleurs — pas
d'envoi de fichiers), `revealed`, `revealedAt?`, `adventureId?`,
`sourceNpcId?` / `sourceLocationId?`. Les joueurs ne lisent que les fiches
révélées (requête `where("revealed", "==", true)`) ; le secret du MJ est dans
`private/gm` (`secret?`). Un lieu montré en séance crée / révèle la fiche
`loc-{locationId}` (sans copier la carte d'un lieu caché). Les textes citent
une fiche par `[[Nom]]` (lien pour qui la connaît, texte simple sinon).

Un document montré en séance : `LiveSession.shownDocument?` (affiché sur tous
les écrans) et `shownDocuments[]` (historique figé, pour la chronique).

### Quest — `campaigns/{id}/quests/{questId}`

`title`, `summary` (Markdown, `[[mentions]]`), `status` (`rumor` | `active` |
`done` | `failed`), `revealed`, `order`, `milestones[]` (`kind` =
`revealed` ou un statut, `adventureId`, `sessionId`, `sessionNumber?`) : ce
qui lui est arrivé **en séance** (le bloc Quêtes du panneau du MJ), affiché
sur le tableau (« Accomplie en séance 5 (Le puits) ») et repris par le
pré-remplissage du résumé et la frise. Les joueurs lisent les quêtes
révélées (`where("revealed", "==", true)`) ; le MJ écrit.

### Mémoire de séance

Sur `LiveSession` : `gameDate?` (date du monde, texte libre, reprise à la
séance suivante) et `loot[]` (`id`, `name`, `quantity?`, `where?`), écrits par
le MJ. Dans `private/gm` : `quickNotes[]` (`at` en ms, `text`), proposées dans
l'éditeur de résumé. Sous la séance, `quotes/{quoteId}` : `text`, `speaker?`,
`authorUid` — tout membre en crée sous son nom ; l'auteur ou le MJ supprime.
Sur `CodexEntry`, `reputation?` (−3…+3) : attitude d'une faction.

### Note / Resource — le carnet du MJ

Notes et ressources de préparation, **réservées au MJ** (les champs
`visibility` des anciens documents ne servent plus). Ce qui est destiné aux
joueurs passe par la chronique et le codex.

## Règles de sécurité

Voir [`firestore.rules`](../firestore.rules). `inCampaign()` = membre de la
campagne parente ; `ownsCampaign()` = MJ (propriétaire) de la campagne parente.

| Ressource                                             | Lecture                                                             | Écriture                                                                  |
| ----------------------------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `users/{uid}`                                         | tout utilisateur connecté                                           | le propriétaire                                                           |
| `characters/{id}`                                     | propriétaire ; MJ et membres des `campaignIds` (les dix premières)  | le propriétaire (`ownerId`)                                               |
| `characters/{id}/private/belongings`                  | propriétaire ; MJ des `campaignIds` (les neuf premières)            | le propriétaire                                                           |
| `invites/{id}`                                        | lien : tout connecté (par id, pas de liste) ; e-mail : MJ ou invité | MJ (créer / désactiver / supprimer) ; invité (accepter / refuser)         |
| `campaigns/{id}`                                      | MJ ou membre                                                        | MJ (membre : mise à jour limitée ; invité : s'ajouter à `memberIds`)      |
| `.../members`                                         | MJ ou membre                                                        | MJ ; le joueur se crée via une invitation valide, avec **son** personnage |
| `contentPacks/{id}`                                   | propriétaire, destinataires ; par id si `linkSharing`               | propriétaire ; un destinataire s'ajoute (lien) ou se retire               |
| `.../packs` (campagne)                                | MJ ou membre                                                        | MJ                                                                        |
| `.../adventures` (+ `locations`, `enemies`, `events`) | MJ ou membre (`locationSecrets` : MJ seul)                          | MJ                                                                        |
| `.../adventures/.../participants`                     | MJ ou membre                                                        | MJ (ajout/retrait) ; le joueur édite **son** doc                          |
| `.../adventures/.../liveSessions`                     | MJ ou membre                                                        | MJ (créer/piloter/terminer) ; membre (rejoindre)                          |
| `.../liveSessions/.../combatants`                     | MJ ou membre                                                        | MJ (roster) ; membre (déplacer jeton / PV, son familier)                  |
| `.../liveSessions/.../private`                        | MJ                                                                  | MJ                                                                        |
| `characters/{id}/chapters`, `.../journal`             | propriétaire ; `party` → membres de `campaignId` ; `gm` → son MJ    | le propriétaire                                                           |
| `.../notes`, `.../resources`                          | MJ                                                                  | MJ                                                                        |
| `.../codex`, `.../quests`                             | MJ ; membre si `revealed`                                           | MJ                                                                        |
| `.../liveSessions/.../quotes`                         | MJ ou membre                                                        | créer : MJ ou membre (soi-même) ; supprimer : auteur ou MJ                |
| `.../codex/.../private`                               | MJ                                                                  | MJ                                                                        |

## Index composites

Déclarés dans [`firestore.indexes.json`](../firestore.indexes.json) :

- `campaigns` : `memberIds ARRAY_CONTAINS` + `updatedAt DESC`.
- `characters` : `ownerId ASC` + `updatedAt DESC`.
- `adventures` : `status ASC` + `order ASC`.
- `notes` : `pinned DESC` + `updatedAt DESC` ; `visibility ASC` + `updatedAt DESC`.
- `journal` (collection-group) : `campaignId` + `sessionId` + `visibility` ;
  `ownerId` + `sessionId`. Requis par la chronique.

> Les pages listes actuelles trient **côté client** ; ces index ne sont requis
> que lorsqu'un `orderBy` Firestore sera ajouté aux requêtes.

Déploiement : `pnpm firebase:deploy:rules` (ou le workflow
`firebase-firestore-rules.yml`).
