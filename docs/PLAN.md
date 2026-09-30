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
- [x] (Claude) Passage à la NAF 2025 préparé (30/09) : table de passage officielle de l'Insee (`data/naf-rev2-vers-naf2025.json`, édition janvier 2026), bascule automatique le 5 janvier 2027 (un code rév. 2 est converti et ses codes 2025 additionnés ; un code 2025 est accepté tel quel). Vérifié sur Sirene avec le champ NAF 2025 déjà diffusé : infirmiers 146 889 contre 148 915 (−1,4 %), boulangeries 36 540 contre 40 557 (−10 %, codes 2025 pas encore attribués à toutes les entreprises)
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
- [x] (Toi + Claude) Jeton GitHub à droits limités (dépôt radar seulement, « Actions : lecture et écriture ») posé sur Netlify ; enquête lancée depuis le site en ligne, menée par GitHub et suivie en direct jusqu'au rapport (29/09). **Phase 4 terminée**

**Fin de phase :** on tape « logiciels pour boulangeries », on regarde l'agent enquêter, et on obtient un rapport sourcé en quelques minutes. **Atteint le 29/09, en ligne.**

## Phase 5 : fiabilité (semaine 6)

**But :** passer de « ça marche parfois » à « ça marche ».

- [x] (Claude) Banc de tests (29-30/09) : 20 sujets de référence (`docs/banc-sujets.json`), workflow `banc.yml`, évaluation indépendante de chaque affirmation gardée : citation revérifiée dans la source enregistrée, chiffres présents dans la citation, relecture par un modèle plus exigeant (Flash de préférence). Migration 0006
- [x] (Claude) Suivi de chaque enquête (29/09) : durée, appels à l'IA par modèle, recherches web, pages, lectures en cache, étapes ratées, reprises ; affiché en bas du rapport
- [x] (Claude) Garde-fous (29/09) : cache de 7 jours des recherches et des pages (table `cache_web`), plafond de 900 recherches web par mois, quota Gemini épuisé = attente jusqu'à sa remise à zéro, reprise automatique chaque heure des enquêtes interrompues ou oubliées (5 fois au plus, puis échec), contrôle sans IA « chiffre non prouvé »
- [x] (Claude) **Premier banc** (`docs/banc/banc-2026-09-29-22-07.md`) : 19/20 enquêtes, **taux d'invention 33 %** (41 sur 123), 0 citation absente, 0 chiffre inventé. Fautes = généralisations d'un seul avis, qualificatifs ajoutés, promesses d'éditeur présentées comme des faits, et relecteur privé du titre de la source. Corrigé : consignes d'écriture fidèle, relecture intégrée aussi exigeante que l'évaluateur, titre et adresse de la source donnés aux relecteurs
- [x] (Claude) **Deuxième banc** (`banc-2026-09-29-22-30`) complété le 30/09 : 20/20 enquêtes relues (Flash-Lite, Flash saturé), **18,9 %** (24 sur 127) : 16 « nom non prouvé » (contrôle ajouté la nuit précédente ; 8 enquêtes faites avant les corrections), 8 jugées non prouvées, 0 citation absente, 0 chiffre inventé
- [x] (Claude) Relecture à la main du 2e banc (69 affirmations, 30/09 nuit) : ~12-14 % de fautes contre 34,5 % au 1er banc (les généralisations ont presque disparu). Fautes restantes : nom d'entreprise absent de la citation (prix tirés de comparatifs), preuves hors sujet (avis d'autres métiers, codes NAF des éditeurs), citations en double. Corrigé : contrôle sans IA « nom non prouvé » (10,6 % du 1er banc, 23,2 % du 2e), consigne d'inclure le nom dans la citation avec « … », pertinence des avis et du code NAF, doublons retirés
- [x] (Claude) Analyse des 24 fautes du 2e banc (30/09) : les 16 « nom non prouvé » viennent toutes des 8 enquêtes lancées avant la correction de la nuit (l'agent retire désormais ces phrases lui-même) ; les 12 enquêtes faites avec le code actuel n'ont que 4 fautes sur 50, toutes des refus du relecteur Flash-Lite sur les comptages Sirene de Radar (prouvés par construction). Corrigé : ces comptages ne passent plus par la relecture IA (`comptageSirene`, format, code, adresse et nombre vérifiés sans IA). Recalculé sans nouvel appel : 0 faute sur 50 pour les enquêtes récentes, échantillon trop petit pour conclure
- [ ] (Claude) **3e banc complet** (20 enquêtes neuves avec le code actuel), après 9 h quand le quota Gemini est plein, relecteur Flash si disponible ; objectif ≤ 5 %

**Fin de phase :** des chiffres de fiabilité réels à montrer.

## Phase 6 : le produit SaaS (semaine 7)

**But :** le socle SaaS complet.

**Décisions du 30/09 :** connexion par Google et GitHub (aucun mot de passe, aucun email à envoyer pour se connecter) ; pas de domaine pour les emails (mode démo de Resend : seule l'adresse du compte Resend reçoit l'email du matin, les invitations passent par un lien à copier) ; Pro à 19 € HT par mois en mode test ; en gratuit, les « 3 opportunités par jour » tournent dans le Top 20 (un nouveau lot chaque jour, le même sur le site et dans l'email).

- [x] (Claude) Comptes et connexion (Google, GitHub, proxy qui protège les pages, rapports toujours lisibles par leur lien secret), équipes (équipe personnelle à la première connexion, plusieurs équipes par personne, passage de main quand le propriétaire part), invitations par lien (7 jours, 5 usages, 3 liens au plus), suppression du compte (30/09). Migration `0007_comptes.sql` : fonctions atomiques pour la première connexion, les invitations, le quota d'enquêtes (équipe verrouillée pendant le calcul) et le départ d'une équipe ; 9 tests de base
- [x] (Claude) Tableau « à valider » : à creuser, entretien fait, abandonnée, on se lance ; ajout depuis le classement ou un rapport, notes (30/09)
- [x] (Claude) Email du matin : 3 opportunités (gratuit : le lot du jour ; Pro : secteurs suivis d'abord, rien de déjà reçu depuis 14 jours), HTML échappé, tâche GitHub `matin.yml` à 7 h (30/09)
- [x] (Claude) Stripe en mode test : page de paiement, portail client, webhook signé et traité une seule fois, abonnement relu chez Stripe à chaque événement, clés « live » refusées ; script `scripts/stripe/preparer.mts` (produit, prix, webhook, portail) (30/09)
- [x] (Claude) Page admin : utilisateurs, équipes, enquêtes, erreurs, tâches de nuit, quotas (30/09)
- [x] (Toi) Migration 0007 collée, applications OAuth Google et GitHub branchées dans Supabase (30/09)
- [x] (Claude) Page de confidentialité, mise en ligne (30/09) ; première connexion réussie, compte de Maksen passé admin
- [x] (Toi) Connexion Google publiée, ouverte à tout le monde (30/09)
- [x] (Toi + Claude) Stripe (mode test) préparé par script (produit Radar Pro 19 € HT/mois, webhook, portail), variables sur Netlify ; Resend branché, premier email du matin envoyé (30/09)
- [x] (Claude) Mise en ligne (30/09), connexion testée
- [ ] (Claude) Test de bout en bout : invitation, enquête, suivi, paiement test, email

**Fin de phase :** un vrai SaaS utilisable par quelqu'un d'autre.

## Phase 7 : finition, sécurité, démo (semaine 8)

**But :** que ce soit beau et solide.

- [x] (Toi + Claude) Design (30/09 nuit) : 3 séries de directions refusées (trop sobre, puis « trop IA »), puis retenu un vrai logiciel pro : couleurs de V2 (vert nuit et vert), navigation de V4 (colonne d'icônes + liste des enquêtes), police Onest, en-tête = barre blanche + carte de titre à onglets. Charte dans `MASTER.md`, planche « Radar : directions visuelles ». Appliqué à tout le site et mis en ligne : rapport à onglets, carte Fiabilité, prix marqués HT/TTC et prix annuels ramenés au mois, Top 20 filtrable, nouvelle enquête avec idées du Top 20, enquête en direct, états vides, version téléphone
- [x] (Toi) Page d'accueil choisie : B « Le classement » (le vrai Top 5 en vitrine), parmi 4 propositions (30/09)
- [ ] (Claude) Coder la page d'accueil B et la page Tarifs
- [x] (Claude) Première connexion guidée : carte « Bien démarrer », 3 étapes cochées d'après les données de l'équipe (suivre, enquêter, inviter), masquable (30/09)
- [x] (Claude) Audit de sécurité et attaque en direct (30/09) : `npm run attaque`, 55 contrôles sur le site en ligne avec deux comptes de test (victime et pirate) : pages, actions serveur appelées à la main avec de faux numéros, CSRF, API Supabase avec la clé publique et avec la session du pirate (10 tables, 4 fonctions, se déclarer admin), redirections, faux webhook, en-têtes, nom piégé. **0 faille.** Déjà en place : RLS sans règle et droits retirés partout, secrets vérifiés par gitleaks à chaque commit, 0 dépendance vulnérable, agent protégé des pages piégées (tests). Connexion par email laissée active dans Supabase : elle sert aux comptes de test de l'attaque, et un compte créé par là reste non confirmé (aucun email ne part hors de l'équipe du projet), donc ne peut pas se connecter ; limites connues : une session déconnectée reste valable jusqu'à 1 h (jeton vérifié sur place), pas de limite de débit par personne (quotas par équipe seulement)
- [x] (Claude) Mobile et vitesse (30/09) : tableau des opportunités lisible sur téléphone (plus de défilement de côté), captures de toutes les pages vérifiées ; session vérifiée sur place (getClaims, clé ES256 de Supabase) au lieu d'un appel réseau, profil et équipe en une requête : pages connectées servies en 0,5 à 1 s
- [ ] (Toi) Vidéo de démo de 60 secondes

**Fin de phase :** un lien public, une vidéo, un projet montrable.

## Phase 8 : l'utiliser pour de vrai (en continu)

- [ ] (Toi) S'en servir pour choisir le prochain projet business
- [ ] (Toi) Le faire tester à 5 ou 10 personnes (entrepreneurs, freelances) et récolter leurs retours
- [ ] (Toi) Décider : projet d'entraînement, ou vrai produit
