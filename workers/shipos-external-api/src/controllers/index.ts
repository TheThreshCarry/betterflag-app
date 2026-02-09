import { Hono } from "hono";
import type { AppEnv } from "../types";

/**
 * Controller Interface
 *
 * All controllers must implement this interface to be registered
 * in the controller system.
 */
export interface Controller {
  /** Unique name for the controller */
  name: string;
  /** API version this controller belongs to */
  version: string;
  /** Base path for the controller routes (e.g., "/flags", "/config") */
  basePath: string;
  /** Description of what this controller handles */
  description: string;
  /** Hono router instance with the controller's routes */
  routes: Hono<AppEnv>;
}

/**
 * Controller Registry
 *
 * Stores all registered controllers for discovery and mounting.
 */
class ControllerRegistry {
  private controllers: Map<string, Controller> = new Map();

  /**
   * Register a controller
   */
  register(controller: Controller): void {
    const key = `${controller.version}::${controller.name}`;
    if (this.controllers.has(key)) {
      console.warn(`Controller ${key} is already registered. Overwriting.`);
    }
    this.controllers.set(key, controller);
  }

  /**
   * Get all registered controllers
   */
  getAll(): Controller[] {
    return Array.from(this.controllers.values());
  }

  /**
   * Get controllers by version
   */
  getByVersion(version: string): Controller[] {
    return this.getAll().filter((c) => c.version === version);
  }

  /**
   * Get a specific controller
   */
  get(version: string, name: string): Controller | undefined {
    return this.controllers.get(`${version}::${name}`);
  }

  /**
   * Mount all controllers for a version onto a Hono app
   */
  mountVersion(app: Hono<AppEnv>, version: string): void {
    const controllers = this.getByVersion(version);
    for (const controller of controllers) {
      app.route(controller.basePath, controller.routes);
    }
  }

  /**
   * Get controller metadata for documentation/discovery
   */
  getMetadata(): Array<{
    name: string;
    version: string;
    basePath: string;
    description: string;
  }> {
    return this.getAll().map((c) => ({
      name: c.name,
      version: c.version,
      basePath: c.basePath,
      description: c.description,
    }));
  }
}

/**
 * Global controller registry instance
 */
export const controllerRegistry = new ControllerRegistry();

/**
 * Helper function to create a controller
 */
export function createController(
  config: Omit<Controller, "routes">,
  setupRoutes: (router: Hono<AppEnv>) => void
): Controller {
  const router = new Hono<AppEnv>();
  setupRoutes(router);
  return {
    ...config,
    routes: router,
  };
}
