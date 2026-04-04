import http from "k6/http";
import { check, sleep } from "k6";
import { BASE_URL } from "../lib/config.js";

export function authSignup() {
  const timestamp = Date.now();
  const vu = __VU;
  const iter = __ITER;

  const payload = JSON.stringify({
    email: `k6-user-${vu}-${iter}-${timestamp}@loadtest.local`,
    password: "LoadTest123!",
    name: `K6 User ${vu}`,
  });

  const res = http.post(`${BASE_URL}/api/auth/sign-up/email`, payload, {
    headers: { "Content-Type": "application/json" },
  });

  check(res, {
    "signup returns 200 or 422": (r) => r.status === 200 || r.status === 422,
    "response time < 2000ms": (r) => r.timings.duration < 2000,
  });

  sleep(1);
}

export function authLogin() {
  const email = __ENV.TEST_EMAIL || "loadtest@test.local";
  const password = __ENV.TEST_PASSWORD || "LoadTest123!";

  const payload = JSON.stringify({ email, password });

  const res = http.post(`${BASE_URL}/api/auth/sign-in/email`, payload, {
    headers: { "Content-Type": "application/json" },
  });

  check(res, {
    "login returns 200 or 401": (r) => r.status === 200 || r.status === 401,
    "response time < 1500ms": (r) => r.timings.duration < 1500,
  });

  sleep(0.5);
}
