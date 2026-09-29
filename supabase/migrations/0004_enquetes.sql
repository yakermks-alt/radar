-- 0004 : enquêtes de l'agent (phase 4).
-- Une enquête avance étape par étape ; chaque étape est enregistrée avant la suivante, donc une
-- enquête coupée reprend là où elle s'est arrêtée. Aucun accès pour les clés publiques.
-- Rejouable sans erreur.

create table if not exists public.enquetes (
  id bigint generated always as identity primary key,
  sujet text not null check (length(sujet) between 3 and 300),
  statut text not null default 'en_attente' check (statut in ('en_attente', 'en_cours', 'terminee', 'echec')),
  budget smallint not null default 20 check (budget between 1 and 60),
  etapes_faites smallint not null default 0 check (etapes_faites >= 0),
  verrou_jusqu_a timestamptz,
  rapport jsonb,
  erreur text,
  cree_le timestamptz not null default now(),
  maj_le timestamptz not null default now()
);

create table if not exists public.etapes (
  id bigint generated always as identity primary key,
  enquete_id bigint not null references public.enquetes (id) on delete cascade,
  numero smallint not null check (numero >= 1),
  pensee text check (length(pensee) <= 1000),
  outil text not null check (outil in ('rechercher_web', 'lire_page', 'chercher_avis', 'entreprises', 'rediger')),
  argument text check (length(argument) <= 500),
  statut text not null check (statut in ('ok', 'erreur')),
  resultat text check (length(resultat) <= 300), -- résumé d'une ligne affiché à l'écran
  observation text check (length(observation) <= 6000), -- ce que l'agent relit aux étapes suivantes
  duree_ms integer check (duree_ms >= 0),
  cree_le timestamptz not null default now(),
  unique (enquete_id, numero)
);

-- Tout ce que l'agent a lu : pages web, résultats de recherche, avis, fiches d'entreprises.
-- Le rapport ne peut citer que ces textes (citations vérifiées mot pour mot).
create table if not exists public.sources (
  id bigint generated always as identity primary key,
  enquete_id bigint not null references public.enquetes (id) on delete cascade,
  url text not null check (url ~ '^(https?|radar)://' and length(url) <= 1000),
  titre text check (length(titre) <= 300),
  texte text not null check (length(texte) between 1 and 60000),
  suspecte boolean not null default false, -- instructions cachées destinées à l'agent détectées
  lu_le timestamptz not null default now(),
  unique (enquete_id, url)
);

-- Prend la plus ancienne enquête à faire avancer et la verrouille : deux exécutions ne
-- travaillent jamais sur la même enquête. Le verrou expire tout seul si l'exécution meurt.
create or replace function public.prendre_enquete(duree_verrou interval default interval '5 minutes', cible bigint default null)
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
      and (cible is null or id = cible)
    order by cree_le
    limit 1
    for update skip locked
  )
  returning e.*
$$;

-- Enregistre une étape et ses sources, fait avancer le compteur et prolonge le verrou, en une
-- seule transaction. Le numéro attendu évite qu'une exécution en retard écrase la suite.
-- etape : {numero, pensee, outil, argument, statut, resultat, observation, duree_ms}
-- sources : [{url, titre, texte, suspecte}] (une URL déjà lue est mise à jour)
create or replace function public.enregistrer_etape(enquete bigint, etape jsonb, sources jsonb default '[]'::jsonb)
returns void
language plpgsql
set search_path = ''
as $$
declare
  attendu smallint;
begin
  select etapes_faites + 1 into attendu from public.enquetes where id = enquete for update;
  if attendu is null then raise exception 'Enquête % inconnue', enquete; end if;
  if (etape ->> 'numero')::smallint <> attendu then
    raise exception 'Étape % attendue, % reçue', attendu, etape ->> 'numero';
  end if;

  insert into public.etapes (enquete_id, numero, pensee, outil, argument, statut, resultat, observation, duree_ms)
  values (
    enquete, attendu, etape ->> 'pensee', etape ->> 'outil', etape ->> 'argument', etape ->> 'statut',
    etape ->> 'resultat', etape ->> 'observation', (etape ->> 'duree_ms')::integer
  );

  insert into public.sources (enquete_id, url, titre, texte, suspecte)
  select enquete, s ->> 'url', s ->> 'titre', s ->> 'texte', coalesce((s ->> 'suspecte')::boolean, false)
  from jsonb_array_elements(sources) s
  on conflict (enquete_id, url) do update
    set titre = excluded.titre, texte = excluded.texte, suspecte = excluded.suspecte, lu_le = now();

  update public.enquetes
  set etapes_faites = attendu, verrou_jusqu_a = greatest(verrou_jusqu_a, now() + interval '5 minutes'), maj_le = now()
  where id = enquete;
end
$$;

-- Avis négatifs les plus proches d'un texte (outil « chercher_avis » de l'agent).
create or replace function public.avis_proches(vecteur text, n integer default 8)
returns table (id bigint, note smallint, contenu text, probleme text, app text, secteur text, similarite real)
language sql
stable
set search_path = ''
as $$
  select a.id, a.note, a.contenu, a.probleme, p.nom, p.secteur,
         (1 - (a.embedding operator(extensions.<=>) vecteur::extensions.vector))::real
  from public.avis a
  join public.apps p on p.id = a.app_id
  where a.embedding is not null
  order by a.embedding operator(extensions.<=>) vecteur::extensions.vector
  limit least(greatest(n, 1), 20)
$$;

revoke all on function public.prendre_enquete(interval, bigint) from public, anon, authenticated;
revoke all on function public.enregistrer_etape(bigint, jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.avis_proches(text, integer) from public, anon, authenticated;
grant execute on function public.prendre_enquete(interval, bigint) to service_role;
grant execute on function public.enregistrer_etape(bigint, jsonb, jsonb) to service_role;
grant execute on function public.avis_proches(text, integer) to service_role;

alter table public.enquetes enable row level security;
alter table public.etapes enable row level security;
alter table public.sources enable row level security;

revoke all on public.enquetes, public.etapes, public.sources from anon, authenticated;
