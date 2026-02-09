import { createMiddleware } from "hono/factory";
import type { AppEnv, ApiKeyData } from "../types";
import { KVKeys } from "../types";

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
  const kvKey = KVKeys.apiKey(apiKey);
  const apiKeyData = await c.env.SHIPOS_KV.get<ApiKeyData>(kvKey, "json");

  if (!apiKeyData) {
    return c.json(
      {
        error: "Invalid API key",
        code: "API_KEY_NOT_FOUND",
      },
      401
    );
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
