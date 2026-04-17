import { createMiddleware } from "hono/factory";
import type { AppEnv } from "../types";
import { sendEvents } from "../lib/tinybird";

/**
 * Flag Analytics Middleware — Tinybird variant (Phase 4).
 *
 * Intercepts successful /v1/flags responses, builds one row per flag, and
 * fire-and-forgets an NDJSON batch into the Tinybird `flag_evaluations`
 * datasource. Bypasses Supabase entirely per Rule R5.
 */
export const flagAnalyticsMiddleware = createMiddleware<AppEnv>(
  async (c, next) => {
    await next();

    if (c.res.status !== 200) return;

    const clonedRes = c.res.clone();
    let flags: Record<string, boolean>;
    try {
      flags = await clonedRes.json();
    } catch {
      return;
    }

    if (!flags || typeof flags !== "object" || Object.keys(flags).length === 0) {
      return;
    }

    const cf = (c.req.raw as unknown as { cf?: Record<string, unknown> }).cf ?? {};
    const requestId = crypto.randomUUID();
    // Tinybird DateTime64 expects ISO; JSON parser handles the "T"/"Z" fine.
    const now = new Date().toISOString();

    const organizationId = c.get("organizationId");
    const environment = c.get("environment");
    const customerId = c.req.header("x-shipos-customer-id") || "";
    const userAgent = c.req.header("user-agent") || "";
    const sdkVersion = c.req.header("x-shipos-sdk-version") || "";

    const rows = Object.entries(flags).map(([key, value]) => ({
      organization_id: organizationId,
      environment,
      customer_id: customerId,
      flag_key: key,
      flag_value: value ? 1 : 0,
      timestamp: now,
      country: (cf.country as string) || "",
      city: (cf.city as string) || "",
      region: (cf.region as string) || "",
      continent: (cf.continent as string) || "",
      latitude: parseFloat(cf.latitude as string) || 0,
      longitude: parseFloat(cf.longitude as string) || 0,
      timezone: (cf.timezone as string) || "",
      user_agent: userAgent,
      sdk_version: sdkVersion,
      request_id: requestId,
    }));

    try {
      c.executionCtx.waitUntil(sendEvents(c.env, "flag_evaluations", rows));
    } catch (err) {
      console.error("[FlagAnalytics] waitUntil failed:", err);
    }
  },
);
