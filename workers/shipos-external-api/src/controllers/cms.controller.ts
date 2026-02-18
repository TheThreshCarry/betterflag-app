/**
 * CMS Controller
 *
 * Headless CMS API endpoints for content management.
 * These endpoints proxy to the Next.js API routes under /api/cms/.
 *
 * Endpoints:
 * - GET /cms/content-types - List content types (filter by status=active)
 * - GET /cms/content-types/:slug - Get content type by slug
 * - GET /cms/entries - List entries (query: contentType, status, limit, offset)
 * - GET /cms/entries/:slug - Get entry by slug (scoped by contentType query)
 * - GET /cms/media/:slug - Get CMS media by slug
 */

import type { ApiError } from "../types";
import { createController, controllerRegistry } from "./index";

const cmsController = createController(
  {
    name: "cms",
    version: "v1",
    basePath: "/cms",
    description: "CMS management - retrieve content types, entries, and media",
  },
  (router) => {
    router.get("/content-types", async (c) => {
      const orgId = c.get("organizationId");
      const status = c.req.query("status") || "active";

      try {
        const url = new URL(
          "/api/cms/content-types",
          c.env.NEXT_APP_URL || "http://localhost:3000"
        );
        url.searchParams.set("status", status);
        if (orgId) url.searchParams.set("organizationId", orgId);

        const res = await fetch(url.toString());
        const data = await res.json();
        return c.json(data, res.status as 200);
      } catch {
        const error: ApiError = {
          error: "Failed to fetch content types",
          code: "INTERNAL_ERROR",
        };
        return c.json(error, 500);
      }
    });

    router.get("/content-types/:slug", async (c) => {
      const orgId = c.get("organizationId");
      const slug = c.req.param("slug");

      try {
        const url = new URL(
          `/api/cms/content-types/${slug}`,
          c.env.NEXT_APP_URL || "http://localhost:3000"
        );
        if (orgId) url.searchParams.set("organizationId", orgId);

        const res = await fetch(url.toString());
        const data = await res.json();
        return c.json(data, res.status as 200);
      } catch {
        const error: ApiError = {
          error: "Failed to fetch content type",
          code: "INTERNAL_ERROR",
        };
        return c.json(error, 500);
      }
    });

    router.get("/entries", async (c) => {
      const orgId = c.get("organizationId");
      const contentType = c.req.query("contentType");
      const status = c.req.query("status") || "published";
      const limit = c.req.query("limit") || "20";
      const offset = c.req.query("offset") || "0";

      try {
        const url = new URL(
          "/api/cms/entries",
          c.env.NEXT_APP_URL || "http://localhost:3000"
        );
        if (orgId) url.searchParams.set("organizationId", orgId);
        if (contentType) url.searchParams.set("contentType", contentType);
        url.searchParams.set("status", status);
        url.searchParams.set("limit", limit);
        url.searchParams.set("offset", offset);

        const res = await fetch(url.toString());
        const data = await res.json();
        return c.json(data, res.status as 200);
      } catch {
        const error: ApiError = {
          error: "Failed to fetch entries",
          code: "INTERNAL_ERROR",
        };
        return c.json(error, 500);
      }
    });

    router.get("/entries/:slug", async (c) => {
      const orgId = c.get("organizationId");
      const slug = c.req.param("slug");
      const contentType = c.req.query("contentType");

      try {
        const url = new URL(
          `/api/cms/entries/${slug}`,
          c.env.NEXT_APP_URL || "http://localhost:3000"
        );
        if (orgId) url.searchParams.set("organizationId", orgId);
        if (contentType) url.searchParams.set("contentType", contentType);

        const res = await fetch(url.toString());
        const data = await res.json();
        return c.json(data, res.status as 200);
      } catch {
        const error: ApiError = {
          error: "Failed to fetch entry",
          code: "INTERNAL_ERROR",
        };
        return c.json(error, 500);
      }
    });

    router.get("/media/:slug", async (c) => {
      const orgId = c.get("organizationId");
      const slug = c.req.param("slug");

      try {
        const url = new URL(
          `/api/cms/media/${slug}`,
          c.env.NEXT_APP_URL || "http://localhost:3000"
        );
        if (orgId) url.searchParams.set("organizationId", orgId);

        const res = await fetch(url.toString());
        const data = await res.json();
        return c.json(data, res.status as 200);
      } catch {
        const error: ApiError = {
          error: "Failed to fetch media",
          code: "INTERNAL_ERROR",
        };
        return c.json(error, 500);
      }
    });
  }
);

controllerRegistry.register(cmsController);

export { cmsController };
