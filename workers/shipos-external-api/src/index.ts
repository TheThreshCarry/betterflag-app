import { Hono } from "hono";
import { cors } from "hono/cors";
import type { AppEnv, Bindings } from "./types";
import { v1Routes } from "./routes/v1";

const app = new Hono<AppEnv>();

/**
 * CORS Configuration
 * Allows browser-based SDK requests from any origin
 */
app.use(
  "/*",
  cors({
    origin: "*",
    allowMethods: ["GET", "OPTIONS"],
    allowHeaders: ["Content-Type", "x-shipos-key", "x-shipos-env"],
    exposeHeaders: ["Content-Type"],
    maxAge: 86400, // 24 hours
  })
);

/**
 * Health Check Endpoint
 * GET /health
 */
app.get("/health", (c) => {
  return c.json({
    status: "healthy",
    service: "shipos-external-api",
    timestamp: new Date().toISOString(),
  });
});

/**
 * API Version 1 Routes
 * All routes under /v1 are protected by API key authentication
 */
app.route("/v1", v1Routes);

// ============================================
// Legacy Profile Picture Routes (existing)
// ============================================

// Extend type for legacy routes that use R2
type LegacyBindings = {
  Bindings: Bindings;
};

/**
 * Upload profile picture
 * POST /profile-picture/upload
 */
app.post("/profile-picture/upload", async (c) => {
  try {
    const formData = await c.req.formData();
    const file = formData.get("file") as File;
    const userId = formData.get("userId") as string;

    if (!file || !userId) {
      return c.json({ error: "File and userId are required" }, 400);
    }

    // Validate file type
    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!allowedTypes.includes(file.type)) {
      return c.json(
        { error: "Invalid file type. Only JPEG, PNG, WebP, and GIF are allowed" },
        400
      );
    }

    // Validate file size (5MB max)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      return c.json({ error: "File size exceeds 5MB limit" }, 400);
    }

    // Generate unique filename
    const fileExtension = file.name.split(".").pop();
    const timestamp = Date.now();
    const key = `profile-pictures/${userId}-${timestamp}.${fileExtension}`;

    // Upload to R2
    const arrayBuffer = await file.arrayBuffer();
    await c.env.PROFILE_PICTURES.put(key, arrayBuffer, {
      httpMetadata: {
        contentType: file.type,
      },
      customMetadata: {
        userId: userId,
        originalName: file.name,
        uploadedAt: new Date().toISOString(),
      },
    });

    // Return the public URL
    const publicUrl = `https://profile-pictures.yourdomain.com/${key}`;

    return c.json({
      success: true,
      url: publicUrl,
      key: key,
    });
  } catch (error) {
    console.error("Upload error:", error);
    return c.json({ error: "Failed to upload file" }, 500);
  }
});

/**
 * Delete profile picture
 * DELETE /profile-picture/delete
 */
app.delete("/profile-picture/delete", async (c) => {
  try {
    const { key, userId } = await c.req.json();

    if (!key || !userId) {
      return c.json({ error: "Key and userId are required" }, 400);
    }

    // Verify the file belongs to the user
    const object = await c.env.PROFILE_PICTURES.head(key);
    if (!object) {
      return c.json({ error: "File not found" }, 404);
    }

    if (object.customMetadata?.userId !== userId) {
      return c.json({ error: "Unauthorized" }, 403);
    }

    // Delete from R2
    await c.env.PROFILE_PICTURES.delete(key);

    return c.json({ success: true, message: "Profile picture deleted" });
  } catch (error) {
    console.error("Delete error:", error);
    return c.json({ error: "Failed to delete file" }, 500);
  }
});

/**
 * Get profile picture
 * GET /profile-picture/:key
 */
app.get("/profile-picture/:key", async (c) => {
  try {
    const key = c.req.param("key");
    const object = await c.env.PROFILE_PICTURES.get(key);

    if (!object) {
      return c.json({ error: "File not found" }, 404);
    }

    return new Response(object.body, {
      headers: {
        "Content-Type": object.httpMetadata?.contentType || "application/octet-stream",
        "Cache-Control": "public, max-age=31536000",
      },
    });
  } catch (error) {
    console.error("Get error:", error);
    return c.json({ error: "Failed to retrieve file" }, 500);
  }
});

export default app;
