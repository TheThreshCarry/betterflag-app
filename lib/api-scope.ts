/**
 * API route scope derived from the first segment after /v1/ (shared by worker permissions + tests).
 */
export function apiRouteScopeFromPath(path: string): string | null {
  const m = path.match(/^\/v1\/([^/]+)/);
  return m ? m[1] : null;
}

/**
 * Whether an API key with optional permission scopes may access this route.
 * Empty or missing permissions means full access. The controllers discovery route is always allowed.
 */
export function isApiScopeAllowed(
  path: string,
  permissions: string[] | undefined
): boolean {
  const scope = apiRouteScopeFromPath(path);
  if (!scope) return true;
  if (scope === "controllers") return true;
  if (!permissions || permissions.length === 0) return true;
  return permissions.includes(scope);
}
