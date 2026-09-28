# Radar

Agent IA qui repère des opportunités business sur le marché francophone à partir de plaintes réelles de clients, enquête seul sur chacune (concurrents, prix, taille du marché) et rend un rapport sourcé.

Projet d'apprentissage, construit en public, 100 % sur des offres gratuites.

## Stack

Next.js, Supabase (Postgres, pgvector, Realtime), Netlify, Gemini, GitHub Actions, Resend, Stripe (mode test).

## Démarrer

```bash
npm ci
cp .env.example .env.local   # puis remplir
git config core.hooksPath .githooks   # bloque les commits contenant un secret
npm run dev
```

## Vérifier

```bash
npm run verifier   # types, lint, tests (droits d'accès à la base compris), secrets
```

## Documentation

- [Plan d'action](docs/PLAN.md)
- [Limites gratuites et architecture](docs/LIMITES.md)
- Migrations : `supabase/migrations/`, à coller dans l'éditeur SQL de Supabase, dans l'ordre
