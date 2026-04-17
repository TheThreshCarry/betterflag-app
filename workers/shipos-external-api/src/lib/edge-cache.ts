/**
 * Edge cache headers for KV-backed read handlers.
 *
 * We cache at Cloudflare's layer (s-maxage) with a short browser cache
 * (max-age). KV values include `_updatedAt`; we derive a weak ETag from it.
 */
import type { Context } from "hono";

export const READ_CACHE_CONTROL = "public, max-age=30, s-maxage=60";

export function buildEtag(updatedAt?: string | null): string | null {
  if (!updatedAt) return null;
  // Workers have `btoa` globally (not Node's Buffer).
  return `W/"${btoa(updatedAt)}"`;
}

/**
 * Set edge cache headers and, if an `_updatedAt` marker is present in the
 * payload, an ETag. Short-circuits with 304 when If-None-Match matches.
 */
export function withEdgeCache<T extends Record<string, unknown>>(
  c: Context,
  payload: T,
): Response | null {
  const updatedAt =
    (payload as { _updatedAt?: string })._updatedAt ?? null;
  const etag = buildEtag(updatedAt);

  if (etag) {
    const ifNoneMatch = c.req.header("if-none-match");
    if (ifNoneMatch && ifNoneMatch === etag) {
      return new Response(null, {
        status: 304,
        headers: { "Cache-Control": READ_CACHE_CONTROL, ETag: etag },
      });
    }
    c.header("ETag", etag);
  }
  c.header("Cache-Control", READ_CACHE_CONTROL);
  return null;
}
