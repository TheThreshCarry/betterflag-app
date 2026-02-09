import type { FlagsResponse, ApiError } from "../types";
import { KVKeys } from "../types";
import { createController, controllerRegistry } from "./index";

/**
 * Feature Flags Controller
 *
 * Handles all feature flag related endpoints.
 *
 * Endpoints:
 * - GET /flags - Get all feature flags for the organization
 */
const flagsController = createController(
  {
    name: "flags",
    version: "v1",
    basePath: "/flags",
    description: "Feature flags management - retrieve feature flags for your organization",
  },
  (router) => {
    /**
     * GET /flags
     * Returns all feature flags for the authenticated organization and environment.
     */
    router.get("/", async (c) => {
      const organizationId = c.get("organizationId");
      const environment = c.get("environment");

      // Build the KV key using organization ID
      const kvKey = KVKeys.flags(organizationId, environment);

      try {
        // Fetch flags from KV
        const flags = await c.env.SHIPOS_KV.get<FlagsResponse>(kvKey, "json");

        if (flags === null) {
          // Return empty object if no flags found (not an error)
          return c.json({});
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
  }
);

// Register the controller
controllerRegistry.register(flagsController);

export { flagsController };
