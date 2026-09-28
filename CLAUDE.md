@AGENTS.md

# Radar : règles du projet

- Repo **public** : aucun secret, aucune donnée personnelle dans le code, les tests ou la doc. Le hook `.githooks/pre-commit` (gitleaks) bloque les commits fautifs.
- Après chaque modification : `npm run verifier` doit être vert avant de dire que c'est fini.
- Base : toute nouvelle table a la RLS activée, et les droits des rôles publics sont retirés sauf besoin explicite. Chaque migration est testée dans `tests/db/` (PGlite + pgvector) et rejouable.
- Quotas gratuits (voir `docs/LIMITES.md`) : Gemini Flash ~20 requêtes/jour, donc Flash-Lite par défaut ; embeddings en local (384 dimensions) ; rien de long sur Netlify (crédits partagés avec les autres sites).
- Plan et avancement : `docs/PLAN.md` (cases à cocher).
- Communication : en français, sans tirets longs.
