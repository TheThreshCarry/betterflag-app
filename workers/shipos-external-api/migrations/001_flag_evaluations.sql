-- ClickHouse DDL: Feature Flag Evaluations Analytics
-- Run this against your self-hosted ClickHouse instance

CREATE DATABASE IF NOT EXISTS shipos_analytics;

CREATE TABLE IF NOT EXISTS shipos_analytics.feature_flag_evaluations (
    -- Identity
    organization_id LowCardinality(String),
    environment     LowCardinality(String),
    customer_id     String DEFAULT '',

    -- Flag data (one row per flag per request)
    flag_key        LowCardinality(String),
    flag_value      Bool,

    -- Timestamp
    timestamp       DateTime64(3, 'UTC') DEFAULT now64(3),

    -- Geolocation (from Cloudflare cf object -- free, no external API)
    country         LowCardinality(String) DEFAULT '',
    city            String DEFAULT '',
    region          String DEFAULT '',
    continent       LowCardinality(String) DEFAULT '',
    latitude        Float64 DEFAULT 0,
    longitude       Float64 DEFAULT 0,
    timezone        LowCardinality(String) DEFAULT '',

    -- Device / client context (raw UA, parsed at query time)
    user_agent      String DEFAULT '',

    -- SDK metadata
    sdk_version     LowCardinality(String) DEFAULT '',

    -- Request deduplication
    request_id      String
)
ENGINE = MergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (organization_id, environment, flag_key, timestamp)
TTL toDateTime(timestamp) + INTERVAL 1 YEAR
SETTINGS index_granularity = 8192;
