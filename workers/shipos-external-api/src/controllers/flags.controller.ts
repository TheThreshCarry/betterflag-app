import type { FlagsResponse, ApiError } from "../types";
import { KVKeys } from "../types";
import { createController, controllerRegistry } from "./index";
import { flagAnalyticsMiddleware } from "../middleware/flag-analytics";
import db, { DrizzleORM } from "../../../../lib/db";
import { featureFlags as featureFlagsTable } from "../../../../lib/db/schema";

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
    // Track flag evaluations in ClickHouse (non-blocking, via waitUntil)
    router.use("/*", flagAnalyticsMiddleware);

    /**
     * GET /flags
     * Returns all feature flags for the authenticated organization and environment.
     */
    router.get("/", async (c) => {
      const organizationId = c.get("organizationId");
      const environment = c.get("environment");

      const kvKey = KVKeys.flags(organizationId, environment);

      try {
        // Fetch flags from KV
        const flags = await c.env.SHIPOS_KV.get<FlagsResponse>(kvKey, "json");

        if (flags === null) {
          const flagsInDatabase = await db.select().from(featureFlagsTable).where(DrizzleORM.and(DrizzleORM.eq(featureFlagsTable.organizationId, organizationId), DrizzleORM.eq(featureFlagsTable.environment, environment)));
          if (flagsInDatabase.length > 0) {
            // store them in KV
            await c.env.SHIPOS_KV.put(kvKey, JSON.stringify(flagsInDatabase.reduce((acc, flag) => {
              acc[flag.key] = flag.enabled ?? false;
              return acc;
            }, {} as Record<string, boolean>)));
            return c.json(flagsInDatabase.reduce((acc, flag) => {
              acc[flag.key] = flag.enabled ?? false;
              return acc;
            }, {} as Record<string, boolean>), 200);
          }
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
