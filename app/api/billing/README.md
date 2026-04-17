# Polar billing routes (Supabase adapter)

These routes implement Phase 5 of the ShipOS Edge Architecture: Polar
billing driven by the official [`@polar-sh/supabase`](https://polar.sh/docs/integrate/sdk/adapters/supabase)
adapter. Supabase is the source of truth for `subscriptions`/`orders`;
Polar webhooks are the only thing that mutates them.

## Routes

| Method | Path | Purpose |
|--|--|--|
| `GET`  | `/api/billing/checkout?products=<id>&customerExternalId=<user_id>` | Start a Polar checkout; redirects to `POLAR_SUCCESS_URL`. |
| `GET`  | `/api/billing/portal` | Redirect the signed-in user to their Polar customer portal. Uses `polar_customers.polar_customer_id`. |
| `POST` | `/api/billing/webhooks` | Polar webhook receiver. Verifies signature with `POLAR_WEBHOOK_SECRET`, upserts `subscriptions`/`orders`, then syncs entitlements to Cloudflare KV. |
| `POST` | `/api/auth/hooks/user-created` | Supabase auth webhook. On `auth.users` insert: create Polar customer, insert `polar_customers` row. Requires `x-shipos-webhook-secret: $SUPABASE_WEBHOOK_SECRET`. |

## Required env

```
POLAR_ACCESS_TOKEN=...
POLAR_WEBHOOK_SECRET=...
POLAR_SERVER=sandbox|production
POLAR_SUCCESS_URL=https://app.example.com/dashboard/settings/billing?success=true
POLAR_PRO_PRODUCT_ID=...
POLAR_TEAM_PRODUCT_ID=...

NEXT_PUBLIC_SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
SUPABASE_WEBHOOK_SECRET=...
```

## Entitlements

`lib/billing/entitlements.ts#getOrganizationEntitlements(orgId)` reads
the latest active subscription for an org and returns
`{ plan, status, limits, currentPeriodEnd, cancelAtPeriodEnd }`.

After every subscription webhook we call `syncEntitlementsTenant(orgId, …)`
which writes to Cloudflare KV at `tenant_{orgId}_entitlements`. Workers
read that key on the hot path — no round-trip to Polar or Supabase.

## Supabase dashboard wiring

1. **Polar → Webhooks** → add endpoint `https://<app>/api/billing/webhooks`, secret = `POLAR_WEBHOOK_SECRET`. Enable: `subscription.*`, `order.*`, `customer.state_changed`.
2. **Supabase Studio → Database → Webhooks** → add webhook on `auth.users` (INSERT) → POST to `/api/auth/hooks/user-created` with header `x-shipos-webhook-secret: $SUPABASE_WEBHOOK_SECRET`.
3. The dashboard client in `app/dashboard/settings/billing/billing-client.tsx` redirects to `/api/billing/checkout?products=<id>&customerExternalId=<user_id>` for upgrades and `/api/billing/portal` for manage-subscription.
