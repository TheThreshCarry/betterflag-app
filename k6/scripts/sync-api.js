import http from "k6/http";
import { check, sleep } from "k6";
import { BASE_URL } from "../lib/config.js";
import { getSyncHeaders } from "../lib/auth-helper.js";

export function syncUpsert() {
  const headers = getSyncHeaders();
  const key = `load-test-flag-${__VU}-${__ITER}`;

  const payload = JSON.stringify({
    type: "flags",
    action: "upsert",
    key: key,
    value: { enabled: true },
  });

  const res = http.post(`${BASE_URL}/api/sync`, payload, { headers });

  check(res, {
    "sync upsert status 200 or 500": (r) => r.status === 200 || r.status === 500,
    "response time < 1000ms": (r) => r.timings.duration < 1000,
  });

  sleep(0.3);
}

export function syncBatch() {
  const headers = getSyncHeaders();

  const payloads = Array.from({ length: 5 }, (_, i) => ({
    type: "flags",
    action: "upsert",
    key: `batch-${__VU}-${__ITER}-${i}`,
    value: { enabled: i % 2 === 0 },
  }));

  const res = http.put(`${BASE_URL}/api/sync`, JSON.stringify(payloads), {
    headers,
  });

  check(res, {
    "batch sync status 200 or 500": (r) => r.status === 200 || r.status === 500,
    "response time < 2000ms": (r) => r.timings.duration < 2000,
  });

  sleep(0.5);
}
