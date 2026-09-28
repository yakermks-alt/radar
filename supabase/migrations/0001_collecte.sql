-- 0001 : collecte et analyse des avis (phases 1 et 2).
-- Toutes les tables sont fermées aux clés publiques (anon, authenticated) : seules les tâches
-- serveur (clé secrète) les lisent et les écrivent. Les accès utilisateurs arriveront en phase 6.
-- Rejouable sans erreur.

create extension if not exists vector with schema extensions;

-- Applis pro suivies (une ligne par appli et par store).
create table if not exists public.apps (
  id bigint generated always as identity primary key,
  store text not null default 'appstore' check (store in ('appstore')),
  store_id text not null,
  nom text not null,
  editeur text,
  secteur text not null,
  note_moyenne numeric(3, 2),
  nb_notes integer check (nb_notes >= 0),
  prix text,
  url text,
  active boolean not null default true,
  cree_le timestamptz not null default now(),
  maj_le timestamptz not null default now(),
  unique (store, store_id)
);

-- Avis clients. Le pseudo de l'auteur n'est jamais stocké en clair (seulement une empreinte,
-- pour repérer les doublons d'un même auteur sans garder de donnée personnelle).
create table if not exists public.avis (
  id bigint generated always as identity primary key,
  app_id bigint not null references public.apps (id) on delete cascade,
  id_externe text not null,
  note smallint not null check (note between 1 and 5),
  titre text,
  contenu text not null check (length(contenu) between 1 and 10000),
  auteur_empreinte text,
  version_app text,
  publie_le timestamptz,
  collecte_le timestamptz not null default now(),
  -- Analyse par l'IA (phase 2), vide tant que l'avis n'est pas traité.
  analyse_le timestamptz,
  categorie text check (categorie in ('bug', 'besoin', 'prix', 'support', 'autre')),
  probleme text,
  type_client text,
  gravite smallint check (gravite between 1 and 3),
  signal_paiement boolean,
  embedding extensions.vector(384),
  unique (app_id, id_externe)
);

create index if not exists avis_app_idx on public.avis (app_id);
create index if not exists avis_a_analyser_idx on public.avis (id) where analyse_le is null;
create index if not exists avis_embedding_idx on public.avis
  using hnsw (embedding extensions.vector_cosine_ops);

-- Groupes de plaintes de même sens (recalculés régulièrement).
create table if not exists public.groupes (
  id bigint generated always as identity primary key,
  nom text not null,
  resume text,
  secteur text,
  nb_avis integer not null default 0 check (nb_avis >= 0),
  score numeric(4, 2) check (score between 0 and 10),
  score_detail jsonb not null default '{}'::jsonb,
  centre extensions.vector(384),
  calcul integer not null,
  calcule_le timestamptz not null default now()
);

create table if not exists public.groupes_avis (
  groupe_id bigint not null references public.groupes (id) on delete cascade,
  avis_id bigint not null references public.avis (id) on delete cascade,
  distance real,
  primary key (groupe_id, avis_id)
);

create index if not exists groupes_avis_avis_idx on public.groupes_avis (avis_id);

-- Journal de chaque passage des tâches automatiques (collecte, analyse, regroupement).
create table if not exists public.journal (
  id bigint generated always as identity primary key,
  tache text not null check (tache in ('collecte', 'analyse', 'embeddings', 'regroupement')),
  statut text not null default 'en_cours' check (statut in ('en_cours', 'ok', 'erreur')),
  demarre_le timestamptz not null default now(),
  termine_le timestamptz,
  details jsonb not null default '{}'::jsonb,
  erreur text
);

-- Verrouillage : RLS active sans aucune règle = aucun accès avec les clés publiques.
alter table public.apps enable row level security;
alter table public.avis enable row level security;
alter table public.groupes enable row level security;
alter table public.groupes_avis enable row level security;
alter table public.journal enable row level security;

revoke all on public.apps, public.avis, public.groupes, public.groupes_avis, public.journal
  from anon, authenticated;
