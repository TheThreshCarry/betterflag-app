import { createMiddleware } from "hono/factory";
import type { AppEnv, ApiKeyData } from "../types";
import { KVKeys } from "../types";
import db from "../../../../lib/db";
import { apikey, user as userTable, member as memberTable } from "../../../../lib/auth/auth-schema";
import { DrizzleORM } from "../../../../lib/db";

/**
 * Hash an API key with SHA-256 (same algorithm used when creating keys)
 */
async function hashApiKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * API Key Authentication Middleware
 *
 * Validates the API key by looking it up in Cloudflare KV.
 * Sets the apiKey, environment, and organizationId in context variables.
 *
 * Headers:
 * - x-shipos-key (required): Project API key
 * - x-shipos-env (optional): Environment name, defaults to 'production'
 */
export const authMiddleware = createMiddleware<AppEnv>(async (c, next) => {
  const apiKey = c.req.header("x-shipos-key");
  let organizationId: string | undefined;

  if (!apiKey) {
    return c.json(
      {
        error: "Unauthorized",
        code: "MISSING_API_KEY",
      },
      401
    );
  }

  // Validate API key format (basic validation)
  if (apiKey.length < 8) {
    return c.json(
      {
        error: "Invalid API key format",
        code: "INVALID_API_KEY",
      },
      401
    );
  }

  // Look up API key in KV
  let apiKeyData: any | undefined;
  const kvKey = KVKeys.apiKey(apiKey);
  apiKeyData = await c.env.SHIPOS_KV.get<ApiKeyData>(kvKey, "json");

  if (!apiKeyData) {
    // Hash the incoming key to match the stored SHA-256 hash in the database
    const keyHash = await hashApiKey(apiKey);

    // Lookup API key in Database by hash
    let apiKeyDataRaw = await db.select().from(apikey).where(DrizzleORM.eq(apikey.key, keyHash));
    let _apiKeyData = apiKeyDataRaw[0];

    if (!_apiKeyData) {
      return c.json(
        {
          error: "Invalid API key",
          code: "API_KEY_NOT_FOUND",
        },
        401
      );
    }

    // Make sure the API key is related to an organization via the member table
    const memberDataRaw = await db.select().from(memberTable).where(DrizzleORM.eq(memberTable.userId, _apiKeyData.userId));
    const memberData = memberDataRaw[0];
    if (!memberData) {
      return c.json(
        {
          error: "Invalid API key",
          code: "API_KEY_NOT_FOUND",
        },
        401
      );
    }

    organizationId = memberData.organizationId;
    if (!organizationId) {
      return c.json(
        {
          error: "Invalid API key",
          code: "API_KEY_NOT_FOUND",
        },
        401
      );
    }
    apiKeyData = {
      organizationId: organizationId,
      userId: _apiKeyData.userId,
      enabled: _apiKeyData.enabled,
      expiresAt: _apiKeyData.expiresAt,
      permissions: _apiKeyData.permissions,
    };
    // Cache in KV for future fast lookups (keyed by raw key, not hash)
    await c.env.SHIPOS_KV.put(KVKeys.apiKey(apiKey), JSON.stringify(apiKeyData)).catch((error) => {
      console.error("Error setting API key in KV:", error);
    });
  }

  // Check if API key is enabled
  if (!apiKeyData.enabled) {
    return c.json(
      {
        error: "API key is disabled",
        code: "API_KEY_DISABLED",
      },
      401
    );
  }

  // Check if API key is expired
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

  // Extract environment, default to 'production'
  const environment = c.req.header("x-shipos-env") || "production";

  // Set context variables for downstream handlers
  c.set("apiKey", apiKey);
  c.set("environment", environment);
  c.set("organizationId", apiKeyData.organizationId);

  await next();
});
