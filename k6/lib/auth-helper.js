import http from "k6/http";
import { check } from "k6";
import { BASE_URL } from "./config.js";

export function getAuthHeaders() {
  const orgId = __ENV.ORG_ID || "load-test-org";
  return {
    "Content-Type": "application/json",
    "x-organization-id": orgId,
  };
}

export function getSyncHeaders() {
  const syncSecret = __ENV.SYNC_SECRET || "test-sync-secret";
  return {
    "Content-Type": "application/json",
    "x-sync-secret": syncSecret,
  };
}

export function loginUser(email, password) {
  const res = http.post(
    `${BASE_URL}/api/auth/sign-in/email`,
    JSON.stringify({ email, password }),
    { headers: { "Content-Type": "application/json" } }
  );

  check(res, {
    "login succeeded": (r) => r.status === 200,
  });

  if (res.status === 200) {
    const cookies = res.cookies;
    return cookies;
  }
  return null;
}
