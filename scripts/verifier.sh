#!/usr/bin/env bash
# Vérification à lancer après chaque modification : npm run verifier
# Types, lint, tests (dont les droits d'accès à la base), puis recherche de secrets.
set -euo pipefail
cd "$(dirname "$0")/.."

etape() { printf '\n== %s\n' "$1"; }

etape "Types";   npx tsc --noEmit
etape "Lint";    npx eslint . --max-warnings 0
etape "Tests";   npx vitest run
etape "Secrets"
if command -v gitleaks >/dev/null; then
  gitleaks git --no-banner --redact .
  # Fichiers suivis mais pas encore commités (les .env.local sont exclus, ils restent sur le Mac).
  for d in src tests scripts supabase docs .github; do
    gitleaks dir --no-banner --redact --max-target-megabytes 1 "$d"
  done
else
  echo "gitleaks absent : brew install gitleaks" >&2; exit 1
fi

printf '\nTout est vert.\n'
