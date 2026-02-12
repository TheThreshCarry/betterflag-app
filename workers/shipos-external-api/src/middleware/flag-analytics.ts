import { createMiddleware } from "hono/factory";
import type { AppEnv } from "../types";
import { createClickHouseClient } from "../lib/clickhouse";

/**
 * Flag Analytics Middleware
 *
 * Intercepts responses from the flags endpoint, extracts context
 * (geo, device, SDK version), and inserts one row per flag into
 * ClickHouse asynchronously via `waitUntil`.
 *
 * Geo data comes from Cloudflare's `cf` object on the request,
 * which is free and automatic in CF Workers.
 *
 * Uses async_insert so ClickHouse batches individual inserts server-side.
 */
export const flagAnalyticsMiddleware = createMiddleware<AppEnv>(
  async (c, next) => {
    await next();

    // Only track successful flag responses
    if (c.res.status !== 200) return;

    // Don't block on analytics — clone response to read flags
    const clonedRes = c.res.clone();

    let flags: Record<string, boolean>;
    try {
      flags = await clonedRes.json();
    } catch {
      return; // Not valid JSON, skip
    }

    if (!flags || typeof flags !== "object" || Object.keys(flags).length === 0) {
      return;
    }

    // Extract Cloudflare geo data from the request
    const cf = (c.req.raw as any).cf || {};
    const requestId = crypto.randomUUID();
    const now = new Date().toISOString();

    const organizationId = c.get("organizationId");
    const environment = c.get("environment");
    const customerId = c.req.header("x-shipos-customer-id") || "";
    const userAgent = c.req.header("user-agent") || "";
    const sdkVersion = c.req.header("x-shipos-sdk-version") || "";

    // Build one row per flag
    const rows = Object.entries(flags).map(([key, value]) => ({
      organization_id: organizationId,
      environment,
      customer_id: customerId,
      flag_key: key,
      flag_value: value,
      timestamp: now,
      country: cf.country || "",
      city: cf.city || "",
      region: cf.region || "",
      continent: cf.continent || "",
      latitude: parseFloat(cf.latitude) || 0,
      longitude: parseFloat(cf.longitude) || 0,
      timezone: cf.timezone || "",
      user_agent: userAgent,
      sdk_version: sdkVersion,
      request_id: requestId,
    }));

    // Fire-and-forget: insert into ClickHouse without blocking the response
    const client = createClickHouseClient(c.env);
    c.executionCtx.waitUntil(
      client
        .insert({
          table: "feature_flag_evaluations",
          values: rows,
          format: "JSONEachRow",
        })
        .catch((err) => {
          console.error("[FlagAnalytics] Insert failed:", err);
        })
    );
  }
);
