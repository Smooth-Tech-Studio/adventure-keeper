# Maquettes

## Les maquettes restent libres

Les maquettes (`docs/mockups/*.html`, non versionnées) sont des pages HTML autonomes, écrites
sans les composants de l'application. C'est voulu : elles laissent la place à
de vraies idées de design, sans se limiter à ce que les composants savent déjà
faire.

## Le thème de l'application est respecté

Cette liberté porte sur la disposition et sur les composants, pas sur le
thème. Sauf demande explicite de Rémi, maquettes et implémentations gardent
le thème de l'application (`apps/web/src/index.css`) : couleurs, typographie,
arrondis, clair et sombre. On peut adapter certains composants, ou en
proposer de nouveaux, tant qu'ils restent dans ce thème.

## Les composants reposent sur shadcn/ui

Tous les composants de l'application sont construits sur la bibliothèque
shadcn/ui (`apps/web/src/components/ui`, configuration dans
`apps/web/components.json`, style « new-york », icônes Lucide). Quand un
élément d'interface existe dans shadcn (onglets, accordéon, badge, carte,
infobulle…), on ajoute le composant shadcn s'il manque (`npx shadcn add …`)
et on l'utilise, au lieu de le refaire à la main. Une variante propre à
l'application s'écrit autour du composant shadcn, sans le remplacer.

## À l'implémentation, le code s'adapte à la maquette

Quand une maquette validée est implémentée, le rendu doit être celui de la
maquette. On ne reprend pas les composants existants tels quels en acceptant
un résultat différent : on les fait évoluer.

1. **Relever les écarts** entre la maquette et les composants concernés :
   disposition, espacements, tailles, couleurs, états.
2. **Faire évoluer les composants** : nouvelles variantes, nouvelles props,
   styles revus, jusqu'à retrouver le rendu de la maquette.
3. **Signaler les effets ailleurs** : si un composant modifié sert à d'autres
   écrans, dire lesquels changent avant de commiter.
4. **Vérifier par capture** : comparer l'application et la maquette, sur
   téléphone et sur ordinateur.

# Suivi des évolutions : `INCOMING_UPDATES.md`

`INCOMING_UPDATES.md` liste les évolutions demandées. Il est tenu à jour au fil
du travail, sans attendre qu'on le demande :

- **Nouvelle demande** (idée, retour de test, bug à traiter plus tard) : une
  ligne dans le tableau (nom avec ancre, description courte, attribution,
  statut) et une section rangée dans la bonne partie : ce qui existe
  aujourd'hui, ce qui est proposé, et les points à trancher.
- **Décision prise** sur un point à trancher : remplacer la question par la
  décision.
- **Travail commencé ou terminé** : passer le statut à « En cours » puis
  « Fait », avec le numéro de PR ; dans les listes de retours, cocher ✅.
- **Ménage** : dès que plus de 10 lignes du tableau sont « Fait », proposer de
  retirer les lignes « Fait » et leurs sections (l'historique git les garde),
  et ne le faire qu'avec l'accord de Rémi.
