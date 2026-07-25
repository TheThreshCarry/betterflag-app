-- ShipOS evaluation analytics, the one meter.
-- Applied to ClickHouse Cloud manually (or via `clickhouse-client < schema.sql`).
-- Events arrive from the ingest worker as JSONEachRow inserts.
--
-- Storage tiering (see docs/CONTRACTS.md "Analytics retention"):
--   * Raw `evaluations` rows are HOT for 7 days (TTL below), then expire.
--   * The ingest worker's daily cron exports each finished day to R2 as
--     analytics/{org_id}/{yyyy-mm-dd}.ndjson.gz BEFORE the TTL fires, and
--     deletes R2 objects older than the org's plan retention.
--   * Aggregate MVs stay in ClickHouse for 13 months; they are tiny and the
--     billing meter (evals_per_org_day) must survive raw expiry.

CREATE TABLE IF NOT EXISTS evaluations (
  ts            DateTime64(3),
  org_id        LowCardinality(String),
  project_id    LowCardinality(String),
  env           LowCardinality(String),
  flag_key      LowCardinality(String),
  variation     String,
  reason        LowCardinality(String),   -- rule_match | rollout | default | killed | disabled | not_found
  actor_kind    LowCardinality(String),   -- sdk | agent | api
  sdk           LowCardinality(String),
  user_hash     UInt64,                   -- FNV-1a 64 of userId; raw IDs never stored
  country       LowCardinality(String) DEFAULT 'unknown',  -- ISO 3166-1 alpha-2 from request.cf at the edge
  region        LowCardinality(String) DEFAULT '',         -- cf.region (state / community); empty when unavailable
  city          LowCardinality(String) DEFAULT '',         -- cf.city; empty when unavailable
  lat           Nullable(Float64) DEFAULT NULL,            -- ~1 km rounded client latitude
  lng           Nullable(Float64) DEFAULT NULL             -- ~1 km rounded client longitude
) ENGINE = MergeTree
PARTITION BY toDate(ts)
ORDER BY (org_id, project_id, ts)
TTL toDateTime(ts) + INTERVAL 7 DAY;

-- Billing meter: evaluations per org per day. SummingMergeTree collapses
-- rows on merge; always aggregate with sum() at query time.
CREATE MATERIALIZED VIEW IF NOT EXISTS evals_per_org_day
ENGINE = SummingMergeTree
PARTITION BY toYYYYMM(day)
ORDER BY (org_id, day)
TTL day + INTERVAL 13 MONTH
AS SELECT
  org_id,
  toDate(ts) AS day,
  count() AS evaluations
FROM evaluations
GROUP BY org_id, day;

-- Dashboard charts: per-flag, per-variation hourly series.
CREATE MATERIALIZED VIEW IF NOT EXISTS evals_per_flag_hour
ENGINE = SummingMergeTree
PARTITION BY toYYYYMM(hour)
ORDER BY (org_id, project_id, env, flag_key, variation, hour)
TTL toDate(hour) + INTERVAL 13 MONTH
AS SELECT
  org_id,
  project_id,
  env,
  flag_key,
  variation,
  toStartOfHour(ts) AS hour,
  count() AS evaluations
FROM evaluations
GROUP BY org_id, project_id, env, flag_key, variation, hour;

-- Analytics page + per-flag geo breakdown: per-flag, per-country hourly
-- series. Org-wide numbers are sums over flag_key/country of this view.
CREATE MATERIALIZED VIEW IF NOT EXISTS evals_per_flag_country_hour
ENGINE = SummingMergeTree
PARTITION BY toYYYYMM(hour)
ORDER BY (org_id, project_id, env, flag_key, country, hour)
TTL toDate(hour) + INTERVAL 13 MONTH
AS SELECT
  org_id,
  project_id,
  env,
  flag_key,
  country,
  toStartOfHour(ts) AS hour,
  count() AS evaluations
FROM evaluations
GROUP BY org_id, project_id, env, flag_key, country, hour;

-- ---------------------------------------------------------------------------
-- Migration from the pre-country / 13-month-raw schema (run once on existing
-- deployments; fresh deployments get everything from the CREATEs above):
--
--   ALTER TABLE evaluations
--     ADD COLUMN IF NOT EXISTS country LowCardinality(String) DEFAULT 'unknown';
--   ALTER TABLE evaluations
--     ADD COLUMN IF NOT EXISTS region LowCardinality(String) DEFAULT '';
--   ALTER TABLE evaluations
--     ADD COLUMN IF NOT EXISTS city LowCardinality(String) DEFAULT '';
--   ALTER TABLE evaluations
--     ADD COLUMN IF NOT EXISTS lat Nullable(Float64) DEFAULT NULL;
--   ALTER TABLE evaluations
--     ADD COLUMN IF NOT EXISTS lng Nullable(Float64) DEFAULT NULL;
--   ALTER TABLE evaluations
--     MODIFY TTL toDateTime(ts) + INTERVAL 7 DAY;
--   -- The PARTITION BY change (toYYYYMM → toDate) only applies to fresh
--   -- tables; existing monthly partitions keep working under the 7-day TTL.
--   -- Then create evals_per_flag_country_hour with the statement above
--   -- (no POPULATE; it fills forward from creation).
-- ---------------------------------------------------------------------------
