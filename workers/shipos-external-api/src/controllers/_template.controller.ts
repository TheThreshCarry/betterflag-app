/**
 * Controller Template
 *
 * Copy this file to create a new controller.
 * Replace "template" with your controller name.
 *
 * Steps:
 * 1. Copy this file to {name}.controller.ts
 * 2. Update the controller configuration (name, basePath, description)
 * 3. Implement your routes
 * 4. Import and register in controllers/index.ts or routes/v1/index.ts
 */

import type { ApiError } from "../types";
import { createController, controllerRegistry } from "./index";

/**
 * Template Controller
 *
 * Description of what this controller handles.
 *
 * Endpoints:
 * - GET / - List all items
 * - GET /:id - Get a specific item
 * - POST / - Create a new item
 * - PUT /:id - Update an item
 * - DELETE /:id - Delete an item
 */
const templateController = createController(
  {
    name: "template",
    version: "v1",
    basePath: "/template",
    description: "Template controller - replace with your description",
  },
  (router) => {
    /**
     * GET /
     * List all items
     */
    router.get("/", async (c) => {
      const organizationId = c.get("organizationId");
      const environment = c.get("environment");

      // TODO: Implement your logic here
      return c.json({
        message: "List endpoint",
        organizationId,
        environment,
      });
    });

    /**
     * GET /:id
     * Get a specific item
     */
    router.get("/:id", async (c) => {
      const id = c.req.param("id");

      // Validate ID
      if (!id) {
        const error: ApiError = {
          error: "ID is required",
          code: "MISSING_ID",
        };
        return c.json(error, 400);
      }

      // TODO: Implement your logic here
      return c.json({
        message: "Get endpoint",
        id,
      });
    });

    /**
     * POST /
     * Create a new item
     */
    router.post("/", async (c) => {
      try {
        const body = await c.req.json();

        // TODO: Validate body and implement your logic here
        return c.json(
          {
            message: "Create endpoint",
            data: body,
          },
          201
        );
      } catch {
        const error: ApiError = {
          error: "Invalid request body",
          code: "INVALID_BODY",
        };
        return c.json(error, 400);
      }
    });

    /**
     * PUT /:id
     * Update an item
     */
    router.put("/:id", async (c) => {
      const id = c.req.param("id");

      if (!id) {
        const error: ApiError = {
          error: "ID is required",
          code: "MISSING_ID",
        };
        return c.json(error, 400);
      }

      try {
        const body = await c.req.json();

        // TODO: Validate body and implement your logic here
        return c.json({
          message: "Update endpoint",
          id,
          data: body,
        });
      } catch {
        const error: ApiError = {
          error: "Invalid request body",
          code: "INVALID_BODY",
        };
        return c.json(error, 400);
      }
    });

    /**
     * DELETE /:id
     * Delete an item
     */
    router.delete("/:id", async (c) => {
      const id = c.req.param("id");

      if (!id) {
        const error: ApiError = {
          error: "ID is required",
          code: "MISSING_ID",
        };
        return c.json(error, 400);
      }

      // TODO: Implement your logic here
      return c.json({
        message: "Delete endpoint",
        id,
      });
    });
  }
);

// Register the controller (uncomment when ready)
// controllerRegistry.register(templateController);

export { templateController };
