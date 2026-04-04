import { Hono } from "hono";
import type { AppEnv } from "../../types";
import { serviceAuthMiddleware } from "../../middleware/service-auth";
import {
  deleteMediaAssetByKey,
  uploadMediaAsset,
} from "../../lib/r2-media";

/**
 * Internal media routes — Next.js app only (x-service-secret).
 * POST /internal/media/upload
 * POST /internal/media/delete
 */
const internalMediaRoutes = new Hono<AppEnv>();

internalMediaRoutes.use("/*", serviceAuthMiddleware);

internalMediaRoutes.post("/upload", async (c) => {
  try {
    const formData = await c.req.formData();
    const file = formData.get("file") as File;
    const organizationId = formData.get("organizationId") as string;
    const userId = formData.get("userId") as string;
    const folder = (formData.get("folder") as string) || "/";

    if (!file || !organizationId) {
      return c.json({ error: "File and organizationId are required" }, 400);
    }

    const result = await uploadMediaAsset(c.env, {
      file,
      organizationId,
      userId: userId || "",
      folder,
    });

    return c.json(result);
  } catch (error) {
    console.error("Internal media upload error:", error);
    return c.json({ error: "Failed to upload file" }, 500);
  }
});

internalMediaRoutes.post("/delete", async (c) => {
  try {
    const { key } = await c.req.json<{ key?: string }>();

    if (!key) {
      return c.json({ error: "Key is required" }, 400);
    }

    const result = await deleteMediaAssetByKey(c.env, key);
    if (!result.ok) {
      return c.json({ error: "File not found" }, 404);
    }

    return c.json({ success: true, message: "File deleted" });
  } catch (error) {
    console.error("Internal media delete error:", error);
    return c.json({ error: "Failed to delete file" }, 500);
  }
});

export { internalMediaRoutes };
