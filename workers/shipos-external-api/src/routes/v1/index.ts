import { Hono } from "hono";
import type { AppEnv } from "../../types";
import { authMiddleware } from "../../middleware/auth";
import { usageMiddleware } from "../../middleware/usage";
import { controllerRegistry } from "../../controllers";

// Import controllers to register them
import "../../controllers/flags.controller";
import "../../controllers/config.controller";
import "../../controllers/customers.controller";
// Placeholder controllers for future features
import "../../controllers/blogs.controller";
import "../../controllers/emails.controller";
import "../../controllers/analytics.controller";
import "../../controllers/media.controller";

/**
 * V1 API Routes
 *
 * All routes under /v1 require authentication via x-shipos-key header.
 * Controllers are automatically mounted from the controller registry.
 */
const v1Routes = new Hono<AppEnv>();

// Apply auth middleware to all v1 routes
v1Routes.use("/*", authMiddleware);

// Track API usage for billing (runs after response, non-blocking)
v1Routes.use("/*", usageMiddleware);

// Mount all v1 controllers from the registry
controllerRegistry.mountVersion(v1Routes, "v1");

/**
 * GET /v1/controllers
 * Returns metadata about all registered v1 controllers (for discovery)
 */
v1Routes.get("/controllers", (c) => {
  const controllers = controllerRegistry.getByVersion("v1");
  return c.json({
    version: "v1",
    controllers: controllers.map((ctrl) => ({
      name: ctrl.name,
      basePath: ctrl.basePath,
      description: ctrl.description,
    })),
  });
});

export { v1Routes };
