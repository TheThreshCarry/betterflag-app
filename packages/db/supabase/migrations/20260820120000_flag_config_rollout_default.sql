-- New flags default to 100% rollout. Enabling the flag then serves ON
-- immediately after snapshot sync. Existing rows are unchanged.
--
-- Rollback:
--   alter table public.flag_configs alter column rollout_pct set default 0;

alter table public.flag_configs
  alter column rollout_pct set default 100;
