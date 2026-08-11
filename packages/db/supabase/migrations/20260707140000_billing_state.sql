-- Billing state synced from Polar webhooks (apps/webhooks → betterflag-webhooks).
--
-- `plan` continues to hold the last SUBSCRIBED tier; access on non-payment is
-- DERIVED at read time from `subscription_status` + `past_due_since` by the
-- billing lifecycle policy (apps/dashboard/lib/billing-lifecycle.ts), which
-- keeps flags serving but flips the dashboard read-only after the grace window.
--
-- `billing_synced_at` records the timestamp of the last Polar event applied, so
-- out-of-order webhook delivery can't overwrite newer state with older state.

alter table public.orgs
  add column if not exists polar_customer_id text,
  add column if not exists polar_subscription_id text,
  add column if not exists subscription_status text,
  add column if not exists past_due_since timestamptz,
  add column if not exists billing_synced_at timestamptz;

-- Webhooks resolve the org by Polar customer id when subscription/checkout
-- metadata doesn't carry an org_id.
create index if not exists orgs_polar_customer_id_idx
  on public.orgs (polar_customer_id);
