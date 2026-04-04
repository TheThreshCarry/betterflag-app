import { createMiddleware } from "hono/factory";
import type { AppEnv } from "../types";
import { isApiScopeAllowed } from "../../../../lib/api-scope";

/**
 * Enforces optional API key permission scopes stored in KV/DB metadata.
 * Missing, empty, or invalid permissions JSON means full access (backward compatible).
 */
export const permissionsMiddleware = createMiddleware<AppEnv>(async (c, next) => {
  const data = c.get("apiKeyData");

  if (!isApiScopeAllowed(c.req.path, data.permissions)) {
    return c.json(
      {
        error: "This API key is not allowed to access this resource",
        code: "FORBIDDEN_SCOPE",
      },
      403
    );
  }

  await next();
});
