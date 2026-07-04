# @shipos/db

Supabase migrations + row types for the ShipOS control plane.

## Apply

```bash
supabase link --project-ref <ref>   # once
supabase db push                    # applies supabase/migrations/*
```

## Generate types

After applying, replace the hand-written types with generated ones:

```bash
pnpm gen-types   # writes src/database.types.ts from the linked project
```

Until then, `src/index.ts` carries hand-written row types that MUST mirror
the migration exactly.

## Design notes

- **RLS**: org members get read-only SELECT on their org's rows (dashboard
  client reads). There are deliberately NO insert/update/delete policies —
  every mutation goes through the control plane API with the service role so
  audit, guardrails and config sync cannot be bypassed.
- **Audit**: `record_audit()` is called inside the atomic RPCs
  (`create_project_with_envs`, `create_flag_with_configs`,
  `update_flag_config`, `kill_flag`) so the mutation and its audit row commit
  together. `actor_type` = `user` (session) or `agent` (any API key).
- **Optimistic concurrency**: `update_flag_config` takes
  `p_expected_version`; on mismatch it raises SQLSTATE `40001`, which the API
  maps to HTTP 409.
- **Kill switch** is a separate `killed` column, not `enabled = false` — it
  survives config edits and is only cleared explicitly (`p_clear_kill`).
