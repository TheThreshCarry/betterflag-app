-- Enable dashboard live updates for flags / flag_configs via supabase_realtime.
-- Replica identity FULL on flag_configs so UPDATE/DELETE payloads include
-- flag_id (needed for client scoping; table has no project_id).
-- Do not add audit_log.

alter publication supabase_realtime add table public.flags, public.flag_configs;
alter table public.flag_configs replica identity full;
