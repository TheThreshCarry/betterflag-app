/**
 * Blogs Controller (Placeholder)
 *
 * Future implementation for blog/CMS functionality.
 * This controller will handle blog posts, categories, and content management.
 *
 * Planned Endpoints:
 * - GET /blogs - List all published blog posts
 * - GET /blogs/:slug - Get a specific blog post by slug
 * - GET /blogs/categories - List all categories
 * - GET /blogs/category/:category - Get posts by category
 */

import type { ApiError } from "../types";
import { createController, controllerRegistry } from "./index";

const blogsController = createController(
  {
    name: "blogs",
    version: "v1",
    basePath: "/blogs",
    description: "Blog/CMS management - retrieve blog posts and content (coming soon)",
  },
  (router) => {
    /**
     * GET /blogs
     * List all published blog posts
     */
    router.get("/", async (c) => {
      const error: ApiError = {
        error: "Blogs feature coming soon",
        code: "NOT_IMPLEMENTED",
      };
      return c.json(error, 501);
    });

    /**
     * GET /blogs/:slug
     * Get a specific blog post by slug
     */
    router.get("/:slug", async (c) => {
      const error: ApiError = {
        error: "Blogs feature coming soon",
        code: "NOT_IMPLEMENTED",
      };
      return c.json(error, 501);
    });
  }
);

// Controller is registered but returns 501 for all endpoints
controllerRegistry.register(blogsController);

export { blogsController };
