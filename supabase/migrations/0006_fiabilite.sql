-- 0006 : fiabilité (phase 5).
-- Mesures de chaque enquête, reprises automatiques comptées, enquêtes du banc de tests à part,
-- cache des recherches web et des pages (quotas gratuits). Aucun accès pour les clés publiques.
-- Rejouable sans erreur.

-- banc : nom du passage du banc de tests (null = vraie enquête, la seule qui compte dans la
-- limite du jour et qui s'affiche dans la liste).
alter table public.enquetes add column if not exists banc text check (length(banc) <= 60);
-- mesures : {appels_ia: {modele: n}, recherches, recherches_cache, pages, pages_cache, etapes_ratees, duree_s, evaluation}
alter table public.enquetes add column if not exists mesures jsonb not null default '{}'::jsonb;
alter table public.enquetes add column if not exists reprises smallint not null default 0 check (reprises >= 0);
create index if not exists enquetes_banc on public.enquetes (banc) where banc is not null;

-- Cache partagé entre enquêtes : « recherche:<requête> » ou « page:<url> », gardé 7 jours.
create table if not exists public.cache_web (
  cle text primary key check (length(cle) between 6 and 1100),
  contenu jsonb not null,
  cree_le timestamptz not null default now()
);
create index if not exists cache_web_cree_le on public.cache_web (cree_le);

-- Recherches web réellement faites ce mois-ci (hors cache), pour ne jamais dépasser l'offre gratuite.
create or replace function public.recherches_du_mois()
returns integer
language sql
stable
set search_path = ''
as $$
  select coalesce(sum((mesures ->> 'recherches')::integer), 0)::integer
  from public.enquetes
  where maj_le >= date_trunc('month', now())
$$;

-- Reprise automatique (tâche GitHub horaire) : seulement les enquêtes oubliées, c'est-à-dire
-- interrompues sur une erreur, ou sans nouvelles depuis 15 min (exécution morte). Une enquête qui
-- vient d'être lancée depuis le site n'est jamais prise en double.
create or replace function public.prendre_enquete_oubliee(duree_verrou interval default interval '20 minutes')
returns setof public.enquetes
language sql
set search_path = ''
as $$
  update public.enquetes e
  set verrou_jusqu_a = now() + duree_verrou, statut = 'en_cours', maj_le = now()
  where e.id = (
    select id from public.enquetes
    where statut in ('en_attente', 'en_cours')
      and (verrou_jusqu_a is null or verrou_jusqu_a < now())
      and (erreur is not null or maj_le < now() - interval '15 minutes')
    order by cree_le
    limit 1
    for update skip locked
  )
  returning e.*
$$;

revoke all on function public.recherches_du_mois() from public, anon, authenticated;
grant execute on function public.recherches_du_mois() to service_role;
revoke all on function public.prendre_enquete_oubliee(interval) from public, anon, authenticated;
grant execute on function public.prendre_enquete_oubliee(interval) to service_role;

alter table public.cache_web enable row level security;
revoke all on public.cache_web from anon, authenticated;
