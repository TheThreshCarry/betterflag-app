# shipos-external-api Worker

Cloudflare Worker that serves the public SDK API. **Read-only edge** — all data comes from Cloudflare KV; the worker never calls the database. Dashboard writes in `shipos-app` sync KV via the `/internal/kv/*` endpoint (protected by `SERVICE_SECRET`).

## Architecture rules

- **R3 (Public SDK Read)**: `/v1/flags`, `/v1/config/:slug`, `/v1/cms/entries/:ct[/:slug]` read only from KV. KV miss → 404 (cms/config) or `{}` (flags). Never falls back to Postgres.
- **R5 (Analytics routing)**: SDK events bypass the DB — posted to Tinybird via `lib/tinybird.ts` (Phase 4).

## Public endpoints

| Method | Path | Source |
|---|---|---|
| GET | `/v1/flags` | KV `tenant_{orgId}_flags` (fallback `v1::org_{orgId}::{env}::flags`) |
| GET | `/v1/config/:slug` | KV `tenant_{orgId}_config_{slug}` (fallback `v1::org_{orgId}::{env}::config::{slug}`) |
| GET | `/v1/cms/entries/:ct` | KV `tenant_{orgId}_cms_{ct}_index` |
| GET | `/v1/cms/entries/:ct/:slug` | KV `tenant_{orgId}_cms_{ct}_{slug}` |
| POST | `/v1/customers/identify` | KV read-modify-write `tenant_{orgId}_customer_{externalId}` |
| POST | `/v1/analytics/events` | Tinybird `events` datasource (Phase 4) |

## KV key scheme

### Tenant scheme (preferred, plan R2)

| Key | Value |
|---|---|
| `tenant_{orgId}_flags` | `{ [env]: { [key]: bool }, _updatedAt }` |
| `tenant_{orgId}_config_{slug}` | `{ data, _updatedAt }` |
| `tenant_{orgId}_cms_{ct}_index` | `{ entries: [{ slug, title?, updatedAt }], _updatedAt }` |
| `tenant_{orgId}_cms_{ct}_{entrySlug}` | `{ data, _updatedAt, ... }` |
| `tenant_{orgId}_customer_{externalId}` | `{ ..., _updatedAt }` |
| `tenant_{orgId}_entitlements` | `{ plan, status, featureFlagLimit, cmsEntryLimit, seats, validUntil }` |

### Legacy scheme (kept during cutover, read-through)

| Key | Value |
|---|---|
| `v1::apikey_h::{sha256}` | `{ organizationId, enabled, permissions, rateLimit* }` |
| `v1::org_{orgId}::{env}::flags` | `{ [key]: bool }` |
| `v1::org_{orgId}::{env}::config::{slug}` | `{ ... }` |

## Edge caching

All read endpoints emit:

```
Cache-Control: public, max-age=30, s-maxage=60
ETag: W/"<base64(updated_at)>"
```

Clients sending `If-None-Match: <etag>` get `304 Not Modified`.

## Local dev

```bash
bun install
bun run dev
```

## Deploy

```bash
bun run deploy
```

## Types

```bash
bun run cf-typegen
```
