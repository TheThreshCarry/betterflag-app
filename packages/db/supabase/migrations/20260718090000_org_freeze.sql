-- Super-admin freeze (betterflag-admin app). A frozen org keeps serving flags
-- at the edge (never break production), but the control plane rejects
-- writes: dashboard, REST API, and MCP all go through assertOrgWritable.
-- Nullable timestamp: null = active, set = frozen at that instant.

alter table public.orgs
  add column if not exists frozen_at timestamptz;
