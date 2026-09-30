-- 0007 : comptes, équipes, invitations, suivi des opportunités, abonnements, email du matin (phase 6).
-- Connexion par Google ou GitHub (Supabase Auth). Le site lit et écrit tout avec la clé serveur,
-- après avoir vérifié la session : aucune de ces tables n'est ouverte aux clés publiques.
-- Les opérations sensibles aux accès simultanés (quota d'enquêtes, invitations, première connexion)
-- sont des fonctions atomiques. Rejouable sans erreur.

create table if not exists public.equipes (
  id bigint generated always as identity primary key,
  nom text not null check (length(nom) between 1 and 60),
  plan text not null default 'gratuit' check (plan in ('gratuit', 'pro')),
  stripe_client text unique check (stripe_client like 'cus\_%'),
  stripe_abonnement text unique check (stripe_abonnement like 'sub\_%'),
  abonnement_statut text check (length(abonnement_statut) <= 30),
  fin_periode timestamptz,
  cree_le timestamptz not null default now()
);

create table if not exists public.profils (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null check (length(email) between 3 and 320),
  nom text check (length(nom) <= 80),
  admin boolean not null default false, -- posé à la main dans l'éditeur SQL, jamais par le site
  equipe_active bigint references public.equipes (id) on delete set null,
  email_matin boolean not null default true,
  secteurs text[] not null default '{}' check (cardinality(secteurs) <= 10), -- alertes (offre Pro)
  cree_le timestamptz not null default now(),
  vu_le timestamptz not null default now()
);

create table if not exists public.membres (
  equipe_id bigint not null references public.equipes (id) on delete cascade,
  utilisateur_id uuid not null references public.profils (id) on delete cascade,
  role text not null default 'membre' check (role in ('proprietaire', 'membre')),
  cree_le timestamptz not null default now(),
  primary key (equipe_id, utilisateur_id)
);
create index if not exists membres_utilisateur on public.membres (utilisateur_id);

-- Lien d'invitation : secret, limité dans le temps et en nombre d'usages.
create table if not exists public.invitations (
  id bigint generated always as identity primary key,
  equipe_id bigint not null references public.equipes (id) on delete cascade,
  jeton uuid not null unique default gen_random_uuid(),
  cree_par uuid references public.profils (id) on delete set null,
  usages smallint not null default 0 check (usages >= 0),
  usages_max smallint not null default 5 check (usages_max between 1 and 20),
  expire_le timestamptz not null default now() + interval '7 days',
  cree_le timestamptz not null default now()
);
create index if not exists invitations_equipe on public.invitations (equipe_id);

-- Tableau « à valider ». Les groupes sont recalculés chaque nuit (nouveaux numéros) : on garde donc
-- une copie de l'opportunité au moment où elle entre dans le suivi.
create table if not exists public.suivi (
  id bigint generated always as identity primary key,
  equipe_id bigint not null references public.equipes (id) on delete cascade,
  titre text not null check (length(titre) between 1 and 200),
  resume text check (length(resume) <= 600),
  secteur text check (length(secteur) <= 40),
  score numeric(4, 2) check (score between 0 and 10),
  enquete_id bigint references public.enquetes (id) on delete set null,
  statut text not null default 'a_creuser' check (statut in ('a_creuser', 'entretien', 'abandonnee', 'lancee')),
  note text check (length(note) <= 2000),
  ajoute_par uuid references public.profils (id) on delete set null,
  cree_le timestamptz not null default now(),
  maj_le timestamptz not null default now(),
  unique (equipe_id, titre)
);

alter table public.enquetes add column if not exists equipe_id bigint references public.equipes (id) on delete set null;
alter table public.enquetes add column if not exists lance_par uuid references public.profils (id) on delete set null;
create index if not exists enquetes_equipe on public.enquetes (equipe_id, cree_le desc);

-- Événements Stripe déjà traités (un webhook peut arriver plusieurs fois).
create table if not exists public.stripe_evenements (
  id text primary key check (id like 'evt\_%'),
  type text not null check (length(type) <= 80),
  recu_le timestamptz not null default now()
);

create table if not exists public.emails_matin (
  id bigint generated always as identity primary key,
  utilisateur_id uuid not null references public.profils (id) on delete cascade,
  jour date not null,
  opportunites text[] not null default '{}',
  statut text not null check (statut in ('envoye', 'refuse')),
  erreur text check (length(erreur) <= 500),
  cree_le timestamptz not null default now(),
  unique (utilisateur_id, jour)
);

-- Première connexion (ou suivante) : profil à jour, et une équipe personnelle si la personne n'en a
-- aucune. Renvoie l'équipe active.
create or replace function public.premiere_connexion(p_id uuid, p_email text, p_nom text)
returns bigint
language plpgsql
set search_path = ''
as $$
declare
  v_equipe bigint;
begin
  insert into public.profils (id, email, nom)
  values (p_id, p_email, nullif(left(trim(p_nom), 80), ''))
  on conflict (id) do update set email = excluded.email, vu_le = now();

  perform 1 from public.profils where id = p_id for update; -- deux onglets à la fois : une seule équipe créée
  select equipe_active into v_equipe from public.profils where id = p_id;
  if v_equipe is not null and exists (select 1 from public.membres where equipe_id = v_equipe and utilisateur_id = p_id) then
    return v_equipe;
  end if;

  select equipe_id into v_equipe from public.membres where utilisateur_id = p_id order by cree_le limit 1;
  if v_equipe is null then
    insert into public.equipes (nom)
    values (left('Équipe de ' || coalesce(nullif(trim(p_nom), ''), split_part(p_email, '@', 1)), 60))
    returning id into v_equipe;
    insert into public.membres (equipe_id, utilisateur_id, role) values (v_equipe, p_id, 'proprietaire');
  end if;
  update public.profils set equipe_active = v_equipe where id = p_id;
  return v_equipe;
end;
$$;

-- Rejoindre une équipe par un lien d'invitation. Déjà membre : aucun usage consommé.
-- Erreurs : invitation_invalide (inconnue, expirée ou épuisée), equipe_pleine.
create or replace function public.rejoindre_equipe(p_jeton uuid, p_utilisateur uuid, p_max_gratuit integer, p_max_pro integer)
returns bigint
language plpgsql
set search_path = ''
as $$
declare
  v_equipe bigint;
  v_plan text;
begin
  select i.equipe_id, e.plan into v_equipe, v_plan
  from public.invitations i join public.equipes e on e.id = i.equipe_id
  where i.jeton = p_jeton and i.expire_le > now() and i.usages < i.usages_max
  for update of i, e;
  if v_equipe is null then raise exception 'invitation_invalide'; end if;

  if not exists (select 1 from public.membres where equipe_id = v_equipe and utilisateur_id = p_utilisateur) then
    if (select count(*) from public.membres where equipe_id = v_equipe) >= (case when v_plan = 'pro' then p_max_pro else p_max_gratuit end) then
      raise exception 'equipe_pleine';
    end if;
    insert into public.membres (equipe_id, utilisateur_id) values (v_equipe, p_utilisateur);
    update public.invitations set usages = usages + 1 where jeton = p_jeton;
  end if;
  update public.profils set equipe_active = v_equipe where id = p_utilisateur;
  return v_equipe;
end;
$$;

-- Réserve une enquête pour une équipe en respectant, d'un seul tenant, le quota de l'équipe (sur 7
-- jours glissants et depuis minuit, heure de Paris) et la limite du site entier (quotas gratuits des
-- services). L'équipe est verrouillée le temps du calcul : deux clics simultanés ne passent pas tous
-- les deux. Erreurs : quota_semaine, quota_jour, limite_site.
create or replace function public.reserver_enquete(
  p_equipe bigint, p_utilisateur uuid, p_sujet text, p_budget smallint,
  p_max_semaine integer, p_max_jour integer, p_max_site integer
)
returns table (id bigint, jeton uuid)
language plpgsql
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_minuit timestamptz := date_trunc('day', now() at time zone 'Europe/Paris') at time zone 'Europe/Paris';
begin
  perform 1 from public.equipes where equipes.id = p_equipe for update;
  if not found then raise exception 'equipe_inconnue'; end if;
  if (select count(*) from public.enquetes e where e.equipe_id = p_equipe and e.cree_le > now() - interval '7 days') >= p_max_semaine then
    raise exception 'quota_semaine';
  end if;
  if (select count(*) from public.enquetes e where e.equipe_id = p_equipe and e.cree_le >= v_minuit) >= p_max_jour then
    raise exception 'quota_jour';
  end if;
  perform pg_advisory_xact_lock(hashtext('radar:limite_site'));
  if (select count(*) from public.enquetes e where e.banc is null and e.cree_le >= v_minuit) >= p_max_site then
    raise exception 'limite_site';
  end if;
  return query
    insert into public.enquetes as e (sujet, budget, equipe_id, lance_par)
    values (p_sujet, p_budget, p_equipe, p_utilisateur)
    returning e.id, e.jeton;
end;
$$;

-- Quitter une équipe (ou en être retiré). Le dernier propriétaire passe la main au plus ancien membre ;
-- une équipe vide est supprimée, sauf si elle a un abonnement en cours (à résilier d'abord).
-- Erreur : abonnement_actif.
create or replace function public.quitter_equipe(p_equipe bigint, p_utilisateur uuid)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_suivant uuid;
begin
  perform 1 from public.equipes where id = p_equipe for update;
  delete from public.membres where equipe_id = p_equipe and utilisateur_id = p_utilisateur;
  if not found then return; end if;
  if not exists (select 1 from public.membres where equipe_id = p_equipe and role = 'proprietaire') then
    select utilisateur_id into v_suivant from public.membres where equipe_id = p_equipe order by cree_le limit 1;
    if v_suivant is null then
      if exists (select 1 from public.equipes where id = p_equipe and plan = 'pro') then raise exception 'abonnement_actif'; end if;
      delete from public.equipes where id = p_equipe;
    else
      update public.membres set role = 'proprietaire' where equipe_id = p_equipe and utilisateur_id = v_suivant;
    end if;
  end if;
  update public.profils set equipe_active = null where id = p_utilisateur and equipe_active = p_equipe;
end;
$$;

-- Verrouillage : RLS active sans aucune règle, aucun droit pour les clés publiques.
alter table public.equipes enable row level security;
alter table public.profils enable row level security;
alter table public.membres enable row level security;
alter table public.invitations enable row level security;
alter table public.suivi enable row level security;
alter table public.stripe_evenements enable row level security;
alter table public.emails_matin enable row level security;

revoke all on public.equipes, public.profils, public.membres, public.invitations, public.suivi,
  public.stripe_evenements, public.emails_matin
  from anon, authenticated;

revoke all on function public.premiere_connexion(uuid, text, text) from public, anon, authenticated;
revoke all on function public.rejoindre_equipe(uuid, uuid, integer, integer) from public, anon, authenticated;
revoke all on function public.reserver_enquete(bigint, uuid, text, smallint, integer, integer, integer) from public, anon, authenticated;
revoke all on function public.quitter_equipe(bigint, uuid) from public, anon, authenticated;
grant execute on function public.premiere_connexion(uuid, text, text) to service_role;
grant execute on function public.rejoindre_equipe(uuid, uuid, integer, integer) to service_role;
grant execute on function public.reserver_enquete(bigint, uuid, text, smallint, integer, integer, integer) to service_role;
grant execute on function public.quitter_equipe(bigint, uuid) to service_role;
