-- ShipOS evaluation analytics — the one meter.
-- Applied to ClickHouse Cloud manually (or via `clickhouse-client < schema.sql`).
-- Events arrive from the ingest worker as JSONEachRow inserts.

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
  user_hash     UInt64                    -- FNV-1a 64 of userId; raw IDs never stored
) ENGINE = MergeTree
PARTITION BY toYYYYMM(ts)
ORDER BY (org_id, project_id, ts)
TTL toDateTime(ts) + INTERVAL 13 MONTH;

-- Billing meter: evaluations per org per day. SummingMergeTree collapses
-- rows on merge; always aggregate with sum() at query time.
CREATE MATERIALIZED VIEW IF NOT EXISTS evals_per_org_day
ENGINE = SummingMergeTree
PARTITION BY toYYYYMM(day)
ORDER BY (org_id, day)
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
