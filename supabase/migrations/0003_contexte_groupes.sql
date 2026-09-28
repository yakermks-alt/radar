-- 0003 : contexte des opportunités (faiblesses des applis concurrentes, secteurs touchés).
-- Rejouable sans erreur.

alter table public.groupes add column if not exists contexte jsonb not null default '{}'::jsonb;

-- Même fonction qu'en 0002, avec le contexte en plus.
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
    insert into public.groupes (nom, resume, secteur, nb_avis, score, score_detail, contexte, centre, calcul)
    values (
      g ->> 'nom',
      g ->> 'resume',
      g ->> 'secteur',
      (g ->> 'nb_avis')::integer,
      (g ->> 'score')::numeric,
      coalesce(g -> 'score_detail', '{}'::jsonb),
      coalesce(g -> 'contexte', '{}'::jsonb),
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

revoke all on function public.remplacer_groupes(jsonb) from public, anon, authenticated;
grant execute on function public.remplacer_groupes(jsonb) to service_role;
