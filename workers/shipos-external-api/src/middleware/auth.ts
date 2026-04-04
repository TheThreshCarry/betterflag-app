import { createMiddleware } from "hono/factory";
import type { AppEnv, ApiKeyData } from "../types";
import { KVKeys } from "../types";
import db from "../../../../lib/db";
import { apikey } from "../../../../lib/auth/auth-schema";
import { DrizzleORM } from "../../../../lib/db";
import { hashApiKey } from "../../../../lib/api-key-hash";

function parsePermissions(
  raw: string | null | undefined
): string[] | undefined {
  if (raw == null || raw === "") return undefined;
  try {
    const v = JSON.parse(raw) as unknown;
    if (Array.isArray(v)) {
      return v.filter((x): x is string => typeof x === "string");
    }
  } catch {
    /* ignore */
  }
  return undefined;
}

function rowToApiKeyData(row: typeof apikey.$inferSelect): ApiKeyData | null {
  if (!row.organizationId) {
    return null;
  }
  return {
    organizationId: row.organizationId,
    userId: row.userId,
    enabled: row.enabled ?? true,
    expiresAt: row.expiresAt ? new Date(row.expiresAt).toISOString() : null,
    permissions: parsePermissions(row.permissions ?? undefined),
    rateLimitEnabled: row.rateLimitEnabled ?? undefined,
    rateLimitTimeWindow: row.rateLimitTimeWindow ?? undefined,
    rateLimitMax: row.rateLimitMax ?? undefined,
  };
}

/**
 * API Key Authentication Middleware
 *
 * KV lookup order: hashed key → legacy raw-key entry → database (by key hash).
 * Legacy KV entries are migrated to hashed keys on read.
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
    const apiKeyDataRaw = await db
      .select()
      .from(apikey)
      .where(DrizzleORM.eq(apikey.key, keyHash));
    const row = apiKeyDataRaw[0];

    if (!row) {
      return c.json(
        {
          error: "Invalid API key",
          code: "API_KEY_NOT_FOUND",
        },
        401
      );
    }

    const fromRow = rowToApiKeyData(row);
    if (!fromRow) {
      return c.json(
        {
          error: "Invalid API key",
          code: "API_KEY_NOT_FOUND",
        },
        401
      );
    }

    apiKeyData = fromRow;
    await c.env.SHIPOS_KV.put(hashedKvKey, JSON.stringify(apiKeyData)).catch(
      (error) => {
        console.error("Error caching API key in KV:", error);
      }
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
