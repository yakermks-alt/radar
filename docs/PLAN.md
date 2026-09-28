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
- [ ] (Toi) Créer la clé de l'API Sirene sur portail-api.insee.fr et la mettre dans `.env.local` (`INSEE_API_KEY`)
- [ ] (Claude) Ajouter la clé Insee aux secrets GitHub pour la tâche de nuit
- [ ] (Claude) Élargir la liste d'applis (plus de termes de recherche par métier)

**Fin de phase :** chaque opportunité affiche ses besoins, les faiblesses des applis en place et la taille réelle du marché.

## Phase 4 : l'agent enquêteur (semaines 4 et 5)

**But :** le cœur compliqué, et la démo qui impressionne.

- [ ] (Claude) Outils de l'agent : chercher sur le web, lire une page, interroger les données entreprises, chercher dans les avis par sens
- [ ] (Claude) Boucle de l'agent : il choisit ses outils lui-même, avec un budget maximal par enquête (nombre d'étapes, quota)
- [ ] (Claude) Rapport structuré (concurrents et leurs prix, taille du marché, angle d'attaque, risques). Chaque phrase cite sa source, sinon elle est rejetée
- [ ] (Claude) Chaque étape de l'agent est une exécution courte, état enregistré en base, étape suivante en file d'attente (reprise après coupure), étapes affichées en direct à l'écran
- [ ] (Claude) Protection contre les pages web piégées (instructions cachées destinées à l'agent)

**Fin de phase :** on tape « logiciels pour boulangeries », on regarde l'agent enquêter, et on obtient un rapport sourcé en quelques minutes.

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
