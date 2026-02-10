/**
 * Media Controller
 *
 * Handles file uploads, serving, and deletion for media assets.
 * Files are stored in Cloudflare R2 and served with proper headers.
 *
 * Endpoints:
 * - POST /media/upload - Upload a file to R2
 * - GET  /media/serve/:orgId/* - Serve a media asset (public URL)
 * - DELETE /media/:key - Delete a media asset from R2
 */

import type { ApiError } from "../types";
import { createController, controllerRegistry } from "./index";

const mediaController = createController(
  {
    name: "media",
    version: "v1",
    basePath: "/media",
    description: "Media and asset management - upload, serve, and manage files",
  },
  (router) => {
    /**
     * POST /media/upload
     * Upload a file to R2.
     * Expects multipart/form-data with: file, organizationId, userId, folder
     */
    router.post("/upload", async (c) => {
      try {
        const formData = await c.req.formData();
        const file = formData.get("file") as File;
        const organizationId = formData.get("organizationId") as string;
        const userId = formData.get("userId") as string;
        const folder = (formData.get("folder") as string) || "/";

        if (!file || !organizationId) {
          return c.json(
            { error: "File and organizationId are required", code: "BAD_REQUEST" } as ApiError,
            400
          );
        }

        // Generate unique filename preserving original extension
        const fileExtension = file.name.split(".").pop() || "bin";
        const uniqueId = crypto.randomUUID();

        // Build R2 key mirroring folder structure
        // folder is like "/" or "/marketing/logos/"
        const folderPath = folder === "/" ? "" : folder.slice(1); // remove leading slash
        const key = `media/${organizationId}/${folderPath}${uniqueId}.${fileExtension}`;

        // Upload to R2
        const arrayBuffer = await file.arrayBuffer();
        await c.env.MEDIA_ASSETS.put(key, arrayBuffer, {
          httpMetadata: {
            contentType: file.type || "application/octet-stream",
          },
          customMetadata: {
            organizationId,
            userId: userId || "",
            originalName: file.name,
            folder,
            uploadedAt: new Date().toISOString(),
          },
        });

        return c.json({
          success: true,
          key,
          name: file.name,
          size: file.size,
          mimeType: file.type || "application/octet-stream",
        });
      } catch (error) {
        console.error("Media upload error:", error);
        return c.json(
          { error: "Failed to upload file", code: "UPLOAD_FAILED" } as ApiError,
          500
        );
      }
    });

    /**
     * GET /media/serve/:orgId/*
     * Serve a media asset from R2 by its full key path.
     * This is the public-facing endpoint for media URLs.
     */
    router.get("/serve/:orgId/*", async (c) => {
      try {
        const orgId = c.req.param("orgId");
        const restPath = c.req.param("*") || "";
        const key = `media/${orgId}/${restPath}`;

        const object = await c.env.MEDIA_ASSETS.get(key);

        if (!object) {
          return c.json(
            { error: "File not found", code: "NOT_FOUND" } as ApiError,
            404
          );
        }

        const contentType = object.httpMetadata?.contentType || "application/octet-stream";
        const isInline = contentType.startsWith("image/") || contentType.startsWith("video/");

        return new Response(object.body, {
          headers: {
            "Content-Type": contentType,
            "Cache-Control": "public, max-age=31536000, immutable",
            "Content-Disposition": isInline ? "inline" : `attachment; filename="${object.customMetadata?.originalName || "download"}"`,
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
     * DELETE /media/delete
     * Delete a media asset from R2 by its key.
     * Called internally by the Next.js API.
     */
    router.post("/delete", async (c) => {
      try {
        const { key } = await c.req.json();

        if (!key) {
          return c.json(
            { error: "Key is required", code: "BAD_REQUEST" } as ApiError,
            400
          );
        }

        // Verify the object exists
        const object = await c.env.MEDIA_ASSETS.head(key);
        if (!object) {
          return c.json(
            { error: "File not found", code: "NOT_FOUND" } as ApiError,
            404
          );
        }

        await c.env.MEDIA_ASSETS.delete(key);

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
