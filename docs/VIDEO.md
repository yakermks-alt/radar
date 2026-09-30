# Radar : script de la vidéo de démo (60 secondes)

> Pour une vidéo de portfolio (LinkedIn, site, dossier). Enregistrement d'écran avec voix off, ou texte
> à l'écran sans voix. Format conseillé : 1920 × 1080, navigateur en plein écran, zoom à 110 %.
> Préparer avant : être connecté en Pro, une enquête déjà terminée sous la main, une enquête prête à lancer.

| # | Durée | À l'écran | Voix off (ou texte à l'écran) |
|---|---|---|---|
| 1 | 0-6 s | Page d'accueil publique, sans être connecté. Défilement lent jusqu'au classement. | « Chaque nuit, Radar lit des milliers d'avis négatifs d'applis professionnelles. » |
| 2 | 6-13 s | Survol des 3 premières lignes, puis zoom sur la pastille « Signal fort » et la colonne Entreprises. | « Il en tire les besoins que les logiciels actuels couvrent mal, avec la taille réelle du marché d'après l'Insee. » |
| 3 | 13-18 s | Clic « Continuer avec Google », arrivée sur le Top 20 (compte Pro). | « Connexion en un clic. » |
| 4 | 18-30 s | Clic « Enquêter » sur une opportunité, lancement, page en direct : les étapes arrivent une à une. | « Sur un besoin, un agent IA enquête seul : concurrents, pages de prix, plaintes des clients, nombre d'entreprises. » |
| 5 | 30-42 s | Rapport terminé : verdict, carte Fiabilité, onglet Preuves, clic sur une source (la citation exacte). | « Chaque phrase du rapport cite sa source mot pour mot. Sans preuve exacte, elle est retirée. » |
| 6 | 42-50 s | « Ajouter au suivi », tableau à 4 colonnes, déplacer la carte vers « Entretien fait ». | « On suit ses pistes en équipe, de l'idée à la décision. » |
| 7 | 50-56 s | Page Équipe (invitation), puis Tarifs, puis page de paiement Stripe en mode test. | « Équipes, abonnement, email du matin : un vrai SaaS, 100 % gratuit à faire tourner. » |
| 8 | 56-60 s | Retour sur l'accueil, logo Radar et adresse du site. | « Radar. Construit en 3 jours. » + adresse du site |

## Chiffres à citer (à mettre à jour le jour du tournage)

- Nombre d'avis et d'applis : en haut de la page d'accueil.
- Taux d'invention mesuré par le banc de tests (`docs/banc/`), seulement s'il est sous 5 %.
- Sécurité : `npm run attaque` (nombre de contrôles, 0 faille).

## À éviter à l'écran

- Aucune clé, aucun fichier `.env.local`, aucune page de réglages Supabase, Stripe ou Netlify.
- Pas d'adresse email personnelle : se filmer avec un compte dont le nom peut apparaître.
