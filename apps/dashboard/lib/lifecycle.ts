/**
 * Client for the betterflag-lifecycle worker (welcome email sequence).
 *
 * Best-effort by design: org creation must NEVER fail because an email
 * sequence couldn't start. Unconfigured envs (local dev) log and no-op; the
 * worker itself is idempotent per org (instance id `welcome-{orgId}`).
 */
import { optionalEnv } from "@/lib/env";
import { reportServerError } from "@/lib/observability";

export interface WelcomeTrigger {
  orgId: string;
  email: string;
  orgName: string;
}

export async function triggerWelcomeSequence(input: WelcomeTrigger): Promise<void> {
  const url = optionalEnv("LIFECYCLE_URL");
  const secret = optionalEnv("LIFECYCLE_SECRET");
  if (!url || !secret) {
    console.warn("[lifecycle] LIFECYCLE_URL/SECRET unset, skipping welcome sequence");
    return;
  }

  try {
    const response = await fetch(`${url.replace(/\/$/, "")}/trigger`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
      signal: AbortSignal.timeout(5_000),
    });
    // 200 = instance already exists (fine); 201 = started.
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(`lifecycle trigger failed: ${response.status} ${detail.slice(0, 300)}`);
    }
  } catch (error) {
    console.error("[lifecycle] failed to start welcome sequence:", error);
    reportServerError("welcome sequence trigger failed", {
      org_id: input.orgId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
