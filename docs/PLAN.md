# Radar : plan d'action

> SaaS d'entraînement (apprendre + impressionner), côté business, 100 % gratuit.
> Un agent IA qui repère des opportunités business sur le marché francophone à partir de plaintes réelles de clients, enquête seul sur chacune et rend un rapport sourcé.
> Démarré le 28/09/2026. Durée estimée : 6 à 8 semaines.

**Stack :** Next.js, Supabase (Postgres + pgvector + Realtime), Netlify, Gemini (offre gratuite), GitHub Actions pour les tâches de nuit, Resend, Stripe en mode test.

**Règle pour tout le projet :** à la fin de chaque phase, il y a quelque chose de montrable. Tests automatiques dès le premier jour.

(Toi) = action humaine, (Claude) = à faire par Claude.

---

## Décisions prises (28/09)

- **Base de données :** Supabase, en libérant une place (l'offre gratuite n'accepte que 2 projets actifs)
- **Nom :** Radar
- **Associés :** à décider selon l'avancée du produit

---

## Phase 0 : cadrage et vérifications (1 à 2 jours)

**But :** ne rien construire sur une hypothèse fausse.

- [x] (Toi) Libérer une place de projet Supabase gratuit (28/09)
- [x] (Toi) Créer le projet Supabase Radar (28/09)
- [x] (Claude) Vérifier les vraies limites gratuites (28/09) : voir `LIMITES.md`. Gemini Flash limité à ~20 requêtes/jour, donc Flash-Lite pour presque tout, embeddings en local, agent découpé en petites étapes hors de Netlify
- [x] (Toi) Projet Google AI Studio dédié et clé Gemini (28/09)
- [x] (Toi) Repo public : https://github.com/yakermks-alt/radar (28/09)
- [x] (Claude) Migration 0001 (applis, avis, groupes, journal, pgvector), 19 tests de la base, `npm run verifier`, CI GitHub, blocage des secrets avant commit et détection GitHub activée (28/09)
- [x] (Toi) Migration 0001 appliquée (28/09)
- [x] (Toi) Clé secrète Supabase en place (28/09)

**Fin de phase :** le repo tourne, la base est prête, les limites sont connues et notées.

## Phase 1 : collecte des données (semaine 1)

**But :** avoir de la matière première réelle.

- [x] (Claude) 215 applis pro françaises dans 17 secteurs (recherche App Store + tri par Gemini Flash-Lite), `data/apps.json` (28/09)
- [x] (Claude) 7 erreurs de tri écartées à la main (`data/exclusions.json`), 208 applis gardées (28/09)
- [x] (Claude) Collecte incrémentale des avis (jusqu'à 500 par appli, pseudos jamais stockés), testée (28/09)
- [x] (Claude) Tâche de nuit GitHub Actions (4 h 30), journal de chaque passage en base (28/09)

**Fin de phase :** plusieurs dizaines de milliers d'avis en base, mis à jour chaque nuit sans intervention.

**Bilan du 28/09 :** première collecte complète en 11 minutes sur GitHub, 0 erreur : 10 196 avis, dont 3 828 à 1-2 étoiles. Moins que prévu, car Apple ne sert que les ~500 avis les plus récents par appli et beaucoup d'applis en ont moins. Suffisant pour la phase 2 ; le volume grandira chaque nuit. Piste si besoin : ajouter Google Play.

## Phase 2 : comprendre les plaintes (semaine 2)

**But :** transformer des avis bruts en problèmes clairs.

- [x] (Claude) Tri par l'IA : 4 141 avis (1 818 bugs, 1 007 besoins, 586 support, 499 prix, 231 inexploitables), 5 lots en parallèle (28/09)
- [x] (Claude) Extraction structurée : problème reformulé sans marque, type de client, gravité, signal de paiement (28/09)
- [x] (Claude) Embeddings en local (paraphrase-multilingual-MiniLM-L12-v2, 384 dimensions, 0 quota) (28/09)
- [x] (Claude) Regroupement par sens (seuil 0,70), fusion des groupes proches (0,80), nommage par l'IA : 150 groupes (28/09)
- [x] (Claude) Score sur 10 : potentiel (fréquence, nb d'applis, argent, gravité, vrai besoin) multiplié par la faisabilité (28/09)
- [x] (Claude) Page « Top 20 des problèmes » avec citations (en local) (28/09)
**Constat du 28/09 :** 88 groupes sur 150 sont des plaintes universelles (support injoignable, hausse des prix, interface compliquée) qui touchent tous les logiciels. Le haut du classement est donc générique, pas encore des opportunités de niche. Cause : le problème reformulé perd le contexte du métier, et bugs, support et prix sont mélangés aux vrais besoins.
- [x] (Claude) Version 2 (28/09) : opportunités tirées des 832 vrais besoins formulés avec le métier, bugs/support/prix affichés comme faiblesses des applis en place, pénalité de dispersion. 61 groupes ; en tête : commerciaux (appli mobile complète), notes de frais, facturation mobile des auto-entrepreneurs, dossier de soins mobile des infirmières libérales
- Limites connues : doublons entre groupes proches (notes de frais, commerciaux) ; faisabilité jugée par l'IA sur un petit échantillon, parfois trop sévère (chauffeurs VTC notés 2/10 car le groupe mêle suivi des revenus, faisable, et pénalités des plateformes, hors de portée) ; peu de volume (832 besoins). L'agent de la phase 4 et Google Play (phase 3) répondront à ces points
- [ ] (Toi) **Point de décision :** juger les regroupements. S'ils ne sont pas intéressants, on corrige le tri ou les sources avant de construire l'agent

## Phase 3 : sources supplémentaires (semaine 3)

**But :** plus de matière, et la taille réelle de chaque marché, sans dépendre d'une source fragile.

**Décisions du 28/09 :** pas de Google Play (conditions d'utilisation interdisant la collecte, repo public, risque de blocage : la leçon de GummySearch). BOAMP et Hacker News mis de côté (collent mal aux niches de TPE françaises). À la place : App Stores francophones et taille du marché.

- [x] (Claude) Collecte sur les App Stores France, Belgique, Suisse et Canada (même flux officiel) (28/09)
- [x] (Claude) Taille du marché : l'IA associe chaque opportunité à des codes NAF, nombre d'entreprises actives via l'API Sirene de l'Insee, nouveau critère du score (28/09)
- [x] (Toi) Clé de l'API Sirene créée (29/09)
- [x] (Claude) Clé Insee dans les secrets GitHub et la tâche de nuit (29/09)
- [x] (Claude) Comptage corrigé : sans le paramètre `date`, Sirene comptait aussi les entreprises actives par le passé (82 765 boulangeries au lieu de 40 561) (29/09)
- [ ] (Claude) Avant le 5 janvier 2027 : Sirene ne diffusera plus que les codes NAF 2025 ; adapter la correspondance métier → codes NAF (sinon les comptages tombent à 0)
- [ ] (Claude) Élargir la liste d'applis (plus de termes de recherche par métier)

**Fin de phase :** chaque opportunité affiche ses besoins, les faiblesses des applis en place et la taille réelle du marché.

## Phase 4 : l'agent enquêteur (semaines 4 et 5)

**But :** le cœur compliqué, et la démo qui impressionne.

**Constat du 29/09 :** la recherche Google intégrée à Gemini n'est plus gratuite (« Not available » en offre gratuite, refus 429). Remplacée par Tavily (1 000 recherches/mois gratuites, sans carte). Voir `docs/LIMITES.md`.

- [x] (Claude) Outils de l'agent : chercher sur le web (Tavily), lire une page, fiches officielles d'entreprises (API Recherche d'entreprises), chercher dans les avis par sens (pgvector) (29/09)
- [x] (Claude) Boucle de l'agent : il choisit ses outils lui-même (Flash-Lite), budget d'étapes par enquête, rédaction forcée à la dernière étape, un outil en panne devient une étape ratée et l'agent change d'approche (29/09)
- [x] (Claude) Rapport structuré en 5 sections (problème, concurrents et prix, taille du marché, angle d'attaque, risques) : chaque affirmation doit citer mot pour mot une source lue, sinon elle est rejetée et listée (29/09)
- [x] (Claude) État en base après chaque étape (migration 0004 : `enquetes`, `etapes`, `sources`), verrou par enquête, reprise après coupure, file d'attente (`--file`) (29/09)
- [x] (Claude) Protection contre les pages piégées : texte caché retiré, instructions pour IA repérées (page marquée suspecte), zones « données non fiables » impossibles à refermer depuis la page, seules les URL trouvées par la recherche sont lisibles, adresses internes refusées (29/09)
- [x] (Toi) Migration `0004_enquetes.sql` collée, clé Tavily en place (29/09)
- [x] (Claude) Première vraie enquête (facturation mobile des auto-entrepreneurs) : 11 étapes, reprise après une coupure, rapport de 6 affirmations sourcées, 1 rejetée (29/09). Réglages faits en route : rédaction refusée tant que 2 pages n'ont pas été lues (l'agent voulait rédiger sur de simples extraits), bilan de couverture rappelé à chaque tour, repli automatique du modèle de rédaction (Gemini 3.8 Flash et 3.5 Flash saturés ce jour-là, rapport écrit par Flash-Lite)
- [x] (Claude) Qualité des rapports, sur 3 enquêtes (29/09) : prix découpés en plusieurs balises recollés (« 5 ,40 » → « 5,40 ») ; citations comparées mot à mot en ignorant la ponctuation, coupures « … » acceptées si chaque morceau est exact ; outil « entreprises » qui compte aussi un code NAF (Insee) ; **relecture du sens** par l'IA (une citation qui existe mais ne prouve pas l'affirmation est rejetée) ; recherches presque identiques refusées ; consignes par section. Résultat : enquête 1 = 6 affirmations et pas de prix ; enquête 3 (infirmières libérales) = 9 affirmations dont 4 plaintes, 1 prix, la taille du marché et un risque, 4 rejetées (1 introuvable, 3 hors sujet)
- Limite connue : Gemini 3.8 Flash et 3.5 Flash saturés toute la journée du 29/09, rapports écrits par Flash-Lite. Le choix du code NAF par l'agent est parfois approximatif (70.22Z « conseil » pour « entreprises avec des commerciaux »)
- [x] (Claude) Pages « Enquêtes » et « enquête en direct » (29/09) : lancement depuis un sujet ou depuis une opportunité du Top 20, code d'accès (obligatoire en ligne), 10 enquêtes par jour au maximum, adresse secrète par enquête (migration 0005), étapes affichées en direct (Supabase Realtime : le signal ne transporte rien, la page relit la base), bouton « Reprendre » après une interruption. Testé de bout en bout dans un navigateur : lancement, 8 étapes en direct, interruption (Gemini trop lent), reprise, rapport affiché sans recharger
- [x] (Claude) Robustesse : délai par appel Gemini (réponse comprise) puis modèle suivant, règle des recherches en double revue (un nom de concurrent ajouté = nouvelle recherche) (29/09)
- [x] (Claude) Workflow GitHub `enquete.yml` prêt pour la mise en ligne (numéro vérifié avant usage), clé Tavily dans les secrets (29/09)
- [x] (Claude) **Mise en ligne** (29/09) : https://radar-opportunites.netlify.app (équipe Netlify workflowly, site `radar-opportunites`). Variables : URL et clé publique Supabase, clé secrète Supabase et code d'accès en secret (production et aperçus). Pas de clé Gemini/Tavily/Insee sur Netlify : l'agent tourne sur GitHub. En-têtes de sécurité (CSP sur le seul projet Supabase). Connexion Netlify obligatoire gardée sur les aperçus seulement. Publication : `netlify deploy --prod` répond « Forbidden » (comme pour Liǎng) ; contournement : `npx netlify deploy --build` puis `npx netlify api restoreSiteDeploy --data '{"site_id":"32657b1d-c544-4120-877f-2a5238728c89","deploy_id":"<id>"}'`
- [x] (Claude) Test en production : agent lancé sur GitHub (`enquete.yml`), suivi en direct sur le site en ligne (8 signaux temps réel reçus, rapport affiché sans recharger), aucune erreur navigateur ; mauvais code d'accès refusé (29/09)
- [ ] (Toi) Jeton GitHub à droits limités (dépôt radar, « Actions : lecture et écriture ») dans `.env.local` (`GITHUB_DISPATCH_TOKEN`) ; Claude le pose sur Netlify et republie : le bouton « Lancer l'enquête » du site marchera alors

**Fin de phase :** on tape « logiciels pour boulangeries », on regarde l'agent enquêter, et on obtient un rapport sourcé en quelques minutes. **Atteint en local le 29/09** (reste la mise en ligne).

## Phase 5 : fiabilité (semaine 6)

**But :** passer de « ça marche parfois » à « ça marche ».

- [ ] (Claude) Banc de tests : 20 enquêtes de référence, avec vérification automatique que chaque citation existe dans sa source
- [ ] (Claude) Mesure du taux d'invention, puis corrections jusqu'à un seuil acceptable
- [ ] (Claude) Cache des pages déjà lues, relances automatiques, garde-fous sur les quotas gratuits
- [ ] (Claude) Suivi de chaque enquête : durée, étapes, quota consommé, échecs

**Fin de phase :** des chiffres de fiabilité réels à montrer.

## Phase 6 : le produit SaaS (semaine 7)

**But :** le socle SaaS complet.

- [ ] (Claude) Comptes et connexion, espaces d'équipe, invitations
- [ ] (Claude) Tableau « à valider » : à creuser, entretien fait, abandonnée, on se lance
- [ ] (Claude) E-mail du matin : 3 opportunités du jour
- [ ] (Claude) Stripe en mode test. Gratuit : 3 opportunités par jour, 1 enquête par semaine. Payant : illimité + alertes par secteur. Webhooks et limites appliquées côté serveur
- [ ] (Claude) Page admin : utilisateurs, enquêtes, erreurs, quotas

**Fin de phase :** un vrai SaaS utilisable par quelqu'un d'autre.

## Phase 7 : finition, sécurité, démo (semaine 8)

**But :** que ce soit beau et solide.

- [ ] (Toi + Claude) Design : 4 à 5 directions visuelles concrètes, choix, puis validation écran par écran
- [ ] (Claude) Page d'accueil, page tarifs, première connexion guidée
- [ ] (Claude) Audit de sécurité complet (accès à la base, API, injection dans l'agent, secrets) + attaque en direct
- [ ] (Claude) Performances et affichage sur mobile
- [ ] (Toi) Vidéo de démo de 60 secondes

**Fin de phase :** un lien public, une vidéo, un projet montrable.

## Phase 8 : l'utiliser pour de vrai (en continu)

- [ ] (Toi) S'en servir pour choisir le prochain projet business
- [ ] (Toi) Le faire tester à 5 ou 10 personnes (entrepreneurs, freelances) et récolter leurs retours
- [ ] (Toi) Décider : projet d'entraînement, ou vrai produit
