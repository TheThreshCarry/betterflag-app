import { createMiddleware } from "hono/factory";
import type { AppEnv } from "../types";

/**
 * Usage Tracking Middleware
 *
 * Fires a usage event to Polar after each successful API request.
 * Uses `waitUntil` so the usage ingestion doesn't block the response.
 *
 * The event is tagged with the organization ID (used as the Polar
 * customer external ID) so billing is per-organization.
 */
export const usageMiddleware = createMiddleware<AppEnv>(async (c, next) => {
  await next();

  // Only track successful API calls (2xx responses)
  if (c.res.status < 200 || c.res.status >= 300) return;

  const organizationId = c.get("organizationId");
  if (!organizationId) return;

  const polarAccessToken = c.env.POLAR_ACCESS_TOKEN;
  if (!polarAccessToken) return;

  const polarApiBase =
    c.env.POLAR_API_BASE?.replace(/\/$/, "") || "https://api.polar.sh";

  const ctx = c.executionCtx;
  ctx.waitUntil(
    ingestUsageEvent(polarApiBase, polarAccessToken, organizationId).catch(
      (err) => {
        console.error("[Usage] Failed to ingest event:", err);
      }
    )
  );
});

/**
 * Ingest a single API call usage event to Polar.
 * Uses a direct fetch to Polar's event ingestion API for maximum
 * reliability in Cloudflare Workers (avoids SDK bundle concerns).
 */
async function ingestUsageEvent(
  polarApiBase: string,
  accessToken: string,
  organizationId: string
): Promise<void> {
  const response = await fetch(`${polarApiBase}/v1/customer-meters/events`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      events: [
        {
          name: "api-calls",
          external_customer_id: organizationId,
        },
      ],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Polar ingestion failed (${response.status}): ${body}`);
  }
}
