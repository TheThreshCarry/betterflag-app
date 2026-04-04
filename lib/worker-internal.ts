/**
 * Headers for authenticated calls from the Next.js app to the Cloudflare worker
 * internal routes (KV sync, media, profile picture).
 */
export function workerServiceHeaders(
  extra?: Record<string, string>
): Record<string, string> {
  const secret = process.env.SERVICE_SECRET;
  if (!secret) {
    throw new Error("SERVICE_SECRET is not configured");
  }
  return {
    "x-service-secret": secret,
    ...extra,
  };
}
