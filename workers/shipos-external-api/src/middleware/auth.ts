import { createMiddleware } from "hono/factory";
import type { AppEnv, ApiKeyData } from "../types";
import { KVKeys } from "../types";
import { hashApiKey } from "../../../../lib/api-key-hash";

/**
 * API Key Authentication Middleware
 *
 * KV-only lookup (Rule 3: public SDK read path never hits Supabase). Hashed
 * KV entries are the source of truth; legacy raw-key entries are migrated
 * to hashed keys on read. KV is populated by the dashboard write path
 * (see lib/actions/api-keys.ts + lib/sync/kv-sync.ts).
 */
export const authMiddleware = createMiddleware<AppEnv>(async (c, next) => {
  const apiKeyHeader = c.req.header("x-shipos-key");

  if (!apiKeyHeader) {
    return c.json(
      {
        error: "Unauthorized",
        code: "MISSING_API_KEY",
      },
      401
    );
  }

  if (apiKeyHeader.length < 8) {
    return c.json(
      {
        error: "Invalid API key format",
        code: "INVALID_API_KEY",
      },
      401
    );
  }

  const keyHash = await hashApiKey(apiKeyHeader);
  const hashedKvKey = KVKeys.apiKeyHashed(keyHash);
  const legacyKvKey = KVKeys.apiKeyLegacy(apiKeyHeader);

  let apiKeyData = await c.env.SHIPOS_KV.get<ApiKeyData>(hashedKvKey, "json");

  if (!apiKeyData) {
    const legacy = await c.env.SHIPOS_KV.get<ApiKeyData>(legacyKvKey, "json");
    if (legacy) {
      apiKeyData = legacy;
      await c.env.SHIPOS_KV.put(hashedKvKey, JSON.stringify(apiKeyData)).catch(
        (error) => {
          console.error("Error migrating API key to hashed KV key:", error);
        }
      );
      await c.env.SHIPOS_KV.delete(legacyKvKey).catch((error) => {
        console.error("Error deleting legacy API key from KV:", error);
      });
    }
  }

  if (!apiKeyData) {
    return c.json(
      {
        error: "Invalid API key",
        code: "API_KEY_NOT_FOUND",
      },
      401
    );
  }

  if (!apiKeyData.enabled) {
    return c.json(
      {
        error: "API key is disabled",
        code: "API_KEY_DISABLED",
      },
      401
    );
  }

  if (apiKeyData.expiresAt) {
    const expiresAt = new Date(apiKeyData.expiresAt);
    if (expiresAt < new Date()) {
      return c.json(
        {
          error: "API key has expired",
          code: "API_KEY_EXPIRED",
        },
        401
      );
    }
  }

  const environment = c.req.header("x-shipos-env") || "production";

  c.set("apiKey", apiKeyHeader);
  c.set("environment", environment);
  c.set("organizationId", apiKeyData.organizationId);
  c.set("apiKeyData", apiKeyData);

  await next();
});
