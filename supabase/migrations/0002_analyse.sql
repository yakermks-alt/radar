-- 0002 : enregistrement en masse des résultats d'analyse (phase 2).
-- Fonctions réservées aux tâches serveur (clé secrète) : aucun droit pour les clés publiques.
-- Rejouable sans erreur.

-- Résultats du tri par l'IA, par lots : [{id, categorie, probleme, type_client, gravite, signal_paiement}].
create or replace function public.enregistrer_analyses(lignes jsonb)
returns integer
language sql
set search_path = ''
as $$
  with l as (
    select * from jsonb_to_recordset(lignes)
      as x(id bigint, categorie text, probleme text, type_client text, gravite smallint, signal_paiement boolean)
  ), maj as (
    update public.avis a
    set analyse_le = now(),
        categorie = l.categorie,
        probleme = l.probleme,
        type_client = l.type_client,
        gravite = l.gravite,
        signal_paiement = l.signal_paiement
    from l
    where a.id = l.id
    returning 1
  )
  select count(*)::integer from maj
$$;

-- Embeddings par lots : [{id, embedding: "[0.1, ...]"}].
create or replace function public.enregistrer_embeddings(lignes jsonb)
returns integer
language sql
set search_path = ''
as $$
  with l as (
    select * from jsonb_to_recordset(lignes) as x(id bigint, embedding text)
  ), maj as (
    update public.avis a
    set embedding = l.embedding::extensions.vector
    from l
    where a.id = l.id
    returning 1
  )
  select count(*)::integer from maj
$$;

-- Remplace tous les groupes par un nouveau calcul, en une seule transaction (jamais de page vide).
-- groupes : [{nom, resume, secteur, nb_avis, score, score_detail, centre, membres: [{avis_id, distance}]}].
create or replace function public.remplacer_groupes(groupes jsonb)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  n_calcul integer;
  g jsonb;
  gid bigint;
begin
  select coalesce(max(calcul), 0) + 1 into n_calcul from public.groupes;

  for g in select * from jsonb_array_elements(groupes) loop
    insert into public.groupes (nom, resume, secteur, nb_avis, score, score_detail, centre, calcul)
    values (
      g ->> 'nom',
      g ->> 'resume',
      g ->> 'secteur',
      (g ->> 'nb_avis')::integer,
      (g ->> 'score')::numeric,
      coalesce(g -> 'score_detail', '{}'::jsonb),
      (g ->> 'centre')::extensions.vector,
      n_calcul
    )
    returning id into gid;

    insert into public.groupes_avis (groupe_id, avis_id, distance)
    select gid, (m ->> 'avis_id')::bigint, (m ->> 'distance')::real
    from jsonb_array_elements(g -> 'membres') m;
  end loop;

  delete from public.groupes where calcul < n_calcul;
  return n_calcul;
end
$$;

revoke all on function public.enregistrer_analyses(jsonb) from public, anon, authenticated;
revoke all on function public.enregistrer_embeddings(jsonb) from public, anon, authenticated;
revoke all on function public.remplacer_groupes(jsonb) from public, anon, authenticated;
grant execute on function public.enregistrer_analyses(jsonb) to service_role;
grant execute on function public.enregistrer_embeddings(jsonb) to service_role;
grant execute on function public.remplacer_groupes(jsonb) to service_role;
