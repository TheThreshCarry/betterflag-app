import { createMiddleware } from "hono/factory";
import type { AppEnv } from "../types";

/**
 * Service Authentication Middleware
 *
 * Validates internal service-to-service calls using a shared secret.
 * The caller must provide the secret in the `x-service-secret` header.
 * This is used by the Next.js app to sync data to KV without going
 * through the Cloudflare REST API.
 */
export const serviceAuthMiddleware = createMiddleware<AppEnv>(
  async (c, next) => {
    const secret = c.req.header("x-service-secret");

    if (!secret) {
      return c.json(
        { error: "Unauthorized", code: "MISSING_SERVICE_SECRET" },
        401
      );
    }

    if (!c.env.SERVICE_SECRET) {
      console.error("SERVICE_SECRET is not configured in the worker");
      return c.json(
        { error: "Internal server error", code: "SERVICE_NOT_CONFIGURED" },
        500
      );
    }

    if (secret !== c.env.SERVICE_SECRET) {
      return c.json(
        { error: "Unauthorized", code: "INVALID_SERVICE_SECRET" },
        401
      );
    }

    await next();
  }
);
