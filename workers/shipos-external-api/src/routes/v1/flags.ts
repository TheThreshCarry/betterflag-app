import { Hono } from "hono";
import type { AppEnv, FlagsResponse, ApiError } from "../../types";
import { KVKeys } from "../../types";

/**
 * Feature Flags Route Handler
 *
 * GET /v1/flags
 * Returns all feature flags for the authenticated project and environment.
 */
const flagsRoute = new Hono<AppEnv>();

flagsRoute.get("/", async (c) => {
  const apiKey = c.get("apiKey");
  const environment = c.get("environment");

  // Build the KV key
  const kvKey = KVKeys.flags(apiKey, environment);

  try {
    // Fetch flags from KV
    const flags = await c.env.SHIPOS_KV.get<FlagsResponse>(kvKey, "json");

    if (flags === null) {
      const error: ApiError = {
        error: "Feature flags not found",
        code: "FLAGS_NOT_FOUND",
      };
      return c.json(error, 404);
    }

    return c.json(flags);
  } catch (err) {
    console.error("Error fetching flags:", err);
    const error: ApiError = {
      error: "Internal server error",
      code: "INTERNAL_ERROR",
    };
    return c.json(error, 500);
  }
});

export { flagsRoute };
