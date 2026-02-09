import type { ConfigResponse, ApiError } from "../types";
import { KVKeys } from "../types";
import { createController, controllerRegistry } from "./index";

/**
 * Global Config Controller
 *
 * Handles all global configuration related endpoints.
 *
 * Endpoints:
 * - GET /config/:slug - Get a specific config by slug
 */
const configController = createController(
  {
    name: "config",
    version: "v1",
    basePath: "/config",
    description: "Global configuration management - retrieve configs by slug",
  },
  (router) => {
    /**
     * GET /config/:slug
     * Returns the configuration for the specified slug.
     */
    router.get("/:slug", async (c) => {
      const organizationId = c.get("organizationId");
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

      // Build the KV key using organization ID
      const kvKey = KVKeys.config(organizationId, environment, slug);

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
  }
);

// Register the controller
controllerRegistry.register(configController);

export { configController };
