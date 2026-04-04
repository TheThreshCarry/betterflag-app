import { Hono } from "hono";
import type { AppEnv } from "../../types";
import { authMiddleware } from "../../middleware/auth";
import { permissionsMiddleware } from "../../middleware/permissions";
import { rateLimitMiddleware } from "../../middleware/rate-limit";
import { usageMiddleware } from "../../middleware/usage";
import { controllerRegistry } from "../../controllers";

// Import controllers to register them
import "../../controllers/flags.controller";
import "../../controllers/config.controller";
import "../../controllers/customers.controller";
// Placeholder controllers for future features
import "../../controllers/cms.controller";
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

v1Routes.use("/*", authMiddleware);
v1Routes.use("/*", permissionsMiddleware);
v1Routes.use("/*", rateLimitMiddleware);
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
