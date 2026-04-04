import { Hono } from "hono";
import type { AppEnv } from "../../types";
import { serviceAuthMiddleware } from "../../middleware/service-auth";
import {
  deleteProfilePicture,
  uploadProfilePicture,
} from "../../lib/r2-media";

/**
 * Internal profile picture routes — Next.js app only (x-service-secret).
 * POST /internal/profile-picture/upload
 * DELETE /internal/profile-picture/delete
 */
const internalProfileRoutes = new Hono<AppEnv>();

internalProfileRoutes.use("/*", serviceAuthMiddleware);

internalProfileRoutes.post("/upload", async (c) => {
  try {
    const formData = await c.req.formData();
    const file = formData.get("file") as File;
    const userId = formData.get("userId") as string;

    if (!file || !userId) {
      return c.json({ error: "File and userId are required" }, 400);
    }

    const publicOrigin = new URL(c.req.url).origin;
    const result = await uploadProfilePicture(c.env, {
      file,
      userId,
      publicOrigin,
    });

    if ("error" in result && result.error) {
      return c.json({ error: result.error }, result.status);
    }

    if ("success" in result && result.success) {
      return c.json({
        success: true,
        url: result.url,
        key: result.key,
      });
    }

    return c.json({ error: "Upload failed" }, 500);
  } catch (error) {
    console.error("Internal profile upload error:", error);
    return c.json({ error: "Failed to upload file" }, 500);
  }
});

internalProfileRoutes.delete("/delete", async (c) => {
  try {
    const { key, userId } = await c.req.json<{ key?: string; userId?: string }>();

    if (!key || !userId) {
      return c.json({ error: "Key and userId are required" }, 400);
    }

    const result = await deleteProfilePicture(c.env, { key, userId });
    if ("error" in result) {
      return c.json({ error: result.error }, result.status);
    }

    return c.json(result);
  } catch (error) {
    console.error("Internal profile delete error:", error);
    return c.json({ error: "Failed to delete file" }, 500);
  }
});

export { internalProfileRoutes };
