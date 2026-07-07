-- Where a key came from:
--   'manual', minted from the dashboard Keys page (the default)
--   'oauth' , minted automatically when a user approves an MCP OAuth
--              connection (e.g. clicking "Connect" in Claude). One key per
--              connection; revoking the key disconnects the client.
-- OAuth-sourced keys are exempt from the plan agent-key limit.
alter table public.api_keys
  add column source text not null default 'manual'
    check (source in ('manual', 'oauth'));
