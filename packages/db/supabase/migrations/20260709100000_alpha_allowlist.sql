-- Private-alpha allowlist.
--
-- Gates ONBOARDING, not sign-in: anyone can create a Supabase account, but an
-- email must exist here before its user can create an org (POST /api/v1/orgs
-- and /onboarding both check it). Existing org members are never re-checked,
-- so admitted users and invited teammates keep access.
--
-- Admit emails with `bun run alpha:admit` (apps/dashboard/scripts/admit-alpha.ts).
-- Escape hatch: set ALPHA_GATE_DISABLED=1 on the dashboard to open signups at
-- public launch without a migration.

create table if not exists public.alpha_allowlist (
  email text primary key,
  note text,
  created_at timestamptz not null default now(),
  constraint alpha_allowlist_email_lower check (email = lower(email))
);

-- Service-role only: RLS enabled with no policies.
alter table public.alpha_allowlist enable row level security;
