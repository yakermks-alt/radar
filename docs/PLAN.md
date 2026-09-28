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

## Phase 2 : comprendre les plaintes (semaine 2)

**But :** transformer des avis bruts en problèmes clairs.

- [ ] (Claude) Tri par l'IA : simple bug, ou vrai besoin non couvert ?
- [ ] (Claude) Extraction structurée de chaque plainte : problème, type de client, gravité, signe qu'il paierait
- [ ] (Claude) Embeddings calculés en local dans GitHub Actions (modèle multilingue open source, 0 quota), 384 à 768 dimensions pour tenir dans les 500 Mo
- [ ] (Claude) Regroupement des plaintes par sens, puis nommage de chaque groupe par l'IA
- [ ] (Claude) Score de chaque groupe : fréquence, prix payé aujourd'hui, faisabilité
- [ ] (Claude) Première page : « Top 20 des problèmes », avec les vraies citations
- [ ] (Toi) **Point de décision :** juger les regroupements. S'ils ne sont pas intéressants, on corrige le tri ou les sources avant de construire l'agent

## Phase 3 : sources supplémentaires (semaine 3)

**But :** ne dépendre d'aucune source unique (leçon de GummySearch, fermé en 2025 après la coupure de l'API Reddit).

- [ ] (Claude) API Recherche d'entreprises : nombre d'entreprises par métier et par zone (taille du marché)
- [ ] (Claude) BOAMP : besoins exprimés par les collectivités
- [ ] (Claude) Hacker News : tendances tech
- [ ] (Claude) Fusion : chaque problème regroupe ses preuves de toutes les sources

**Fin de phase :** chaque opportunité affiche des plaintes, la taille du marché et des signaux publics.

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
