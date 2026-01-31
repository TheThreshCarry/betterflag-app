import { Hono } from "hono";
import type { AppEnv } from "../../types";
import { authMiddleware } from "../../middleware/auth";
import { flagsRoute } from "./flags";
import { configRoute } from "./config";

/**
 * V1 API Routes
 *
 * All routes under /v1 require authentication via x-shipos-key header.
 */
const v1Routes = new Hono<AppEnv>();

// Apply auth middleware to all v1 routes
v1Routes.use("/*", authMiddleware);

// Mount route handlers
v1Routes.route("/flags", flagsRoute);
v1Routes.route("/config", configRoute);

export { v1Routes };
