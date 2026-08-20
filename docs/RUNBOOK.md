# Ops runbook

Apply schema from `packages/db` (never a gitignored root `supabase/`):

```bash
cd packages/db
supabase link --project-ref <ref>   # once
supabase db push
```

Dashboard boot fails fast when `NEXT_PUBLIC_SUPABASE_*`,
`SUPABASE_SERVICE_ROLE_KEY`, `POLAR_ACCESS_TOKEN`, `POLAR_SERVER`, or
`MCP_OAUTH_SHARED_SECRET` is missing (`apps/dashboard/instrumentation.ts`).
Local values live in `apps/dashboard/.env.local`, not the repo-root `.env`.

## Wrangler secrets

Put tokens with `wrangler secret put <NAME>` from the worker directory.
Vars (non-secret) stay in `wrangler.jsonc`.

| Worker | Secret | Notes |
|---|---|---|
| ingest | `SUPABASE_SERVICE_ROLE_KEY` | config-sync + meter |
| ingest | `CLICKHOUSE_URL`, `CLICKHOUSE_USER`, `CLICKHOUSE_PASSWORD` | events + meter + cold storage |
| ingest | `POLAR_ACCESS_TOKEN` | hourly meter; skip Polar when unset |
| ingest | `BETTER_STACK_HEARTBEAT_URL` | ping after successful cold storage |
| ingest | `POLAR_SERVER` | optional; `production` or `sandbox` (can be a var) |
| api | none required beyond bindings | `CONFIG_KV`, `EVENTS` |
| mcp | `MCP_OAUTH_SHARED_SECRET` | must match dashboard env |
| lifecycle | `LIFECYCLE_SECRET`, `SUPABASE_SERVICE_ROLE_KEY` | must match dashboard `LIFECYCLE_SECRET` |
| tail | `BETTER_STACK_SOURCE_TOKEN` | Betterflag Tail source |
| webhooks | Polar webhook secret | see `apps/webhooks` |

## ITR-186 — RPC EXECUTE revoke

Migration: `packages/db/supabase/migrations/20260820100000_rpc_execute_revoke.sql`.

Mutators (`record_audit`, `create_project_with_envs`,
`create_flag_with_configs`, `update_flag_config`, `kill_flag`) are
`SECURITY DEFINER` with `require_org_member` when `auth.uid()` is present.
`EXECUTE` is revoked from `public` / `anon` / `authenticated` and granted
to `service_role` only. Do **not** revoke `is_org_member` / `org_of_project`
(RLS). Dashboard RPCs already use `createServiceClient()`.

**Rollback** (restores the cross-tenant hole — emergency only):

```sql
-- Re-apply original function bodies from 20260704000001_init.sql, then:
grant execute on function public.record_audit(uuid, uuid, public.actor_type, uuid, text, text, text, jsonb, jsonb) to authenticated;
grant execute on function public.create_project_with_envs(uuid, text, text, public.actor_type, uuid, text) to authenticated;
grant execute on function public.create_flag_with_configs(uuid, text, text, text, public.flag_kind, jsonb, public.actor_type, uuid, text) to authenticated;
grant execute on function public.update_flag_config(uuid, uuid, boolean, integer, jsonb, jsonb, jsonb, boolean, integer, public.actor_type, uuid, text) to authenticated;
grant execute on function public.kill_flag(uuid, uuid, public.actor_type, uuid, text) to authenticated;
```

Prefer fixing the control plane over rolling this back.

## ITR-189 — email_templates

Migration: `packages/db/supabase/migrations/20260820110000_email_templates.sql`.

Seed rows have empty `compiled_html`; lifecycle falls back to
`@betterflag/emails` until admin saves a template.

**Rollback** (drops admin edits):

```sql
drop table if exists public.email_templates;
```

## ITR-187 — Polar meter + edge quota

- Ingest crons: `10 3 * * *` cold storage, `0 * * * *` meter.
- Polar meter aggregation must be `sum(evaluations)`. `bun run polar:setup`
  from `apps/dashboard` creates new meters that way and tries to patch an
  existing count meter. Polar **rejects** aggregation changes once events or
  purchases exist — recreate the meter and re-attach products/benefits, or
  hourly ingest bills 1 unit per event.
- Token needs `events:write` (ingest) plus the dashboard Polar scopes.
- Starter edge throttle: 429 `quota_exceeded` at 3× included (3M).
  `Retry-After: 3600`. Launch/Scale/trial never blocked.

**Rollback meter cron:** remove `"0 * * * *"` from
`apps/ingest/wrangler.jsonc` `triggers.crons` and redeploy ingest. Existing
KV `plan`/`quota`/`used` fields are ignored when `quota` is null.

## Dashboard / worker deploy rollback

- Dashboard (Vercel): revert the deployment in the Vercel UI (previous
  production alias). Env vars stay.
- Worker: `wrangler rollback` from the app directory, or redeploy the
  previous git SHA with `--var BETTERFLAG_GIT_SHA:<sha>`.
