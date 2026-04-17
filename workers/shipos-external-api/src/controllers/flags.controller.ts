import type { ApiError, FlagsResponse } from "../types";
import { KVKeys } from "../types";
import { createController, controllerRegistry } from "./index";
import { flagAnalyticsMiddleware } from "../middleware/flag-analytics";
import { READ_CACHE_CONTROL, buildEtag } from "../lib/edge-cache";

/**
 * Feature Flags Controller — KV ONLY (Phase 3 / Rule R3).
 *
 * No Postgres/Drizzle fallback here. The dashboard is the only mutation
 * surface, and every write syncs KV via withKvSync (see shipos-app Phase 2).
 * A KV miss returns `{}` and is logged; it does NOT fall back to the DB.
 *
 * Reads two schemes:
 *   1. `tenant_{orgId}_flags` (preferred; value = `{ [env]: { [key]: bool } }`)
 *   2. `v1::org_{orgId}::{env}::flags` (legacy per-env; flat `{ key: bool }`)
 */
const flagsController = createController(
  {
    name: "flags",
    version: "v1",
    basePath: "/flags",
    description:
      "Feature flags — read-only, KV-backed. Sub-20ms p50 globally.",
  },
  (router) => {
    router.use("/*", flagAnalyticsMiddleware);

    router.get("/", async (c) => {
      const organizationId = c.get("organizationId");
      const environment = c.get("environment");

      try {
        // Prefer tenant-scheme payload (all envs in one blob).
        const tenantBlob = await c.env.SHIPOS_KV.get<
          Record<string, Record<string, boolean> | string> & {
            _updatedAt?: string;
          }
        >(KVKeys.flagsTenant(organizationId), "json");

        let flags: FlagsResponse = {};
        let updatedAt: string | undefined;

        if (tenantBlob) {
          updatedAt = tenantBlob._updatedAt;
          const envBlob = tenantBlob[environment];
          if (envBlob && typeof envBlob === "object") {
            flags = envBlob as FlagsResponse;
          }
        } else {
          // Legacy per-env key.
          const legacy = await c.env.SHIPOS_KV.get<FlagsResponse>(
            KVKeys.flags(organizationId, environment),
            "json",
          );
          if (legacy) flags = legacy;
        }

        const etag = buildEtag(updatedAt);
        if (etag) {
          const ifNoneMatch = c.req.header("if-none-match");
          if (ifNoneMatch === etag) {
            return new Response(null, {
              status: 304,
              headers: { "Cache-Control": READ_CACHE_CONTROL, ETag: etag },
            });
          }
          c.header("ETag", etag);
        }
        c.header("Cache-Control", READ_CACHE_CONTROL);

        return c.json(flags);
      } catch (err) {
        console.error("flags: kv read error", err);
        const error: ApiError = {
          error: "Internal server error",
          code: "INTERNAL_ERROR",
        };
        return c.json(error, 500);
      }
    });
  },
);

controllerRegistry.register(flagsController);

export { flagsController };
