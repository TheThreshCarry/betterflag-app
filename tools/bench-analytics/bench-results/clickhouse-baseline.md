# clickhouse-cloud benchmark (clickhouse-baseline)

Generated 2026-07-11T19:09:40.838Z at `95f6e9c` for ITR-62.

## Insert throughput

| Mode | Events | Batch | Conc. | Rows/s | p50 | p95 | p99 | Retries | Failed batches |
|---|---|---|---|---|---|---|---|---|---|
| large-batch | 5,000,000 | 10000 | 4 | 46,237 | 824.38ms | 1066.13ms | 1137.96ms | 0 | 0 |
| small-batch | 5,000,000 | 100 | 12 | 5,188 | 247.34ms | 262.03ms | 300.92ms | 0 | 0 |

## Queries (clickhouse, org `bench-org-00`)

| Query | Cold | Warm p50 | Warm p95 | Rows |
|---|---|---|---|---|
| q1_billing_meter | 75.17ms | 23.35ms | 25.33ms | 102 |
| q2_dashboard_series | 35.3ms | 33.34ms | 37.84ms | 2505 |
| q3_geo_breakdown | 31.67ms | 28.19ms | 30.94ms | 16 |
| q4_raw_top_variations | 32.31ms | 32.15ms | 36.6ms | 3 |
| q5_concurrency (20x Q2) | - | 72.61ms | 107.67ms | - |

Q5 wall time per 20-query round: 117ms, 87ms, 81ms.

## Cloud cost

Compute active-hours and cost for the bench window are read manually from the ClickHouse Cloud console and belong in `cloudCost` in the JSON.
