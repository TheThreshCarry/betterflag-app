/**
 * Analytics Controller (Phase 4 — Tinybird).
 *
 * Endpoints:
 *   POST /v1/analytics/events  — accept a batch of events, forward to Tinybird
 *   POST /v1/analytics/batch   — alias of /events
 */

import type { ApiError } from "../types";
import { createController, controllerRegistry } from "./index";
import { sendEvents } from "../lib/tinybird";

type IngestEvent = {
  event_type?: string;
  event_name?: string;
  session_id?: string;
  url?: string;
  referrer?: string;
  properties?: Record<string, unknown>;
  customer_id?: string;
};

const MAX_BATCH = 100;
const ALLOWED_TYPES = new Set(["pageview", "custom", "error"]);

const analyticsController = createController(
  {
    name: "analytics",
    version: "v1",
    basePath: "/analytics",
    description: "Event ingestion (Tinybird-backed).",
  },
  (router) => {
    const handler = async (c: Parameters<Parameters<typeof router.post>[1]>[0]) => {
      const organizationId = c.get("organizationId");
      const userAgent = c.req.header("user-agent") || "";
      const sdkVersion = c.req.header("x-shipos-sdk-version") || "";
      const cf =
        (c.req.raw as unknown as { cf?: Record<string, unknown> }).cf ?? {};

      let body: { events?: IngestEvent[] } | IngestEvent[];
      try {
        body = (await c.req.json()) as typeof body;
      } catch {
        const error: ApiError = {
          error: "Invalid JSON body",
          code: "INVALID_BODY",
        };
        return c.json(error, 400);
      }

      const events: IngestEvent[] = Array.isArray(body) ? body : body?.events ?? [];
      if (!Array.isArray(events) || events.length === 0) {
        const error: ApiError = {
          error: "events array is required",
          code: "INVALID_BODY",
        };
        return c.json(error, 400);
      }
      if (events.length > MAX_BATCH) {
        const error: ApiError = {
          error: `batch size exceeds ${MAX_BATCH}`,
          code: "BATCH_TOO_LARGE",
        };
        return c.json(error, 413);
      }

      const now = new Date().toISOString();
      const rows = events.map((ev) => {
        const eventType = ALLOWED_TYPES.has(ev.event_type ?? "")
          ? (ev.event_type as string)
          : "custom";
        return {
          organization_id: organizationId,
          event_type: eventType,
          event_name: ev.event_name ?? "",
          customer_id: ev.customer_id ?? c.req.header("x-shipos-customer-id") ?? "",
          session_id: ev.session_id ?? "",
          url: ev.url ?? "",
          referrer: ev.referrer ?? "",
          properties: ev.properties ? JSON.stringify(ev.properties) : "{}",
          user_agent: userAgent,
          country: (cf.country as string) || "",
          city: (cf.city as string) || "",
          timestamp: now,
          sdk_version: sdkVersion,
        };
      });

      try {
        c.executionCtx.waitUntil(sendEvents(c.env, "events", rows));
      } catch (err) {
        console.error("[analytics] waitUntil failed:", err);
      }
      return c.json({ accepted: rows.length }, 202);
    };

    router.post("/events", handler);
    router.post("/batch", handler);

    router.get("/summary", (c) => {
      const error: ApiError = {
        error: "Query via the dashboard — Tinybird Pipe endpoints.",
        code: "USE_TINYBIRD_PIPES",
      };
      return c.json(error, 410);
    });
  },
);

controllerRegistry.register(analyticsController);

export { analyticsController };
