/**
 * Media Controller
 *
 * API key–authenticated media operations under /v1/media.
 * Internal dashboard uploads use /internal/media (service secret).
 */

import type { ApiError } from "../types";
import { createController, controllerRegistry } from "./index";
import {
  deleteMediaAssetByKey,
  serveMediaAsset,
  uploadMediaAsset,
} from "../lib/r2-media";

const mediaController = createController(
  {
    name: "media",
    version: "v1",
    basePath: "/media",
    description: "Media and asset management - upload, serve, and manage files",
  },
  (router) => {
    /**
     * POST /v1/media/upload
     * organizationId is taken from the API key context only (not from form).
     */
    router.post("/upload", async (c) => {
      try {
        const organizationId = c.get("organizationId");
        if (!organizationId) {
          return c.json(
            { error: "Organization not resolved", code: "UNAUTHORIZED" } as ApiError,
            401
          );
        }

        const formData = await c.req.formData();
        const file = formData.get("file") as File;
        const userId = (formData.get("userId") as string) || "";
        const folder = (formData.get("folder") as string) || "/";

        if (!file) {
          return c.json(
            { error: "file is required", code: "BAD_REQUEST" } as ApiError,
            400
          );
        }

        const result = await uploadMediaAsset(c.env, {
          file,
          organizationId,
          userId,
          folder,
        });

        return c.json(result);
      } catch (error) {
        console.error("Media upload error:", error);
        return c.json(
          { error: "Failed to upload file", code: "UPLOAD_FAILED" } as ApiError,
          500
        );
      }
    });

    /**
     * GET /v1/media/serve/:orgId/*
     */
    router.get("/serve/:orgId/*", async (c) => {
      try {
        const orgId = c.req.param("orgId");
        const authenticatedOrgId = c.get("organizationId");
        if (orgId !== authenticatedOrgId) {
          return c.json(
            { error: "Access denied to this organization's media", code: "FORBIDDEN" } as ApiError,
            403
          );
        }
        const restPath = c.req.param("*") || "";
        const served = await serveMediaAsset(c.env, orgId, restPath);
        if (!served) {
          return c.json(
            { error: "File not found", code: "NOT_FOUND" } as ApiError,
            404
          );
        }
        return new Response(served.body, {
          headers: {
            "Content-Type": served.contentType,
            "Cache-Control": "public, max-age=31536000, immutable",
            "Content-Disposition": served.contentDisposition,
          },
        });
      } catch (error) {
        console.error("Media serve error:", error);
        return c.json(
          { error: "Failed to retrieve file", code: "SERVE_FAILED" } as ApiError,
          500
        );
      }
    });

    /**
     * POST /v1/media/delete
     * Key must belong to the authenticated organization.
     */
    router.post("/delete", async (c) => {
      try {
        const organizationId = c.get("organizationId");
        if (!organizationId) {
          return c.json(
            { error: "Organization not resolved", code: "UNAUTHORIZED" } as ApiError,
            401
          );
        }

        const { key } = await c.req.json<{ key?: string }>();

        if (!key) {
          return c.json(
            { error: "Key is required", code: "BAD_REQUEST" } as ApiError,
            400
          );
        }

        const prefix = `media/${organizationId}/`;
        if (!key.startsWith(prefix)) {
          return c.json(
            { error: "Key does not belong to this organization", code: "FORBIDDEN" } as ApiError,
            403
          );
        }

        const result = await deleteMediaAssetByKey(c.env, key);
        if (!result.ok) {
          return c.json(
            { error: "File not found", code: "NOT_FOUND" } as ApiError,
            404
          );
        }

        return c.json({ success: true, message: "File deleted" });
      } catch (error) {
        console.error("Media delete error:", error);
        return c.json(
          { error: "Failed to delete file", code: "DELETE_FAILED" } as ApiError,
          500
        );
      }
    });
  }
);

controllerRegistry.register(mediaController);

export { mediaController };
