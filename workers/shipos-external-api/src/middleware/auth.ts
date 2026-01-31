import { createMiddleware } from "hono/factory";
import type { AppEnv } from "../types";

/**
 * API Key Authentication Middleware
 *
 * Extracts and validates the API key from x-shipos-key header.
 * Sets the apiKey and environment in context variables.
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

  // Extract environment, default to 'production'
  const environment = c.req.header("x-shipos-env") || "production";

  // Set context variables for downstream handlers
  c.set("apiKey", apiKey);
  c.set("environment", environment);

  await next();
});
