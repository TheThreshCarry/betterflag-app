import { Hono } from "hono";
import type { AppEnv, ConfigResponse, ApiError } from "../../types";
import { KVKeys } from "../../types";

/**
 * Global Config Route Handler
 *
 * GET /v1/config/:slug
 * Returns the configuration for the specified slug (e.g., pricing, legal).
 */
const configRoute = new Hono<AppEnv>();

configRoute.get("/:slug", async (c) => {
  const apiKey = c.get("apiKey");
  const environment = c.get("environment");
  const slug = c.req.param("slug");

  // Validate slug
  if (!slug || slug.trim() === "") {
    const error: ApiError = {
      error: "Config slug is required",
      code: "MISSING_SLUG",
    };
    return c.json(error, 400);
  }

  // Sanitize slug (alphanumeric, hyphens, underscores only)
  const slugPattern = /^[a-zA-Z0-9_-]+$/;
  if (!slugPattern.test(slug)) {
    const error: ApiError = {
      error: "Invalid config slug format",
      code: "INVALID_SLUG",
    };
    return c.json(error, 400);
  }

  // Build the KV key
  const kvKey = KVKeys.config(apiKey, environment, slug);

  try {
    // Fetch config from KV
    const config = await c.env.SHIPOS_KV.get<ConfigResponse>(kvKey, "json");

    if (config === null) {
      const error: ApiError = {
        error: `Config '${slug}' not found`,
        code: "CONFIG_NOT_FOUND",
      };
      return c.json(error, 404);
    }

    return c.json(config);
  } catch (err) {
    console.error("Error fetching config:", err);
    const error: ApiError = {
      error: "Internal server error",
      code: "INTERNAL_ERROR",
    };
    return c.json(error, 500);
  }
});

export { configRoute };
