import { Hono } from "hono";
import { cors } from "hono/cors";
import type { AppEnv } from "./types";
import { v1Routes } from "./routes/v1";
import { kvRoutes } from "./routes/internal/kv";
import { internalMediaRoutes } from "./routes/internal/media";
import { serveMediaAsset } from "./lib/r2-media";

const app = new Hono<AppEnv>();

/**
 * CORS Configuration
 * Allows browser-based SDK requests from any origin
 */
app.use(
  "/*",
  cors({
    origin: "*",
    allowMethods: ["GET", "POST", "DELETE", "OPTIONS"],
    allowHeaders: [
      "Content-Type",
      "x-shipos-key",
      "x-shipos-env",
      "x-shipos-customer-id",
      "x-shipos-sdk-version",
    ],
    exposeHeaders: [
      "Content-Type",
      "X-RateLimit-Limit",
      "X-RateLimit-Remaining",
      "X-RateLimit-Reset",
    ],
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

/**
 * Internal Service Routes
 * /internal/kv — KV sync (Next.js server actions)
 * /internal/media — R2 media mutations (Next.js API routes only)
 * Protected by SERVICE_SECRET (not API key auth)
 */
app.route("/internal/kv", kvRoutes);
app.route("/internal/media", internalMediaRoutes);

/**
 * Serve a media asset (public URL)
 * GET /media/serve/:orgId/*
 */
app.get("/media/serve/:orgId/*", async (c) => {
  try {
    const orgId = c.req.param("orgId");
    const restPath = c.req.param("*") || "";
    const served = await serveMediaAsset(c.env, orgId, restPath);
    if (!served) {
      return c.json({ error: "File not found" }, 404);
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
    return c.json({ error: "Failed to retrieve file" }, 500);
  }
});

export default app;
