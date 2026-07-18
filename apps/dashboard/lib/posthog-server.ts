/**
 * Server-side PostHog capture for the control plane.
 *
 * Product analytics (the onboarding funnel, etc.) is emitted from the server
 * so ad-blockers cannot drop it and every event carries a stable distinct_id
 * (the Supabase user id), which keeps funnels joinable across steps. Capture
 * is best-effort: it never throws and never blocks the request path.
 *
 * Events go straight to PostHog EU ingestion, NOT the "/dock" browser proxy.
 * The proxy only exists to dodge client-side ad-blockers; server calls are
 * never blocked, so they can hit the real ingestion host directly.
 */
import { PostHog } from "posthog-node";

import type { Actor } from "./auth";
import { optionalEnv } from "./env";

const POSTHOG_INGEST_HOST = "https://eu.i.posthog.com";

let client: PostHog | null = null;
let missingTokenWarned = false;

function getClient(): PostHog | null {
  const token = optionalEnv("NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN");
  if (!token) {
    if (!missingTokenWarned) {
      console.warn("[posthog] server capture disabled, NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN is unset");
      missingTokenWarned = true;
    }
    return null;
  }
  if (!client) {
    client = new PostHog(token, {
      host: optionalEnv("POSTHOG_HOST") ?? POSTHOG_INGEST_HOST,
      // Serverless-friendly: enqueue and send right away, then we await
      // flush() below so the event is not lost when the function freezes.
      flushAt: 1,
      flushInterval: 0,
    });
  }
  return client;
}

export interface ServerCaptureInput {
  distinctId: string;
  event: string;
  properties?: Record<string, unknown>;
  /** Group analytics, e.g. { organization: orgId }. */
  groups?: Record<string, string>;
}

/**
 * Fire a server-side product analytics event. Best-effort: swallows every
 * error so analytics can never break a control-plane mutation.
 */
export async function captureServer(input: ServerCaptureInput): Promise<void> {
  const ph = getClient();
  if (!ph) return;
  try {
    ph.capture({
      distinctId: input.distinctId,
      event: input.event,
      properties: input.properties,
      groups: input.groups,
    });
    await ph.flush();
  } catch (error) {
    console.warn(
      "[posthog] server capture failed:",
      error instanceof Error ? error.message : String(error),
    );
  }
}

/** Stable distinct_id for an authenticated actor (user id, else key prefix). */
export function distinctIdForActor(actor: Actor): string {
  return actor.type === "user" ? actor.userId : `key:${actor.keyPrefix}`;
}
