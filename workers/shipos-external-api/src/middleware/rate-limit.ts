import { createMiddleware } from "hono/factory";
import type { AppEnv } from "../types";
import { hashApiKey } from "../../../../lib/api-key-hash";
import { rateLimitKvKey, rateLimitWindowId } from "../../../../lib/rate-limit-kv";

/**
 * Fixed-window rate limiting using KV (per API key hash).
 * Honors rateLimit* fields on apiKeyData synced from the dashboard.
 */
export const rateLimitMiddleware = createMiddleware<AppEnv>(async (c, next) => {
  const data = c.get("apiKeyData");
  const apiKeyHeader = c.get("apiKey");

  if (data.rateLimitEnabled === false) {
    await next();
    return;
  }

  const windowMs = data.rateLimitTimeWindow ?? 86400000;
  const max = data.rateLimitMax ?? 10;
  const keyHash = await hashApiKey(apiKeyHeader);
  const windowId = rateLimitWindowId(Date.now(), windowMs);
  const kvKey = rateLimitKvKey(keyHash, windowId);

  const raw = await c.env.SHIPOS_KV.get(kvKey);
  let count = raw ? parseInt(raw, 10) : 0;

  if (Number.isNaN(count)) {
    await c.env.SHIPOS_KV.delete(kvKey).catch(() => {});
    count = 0;
  }

  const windowEndMs = (windowId + 1) * windowMs;
  const resetUnix = Math.floor(windowEndMs / 1000);
  const ttlSec = Math.max(
    1,
    Math.ceil((windowEndMs - Date.now()) / 1000)
  );

  if (count >= max) {
    c.header("X-RateLimit-Limit", String(max));
    c.header("X-RateLimit-Remaining", "0");
    c.header("X-RateLimit-Reset", String(resetUnix));
    return c.json(
      {
        error: "Too many requests",
        code: "RATE_LIMITED",
      },
      429
    );
  }

  await c.env.SHIPOS_KV.put(kvKey, String(count + 1), {
    expirationTtl: ttlSec,
  });

  c.header("X-RateLimit-Limit", String(max));
  c.header("X-RateLimit-Remaining", String(Math.max(0, max - count - 1)));
  c.header("X-RateLimit-Reset", String(resetUnix));

  await next();
});
