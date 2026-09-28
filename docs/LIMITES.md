# Radar : limites gratuites vérifiées (28/09/2026)

> Phase 0. À revérifier si un service change ses conditions.

## Gemini (Google AI Studio, sans facturation)

| Modèle | Limite gratuite | Usage prévu dans Radar |
|---|---|---|
| Flash (3.5 à 3.8) | **~20 requêtes/jour**, 5/min (mesuré le 02/09/2026, Google ne publie plus le chiffre) | Rédaction finale des rapports seulement |
| Flash-Lite (3.1, 3.5) | ~500 requêtes/jour, 15/min, Batch gratuit | Tri et extraction des avis (par lots de ~50 avis par requête), étapes de l'agent |
| Embedding 2 | ~1 000 requêtes/jour, 100/min | Plan B seulement (voir embeddings locaux) |
| Recherche Google intégrée | 5 000 recherches/mois (famille 3.x) | Recherche web de l'agent |
| Pro | Plus de gratuit depuis le 01/04/2026 | Non utilisé |

- Le quota est compté **par projet Google**, pas par clé : Radar doit avoir son propre projet Google pour ne rien prendre aux autres applis.
- Remise à zéro à minuit heure du Pacifique (9 h du matin en France).
- Conséquence : une enquête de l'agent doit tenir en ~1 appel Flash + 15-30 appels Flash-Lite. Ça donne environ 15 enquêtes par jour au maximum, et c'est l'offre gratuite de Radar qui doit l'encadrer.

## Embeddings : en local plutôt que par l'API

Modèle multilingue open source (famille e5 ou bge) exécuté dans GitHub Actions : 0 quota, aucun coût, fonctionne en français. Dimension 384 à 768, compatible avec la limite de 500 Mo de Supabase.

## Netlify (offre gratuite à crédits)

- 300 crédits/mois **partagés entre tous les sites de l'équipe** (y compris les autres applis du compte). Calcul serveur : 10 crédits par Go-heure.
- Si un site dépasse, **tous les sites de l'équipe sont mis en pause** jusqu'au mois suivant.
- Les tâches de fond de 15 min existent sur l'offre gratuite, mais faire tourner l'agent dessus mettrait les autres sites en danger.
- Décision : Netlify sert seulement les pages et les petites routes. L'agent tourne ailleurs (voir architecture).

## GitHub Actions

- 2 000 minutes/mois pour les repos privés (partagées entre tous les repos privés du compte), arrêt net une fois épuisées.
- Illimité pour un repo **public**.
- Usage prévu : collecte de nuit, embeddings, regroupement, tests.

## Supabase (offre gratuite)

- 2 projets actifs maximum : une place a été libérée en mettant un projet inutilisé en pause.
- 500 Mo de base, 1 Go de stockage, pause automatique après 7 jours sans activité (la tâche de nuit l'évite).

## Architecture retenue pour l'agent

Chaque étape de l'agent est une petite exécution courte. L'état de l'enquête est enregistré en base après chaque étape, puis l'étape suivante est mise en file d'attente. Avantages :
- aucune exécution longue, donc pas de risque sur les crédits Netlify ;
- une enquête interrompue reprend là où elle s'est arrêtée ;
- chaque étape s'affiche en direct à l'écran (Supabase Realtime).

C'est plus dur à construire qu'une longue exécution, mais c'est le point technique le plus intéressant du projet.

## Sources

- https://ai.google.dev/gemini-api/docs/pricing
- https://dev.to/romeroyang/geminis-free-tier-measured-20-requests-a-day-and-google-no-longer-publishes-the-number-4gf2
- https://docs.netlify.com/build/functions/background-functions/
- https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/how-credits-work/
- https://docs.github.com/billing/managing-billing-for-github-actions/about-billing-for-github-actions
- https://supabase.com/docs/guides/platform/free-project-pausing
