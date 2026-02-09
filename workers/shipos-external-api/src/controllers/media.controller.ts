/**
 * Media Controller (Placeholder)
 *
 * Future implementation for media and asset management.
 * This controller will handle file uploads, image processing, and asset delivery.
 *
 * Planned Endpoints:
 * - POST /media/upload - Upload a file
 * - GET /media/:id - Get a media asset
 * - GET /media - List all media assets
 * - DELETE /media/:id - Delete a media asset
 * - POST /media/:id/transform - Transform an image (resize, crop, etc.)
 */

import type { ApiError } from "../types";
import { createController, controllerRegistry } from "./index";

const mediaController = createController(
  {
    name: "media",
    version: "v1",
    basePath: "/media",
    description: "Media and asset management - upload and manage files (coming soon)",
  },
  (router) => {
    /**
     * GET /media
     * List all media assets
     */
    router.get("/", async (c) => {
      const error: ApiError = {
        error: "Media feature coming soon",
        code: "NOT_IMPLEMENTED",
      };
      return c.json(error, 501);
    });

    /**
     * POST /media/upload
     * Upload a file
     */
    router.post("/upload", async (c) => {
      const error: ApiError = {
        error: "Media feature coming soon",
        code: "NOT_IMPLEMENTED",
      };
      return c.json(error, 501);
    });

    /**
     * GET /media/:id
     * Get a media asset
     */
    router.get("/:id", async (c) => {
      const error: ApiError = {
        error: "Media feature coming soon",
        code: "NOT_IMPLEMENTED",
      };
      return c.json(error, 501);
    });

    /**
     * DELETE /media/:id
     * Delete a media asset
     */
    router.delete("/:id", async (c) => {
      const error: ApiError = {
        error: "Media feature coming soon",
        code: "NOT_IMPLEMENTED",
      };
      return c.json(error, 501);
    });
  }
);

// Controller is registered but returns 501 for all endpoints
controllerRegistry.register(mediaController);

export { mediaController };
