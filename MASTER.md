# Radar : charte graphique (MASTER)

Source unique du design de Radar. Toute couleur, taille, marge, ombre, rayon et animation du site vient d'ici
(jetons dans `src/app/globals.css`). Validée par Maksen le 30/09/2026, après 3 séries de propositions
(planche : « Radar : directions visuelles », écran « Ta combinaison »).

## Thèses validées

**Visuelle.** Interface claire de logiciel professionnel : fond gris-vert très clair, navigation en colonne
d'icônes vert nuit puis liste des enquêtes, un seul vert d'action (#0B7A55) réservé aux actions et au verdict
« Prometteur », ambre pour « À creuser » ; police Onest (titres 25 px gras, chiffres clés en grand, texte
14 px) ; cartes blanches arrondies à ombre très légère, espacements aérés, graphiques plats.

**Mouvement.** Rapide et discret (150 à 250 ms, sortie douce) ; survol = léger changement de fond, jamais
d'agrandissement ; en direct, chaque nouvelle étape de l'agent entre par un court fondu vers le haut ; rien au
défilement ; interdits : rebond, néon, halo, dégradé animé, parallaxe, agrandissement au survol.

Ce que Maksen a refusé (à ne pas refaire) : papier et presse, terminal sombre, sonar, grille suisse, carnet
arrondi (« trop sobre ») ; cinéma lumineux, radar de science-fiction, pop néo-brutaliste, luxe noir et or
(« ça fait trop IA »). Il veut « un vrai truc professionnel » : un logiciel, pas une affiche.

## Couleurs

| Jeton | Valeur | Usage |
|---|---|---|
| `--c-nuit` | #0F1B17 | colonne d'icônes, texte principal, bouton sombre |
| `--c-nuit-2` | #1C2B25 | icône active de la colonne |
| `--c-menthe` | #3DDC97 | logo, repère de l'icône active (jamais pour du texte sur fond clair) |
| `--c-vert` | #0B7A55 | action principale, verdict « Prometteur », liens |
| `--c-vert-fonce` | #085F42 | survol de l'action principale et des liens |
| `--c-vert-clair` | #E7F5EE | élément sélectionné (liste d'enquêtes) |
| `--c-vert-pale` | #E3F6EC | fond des coches de preuve |
| `--c-sur-vert` | #CFF2E2 | texte secondaire sur fond vert |
| `--c-fond` | #F3F5F4 | fond de page |
| `--c-surface` | #FFFFFF | cartes, colonne des enquêtes |
| `--c-surface-2` | #F7F9F8 | zone en retrait dans une carte, en-tête de tableau |
| `--c-texte` | #0F1B17 | texte |
| `--c-texte-2` | #3D4A44 | texte courant secondaire |
| `--c-doux` | #5B6B64 | légendes, libellés (5,6:1 sur blanc) |
| `--c-bordure` | #DDE5E1 | bordures, séparateur de la colonne |
| `--c-trait` | #EEF2F0 | lignes de tableau, séparateurs internes |
| `--c-ambre` | #C98A1B | pastille « À creuser », avertissement |
| `--c-ambre-texte` | #8A5D0F | texte « À creuser » (5,8:1 sur blanc) |
| `--c-ambre-pale` | #FBF1DE | fond d'avertissement |
| `--c-rouge` | #B42318 | « Décevant », erreur |
| `--c-rouge-pale` | #FDECEA | fond d'erreur |
| `--c-graph-1` à `-4` | #9FE3C4, #6FD1A6, #2FAF7B, #0B7A55 | barres des graphiques, du plus bas au plus haut |

Contrastes vérifiés : blanc sur `--c-vert` 5,3:1 ; `--c-doux` sur `--c-fond` 5,2:1 ; `--c-sur-vert` sur
`--c-vert` 4,6:1 ; texte de la colonne (#B8C6BF) sur `--c-nuit` 10:1.

## Typographie

Police unique : **Onest** (Google Fonts, 400, 500, 600, 700), via `next/font`.

| Jeton | Taille / interligne | Graisse | Usage |
|---|---|---|---|
| `--t-titre` | 25 px / 1,2 | 700, lettrage −0,02em | titre de page |
| `--t-chiffre` | 24 px / 1,15 (30 px en vedette) | 700 | chiffres clés |
| `--t-section` | 16 px / 1,3 | 700 | titre de carte |
| `--t-texte` | 14 px / 1,5 | 400 à 600 | texte courant, boutons |
| `--t-petit` | 13 px / 1,45 | 400 | libellés, fil d'Ariane |
| `--t-mini` | 12 px / 1,4 | 400 à 600 | légendes, pastilles |

Chiffres : `font-variant-numeric: tabular-nums` dans les tableaux seulement (colonnes alignées). Jamais sur un grand chiffre isolé (prix, chiffre clé) : le « 1 » y paraît décollé (« 1 9 € », 30/09).

## Espacements, rayons, ombres

- Base 4 px : 4, 8, 12, 16, 20, 24, 28, 32, 40. Marge intérieure des cartes 16 à 18 px ; espace entre cartes 14 px ;
  marges de page 24 × 28 px.
- Rayons : 6 px (petits éléments), 10 px (boutons, lignes de liste, champs), 14 px (cartes), 999 px (pastilles).
- Ombres : carte `0 1px 2px rgba(15,27,23,.06)` ; carte survolée (cliquable seulement) `0 2px 8px rgba(15,27,23,.08)` ;
  aucune autre.
- Anneau de focus : `0 0 0 3px rgba(11,122,85,.35)`, toujours visible au clavier (`:focus-visible`).

## Mouvement

| Jeton | Valeur | Usage |
|---|---|---|
| `--m-rapide` | 150 ms | survol, focus |
| `--m-normal` | 200 ms | apparition d'une étape, ouverture d'un élément |
| `--m-lent` | 250 ms | changement de page ou de panneau |
| `--m-courbe` | cubic-bezier(.2,.7,.2,1) | toutes les transitions |

- Nouvelle étape de l'agent : opacité 0 → 1 et translation 6 px → 0, 200 ms. Sortie : opacité seulement, 150 ms.
- Survol : fond et couleur seulement. Appui : fond plus foncé. Jamais `transform: scale`.
- `prefers-reduced-motion: reduce` : plus aucune translation, changements instantanés.

## Composants de base (5 états : repos, survol, focus, appui, désactivé)

- **Bouton principal** : fond `--c-vert`, texte blanc 14 px 600, rayon 10, marge 10 × 16. Survol `--c-vert-fonce`.
  Désactivé : opacité 0,5, curseur interdit.
- **Bouton sombre** : fond `--c-nuit`, texte blanc (« Télécharger le rapport »). Survol `--c-nuit-2`.
- **Bouton secondaire** : fond blanc, bordure `--c-bordure`, texte `--c-texte`. Survol fond `--c-surface-2`.
- **Carte** : fond blanc, rayon 14, ombre carte, marge 16 à 18.
- **Carte verdict** : fond `--c-vert` (Prometteur), `--c-ambre-pale` + texte `--c-ambre-texte` (À creuser),
  `--c-rouge-pale` + texte `--c-rouge` (Décevant).
- **Pastille de verdict** (liste) : point de 7 px + libellé 12 px de la couleur du verdict.
- **Ligne de preuve** : coche (rond `--c-vert-pale`, trait `--c-vert`) + affirmation 600 + citation 12,5 px `--c-doux`
  + source à droite ; séparateur `--c-trait`.
- **Tableau** : en-tête `--c-surface-2` texte `--c-doux` 12,5 px ; lignes séparées par `--c-trait` ; survol de ligne
  `--c-surface-2`.
- **Graphique** : barres plates `--c-graph-1..4`, valeur au-dessus en 12 px 700, axe en `--c-trait` ; toujours un
  tableau équivalent pour les lecteurs d'écran.
- **Colonne d'icônes** : 72 px, fond `--c-nuit`, icônes trait 1,6 px `#B8C6BF`, icône active fond `--c-nuit-2`
  + repère gauche 3 px `--c-menthe`, `aria-label` sur chaque icône.
- **Liste des enquêtes** : 264 px, fond blanc, bouton « + Nouvelle enquête » en tête, élément sélectionné
  `--c-vert-clair`, jauge de l'offre gratuite en pied.
