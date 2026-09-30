-- 0008 : avis Trustpilot des SaaS sur ordinateur (30/09), à côté de ceux de l'App Store.
-- Chaque SaaS devient une « appli » de source trustpilot (store_id = son domaine). Rejouable sans erreur.
alter table public.apps drop constraint if exists apps_store_check;
alter table public.apps add constraint apps_store_check check (store in ('appstore', 'trustpilot'));
