/**
 * CMS Controller — KV ONLY (Phase 3 / Rule R3).
 *
 * No more Next proxy. Every read resolves from Cloudflare KV via the
 * tenant-scheme keys:
 *   - tenant_{orgId}_cms_{ctSlug}_index  → list of entries
 *   - tenant_{orgId}_cms_{ctSlug}_{entrySlug} → single entry
 *
 * Endpoints:
 *   GET /cms/entries/:contentType           → list (array of slug + metadata)
 *   GET /cms/entries/:contentType/:slug     → single entry payload
 */

import type { ApiError } from "../types";
import { KVKeys } from "../types";
import { createController, controllerRegistry } from "./index";
import { READ_CACHE_CONTROL, buildEtag } from "../lib/edge-cache";

const SLUG_RE = /^[a-zA-Z0-9_-]+$/;

type CmsIndex = {
  entries: Array<{ slug: string; title?: string; updatedAt?: string }>;
  _updatedAt?: string;
};

type CmsEntry = {
  data?: unknown;
  _updatedAt?: string;
} & Record<string, unknown>;

const cmsController = createController(
  {
    name: "cms",
    version: "v1",
    basePath: "/cms",
    description: "Headless CMS — read-only, KV-backed.",
  },
  (router) => {
    router.get("/entries/:contentType", async (c) => {
      const orgId = c.get("organizationId");
      const contentType = c.req.param("contentType");

      if (!SLUG_RE.test(contentType)) {
        const error: ApiError = {
          error: "Invalid contentType slug",
          code: "INVALID_SLUG",
        };
        return c.json(error, 400);
      }

      try {
        const blob = await c.env.SHIPOS_KV.get<CmsIndex>(
          KVKeys.cmsIndex(orgId, contentType),
          "json",
        );
        if (!blob) {
          const error: ApiError = {
            error: `No entries for content type '${contentType}'`,
            code: "NOT_FOUND",
          };
          return c.json(error, 404);
        }

        const etag = buildEtag(blob._updatedAt);
        if (etag) {
          if (c.req.header("if-none-match") === etag) {
            return new Response(null, {
              status: 304,
              headers: { "Cache-Control": READ_CACHE_CONTROL, ETag: etag },
            });
          }
          c.header("ETag", etag);
        }
        c.header("Cache-Control", READ_CACHE_CONTROL);

        return c.json({ entries: blob.entries });
      } catch (err) {
        console.error("cms: kv list error", err);
        const error: ApiError = { error: "Internal server error", code: "INTERNAL_ERROR" };
        return c.json(error, 500);
      }
    });

    router.get("/entries/:contentType/:slug", async (c) => {
      const orgId = c.get("organizationId");
      const contentType = c.req.param("contentType");
      const slug = c.req.param("slug");

      if (!SLUG_RE.test(contentType) || !SLUG_RE.test(slug)) {
        const error: ApiError = { error: "Invalid slug", code: "INVALID_SLUG" };
        return c.json(error, 400);
      }

      try {
        const blob = await c.env.SHIPOS_KV.get<CmsEntry>(
          KVKeys.cmsEntry(orgId, contentType, slug),
          "json",
        );
        if (!blob) {
          const error: ApiError = {
            error: `Entry '${slug}' not found in '${contentType}'`,
            code: "NOT_FOUND",
          };
          return c.json(error, 404);
        }

        const etag = buildEtag(blob._updatedAt);
        if (etag) {
          if (c.req.header("if-none-match") === etag) {
            return new Response(null, {
              status: 304,
              headers: { "Cache-Control": READ_CACHE_CONTROL, ETag: etag },
            });
          }
          c.header("ETag", etag);
        }
        c.header("Cache-Control", READ_CACHE_CONTROL);

        return c.json(blob);
      } catch (err) {
        console.error("cms: kv entry read error", err);
        const error: ApiError = { error: "Internal server error", code: "INTERNAL_ERROR" };
        return c.json(error, 500);
      }
    });
  },
);

controllerRegistry.register(cmsController);

export { cmsController };
