-- 0005 : adresse secrète de chaque enquête (page /enquete/<jeton>, canal temps réel « enquete:<jeton> »).
-- Un jeton aléatoire plutôt que le numéro : on ne peut pas deviner les enquêtes des autres.
-- Rejouable sans erreur.

alter table public.enquetes add column if not exists jeton uuid not null default gen_random_uuid();
create unique index if not exists enquetes_jeton on public.enquetes (jeton);
create index if not exists enquetes_cree_le on public.enquetes (cree_le desc);
