import type { ApiError, ConfigResponse } from "../types";
import { KVKeys } from "../types";
import { createController, controllerRegistry } from "./index";
import { READ_CACHE_CONTROL, buildEtag } from "../lib/edge-cache";

/**
 * Global Config Controller — KV ONLY (Phase 3 / Rule R3).
 *
 * Reads two schemes:
 *   1. `tenant_{orgId}_config_{slug}` (preferred; value = `{ data, _updatedAt }`)
 *   2. `v1::org_{orgId}::{env}::config::{slug}` (legacy per-env)
 */
const configController = createController(
  {
    name: "config",
    version: "v1",
    basePath: "/config",
    description: "Global configuration — read-only, KV-backed.",
  },
  (router) => {
    router.get("/:slug", async (c) => {
      const organizationId = c.get("organizationId");
      const environment = c.get("environment");
      const slug = c.req.param("slug");

      if (!slug || slug.trim() === "") {
        const error: ApiError = {
          error: "Config slug is required",
          code: "MISSING_SLUG",
        };
        return c.json(error, 400);
      }

      const slugPattern = /^[a-zA-Z0-9_-]+$/;
      if (!slugPattern.test(slug)) {
        const error: ApiError = {
          error: "Invalid config slug format",
          code: "INVALID_SLUG",
        };
        return c.json(error, 400);
      }

      try {
        const tenantBlob = await c.env.SHIPOS_KV.get<
          { data?: ConfigResponse; _updatedAt?: string } | null
        >(KVKeys.configTenant(organizationId, slug), "json");

        let config: ConfigResponse | null = null;
        let updatedAt: string | undefined;

        if (tenantBlob) {
          config = tenantBlob.data ?? null;
          updatedAt = tenantBlob._updatedAt;
        } else {
          const legacy = await c.env.SHIPOS_KV.get<ConfigResponse>(
            KVKeys.config(organizationId, environment, slug),
            "json",
          );
          if (legacy) config = legacy;
        }

        if (config === null) {
          const error: ApiError = {
            error: `Config '${slug}' not found`,
            code: "CONFIG_NOT_FOUND",
          };
          return c.json(error, 404);
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

        return c.json(config);
      } catch (err) {
        console.error("config: kv read error", err);
        const error: ApiError = {
          error: "Internal server error",
          code: "INTERNAL_ERROR",
        };
        return c.json(error, 500);
      }
    });
  },
);

controllerRegistry.register(configController);

export { configController };
