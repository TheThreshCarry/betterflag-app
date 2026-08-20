-- Where a key came from:
--   'manual', minted from the dashboard Keys page (the default)
--   'oauth' , minted automatically when a user approves an MCP OAuth
--              connection (e.g. clicking "Connect" in Claude). One key per
--              connection; revoking the key disconnects the client.
-- OAuth-sourced keys are exempt from the plan agent-key limit.
alter table public.api_keys
  add column if not exists source text not null default 'manual';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'api_keys_source_check'
  ) then
    alter table public.api_keys
      add constraint api_keys_source_check check (source in ('manual', 'oauth'));
  end if;
end $$;
