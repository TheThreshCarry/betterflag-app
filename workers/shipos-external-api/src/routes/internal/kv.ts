import { Hono } from "hono";
import type { AppEnv } from "../../types";
import { serviceAuthMiddleware } from "../../middleware/service-auth";

/**
 * Internal KV Service Routes
 *
 * These routes are called by the Next.js app (server actions) to
 * sync data into Cloudflare KV via the worker's native KV binding,
 * instead of going through the Cloudflare REST API.
 *
 * All routes require the `x-service-secret` header.
 */
const kvRoutes = new Hono<AppEnv>();

// Protect all internal KV routes with service secret
kvRoutes.use("/*", serviceAuthMiddleware);

/**
 * PUT /internal/kv/:key
 * Write a value to KV
 *
 * Body: JSON value to store
 */
kvRoutes.put("/:key", async (c) => {
  try {
    const key = decodeURIComponent(c.req.param("key"));
    const value = await c.req.text();

    await c.env.SHIPOS_KV.put(key, value);

    return c.json({ success: true });
  } catch (error) {
    console.error("KV put error:", error);
    return c.json({ error: "Failed to write to KV" }, 500);
  }
});

/**
 * DELETE /internal/kv/:key
 * Delete a key from KV
 */
kvRoutes.delete("/:key", async (c) => {
  try {
    const key = decodeURIComponent(c.req.param("key"));

    await c.env.SHIPOS_KV.delete(key);

    return c.json({ success: true });
  } catch (error) {
    console.error("KV delete error:", error);
    return c.json({ error: "Failed to delete from KV" }, 500);
  }
});

export { kvRoutes };
