/**
 * Emails Controller (Placeholder)
 *
 * Future implementation for email functionality.
 * This controller will handle email sending, templates, and tracking.
 *
 * Planned Endpoints:
 * - POST /emails/send - Send an email using a template
 * - GET /emails/templates - List available email templates
 * - GET /emails/templates/:id - Get a specific template
 * - POST /emails/track - Track email events (opens, clicks)
 */

import type { ApiError } from "../types";
import { createController, controllerRegistry } from "./index";

const emailsController = createController(
  {
    name: "emails",
    version: "v1",
    basePath: "/emails",
    description: "Email management - send emails and manage templates (coming soon)",
  },
  (router) => {
    /**
     * POST /emails/send
     * Send an email using a template
     */
    router.post("/send", async (c) => {
      const error: ApiError = {
        error: "Emails feature coming soon",
        code: "NOT_IMPLEMENTED",
      };
      return c.json(error, 501);
    });

    /**
     * GET /emails/templates
     * List available email templates
     */
    router.get("/templates", async (c) => {
      const error: ApiError = {
        error: "Emails feature coming soon",
        code: "NOT_IMPLEMENTED",
      };
      return c.json(error, 501);
    });

    /**
     * GET /emails/templates/:id
     * Get a specific template
     */
    router.get("/templates/:id", async (c) => {
      const error: ApiError = {
        error: "Emails feature coming soon",
        code: "NOT_IMPLEMENTED",
      };
      return c.json(error, 501);
    });
  }
);

// Controller is registered but returns 501 for all endpoints
controllerRegistry.register(emailsController);

export { emailsController };
