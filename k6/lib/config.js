export const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";

export const DEFAULT_HEADERS = {
  "Content-Type": "application/json",
};

export const DEFAULT_THRESHOLDS = {
  http_req_duration: ["p(95)<500", "p(99)<1500"],
  http_req_failed: ["rate<0.01"],
};
