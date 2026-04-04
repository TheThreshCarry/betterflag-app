import http from "k6/http";
import { check, sleep } from "k6";
import { BASE_URL } from "../lib/config.js";
import { getAuthHeaders } from "../lib/auth-helper.js";

export function cmsList() {
  const headers = getAuthHeaders();

  const res = http.get(`${BASE_URL}/api/cms/content-types`, { headers });

  check(res, {
    "status is 200": (r) => r.status === 200,
    "response has data": (r) => {
      const body = r.json();
      return body && Array.isArray(body.data);
    },
    "response time < 500ms": (r) => r.timings.duration < 500,
  });

  sleep(0.5);
}

export function cmsGetBySlug() {
  const headers = getAuthHeaders();
  const slug = __ENV.TEST_SLUG || "blog-post";

  const res = http.get(`${BASE_URL}/api/cms/content-types/${slug}`, { headers });

  check(res, {
    "status is 200 or 404": (r) => r.status === 200 || r.status === 404,
    "response time < 500ms": (r) => r.timings.duration < 500,
  });

  sleep(0.5);
}
