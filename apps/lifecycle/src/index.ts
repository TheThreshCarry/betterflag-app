/**
 * ShipOS lifecycle worker: the welcome email sequence, built on Cloudflare
 * Workflows + Cloudflare Email Service (native `send_email` binding).
 *
 * One workflow instance per org (id `welcome-{orgId}`, so re-triggering is
 * naturally idempotent):
 *
 *   day 0  → welcome email (right after org creation)
 *   day 3  → agentic setup email (MCP server, agent keys)
 *   day 10 → trial-ending email, SKIPPED when the org already has an active
 *            Polar subscription (or was deleted)
 *
 * Before each post-day-0 email the workflow re-reads the org from Supabase so
 * a deleted org or a subscribed customer never gets an irrelevant email.
 *
 * Trigger: the dashboard POSTs { orgId, email, orgName } to /trigger with
 * `Authorization: Bearer LIFECYCLE_SECRET` right after org creation (see
 * apps/dashboard /api/v1/orgs POST). Contract pinned in docs/CONTRACTS.md.
 *
 * Pure logic (contract, org checks, decisions) lives in src/sequence.ts and
 * templates in src/emails.ts, both unit-tested without the Workers runtime.
 */
import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from "cloudflare:workers";
import { formatRelease, readObservability } from "@shipos/observability";

import {
  agenticEmail,
  trialEndingEmail,
  trialEndingUpsellEmail,
  welcomeEmail,
  FROM_ADDRESS,
  type EmailContent,
} from "./emails";
import {
  fetchTemplate,
  hasActiveSubscription,
  instanceIdFor,
  isAuthorized,
  readOrgState,
  trialDaysLeft,
  trialEndsWhen,
  trialUpsellRecommendation,
  welcomeParamsSchema,
  type ClickhouseEnv,
  type SupabaseEnv,
  type WelcomeParams,
} from "./sequence";
import { VERSION } from "./version.gen";

export * from "./sequence";

// ---------------------------------------------------------------------------
// Environment
// ---------------------------------------------------------------------------

export interface LifecycleEnv {
  WELCOME_SEQUENCE: Workflow<WelcomeParams>;
  EMAIL: SendEmail;
  /** Shared secret for /trigger, `wrangler secret put LIFECYCLE_SECRET`. */
  LIFECYCLE_SECRET: string;
  SUPABASE_URL: string;
  /** Secret, `wrangler secret put SUPABASE_SERVICE_ROLE_KEY`. */
  SUPABASE_SERVICE_ROLE_KEY: string;
  /** ClickHouse usage meter (read-only) for the day-10 tier upsell. Optional:
   *  when unset the day-10 email falls back to the generic trial-ending copy. */
  CLICKHOUSE_URL?: string;
  CLICKHOUSE_USER?: string;
  /** Secret, `wrangler secret put CLICKHOUSE_PASSWORD`. */
  CLICKHOUSE_PASSWORD?: string;
  BETTER_STACK_SOURCE_TOKEN?: string;
  BETTER_STACK_LOGS_ENDPOINT?: string;
  OTEL_EXPORTER_OTLP_ENDPOINT?: string;
  OTEL_EXPORTER_OTLP_HEADERS?: string;
  SHIPOS_ENV?: string;
  SHIPOS_GIT_SHA?: string;
  SHIPOS_RELEASE?: string;
}

// ---------------------------------------------------------------------------
// The workflow
// ---------------------------------------------------------------------------

/**
 * Prefer the admin-edited template from the DB; fall back to the built-in
 * default if it's missing or the lookup fails, so email always goes out even
 * if the email_templates row was deleted or Supabase hiccups.
 */
async function resolveEmail(
  env: SupabaseEnv,
  key: string,
  vars: Record<string, string | number | null | undefined>,
  fallback: EmailContent,
): Promise<EmailContent> {
  try {
    const fromDb = await fetchTemplate(env, key, vars);
    if (fromDb) return fromDb;
  } catch (error) {
    console.error(`lifecycle: template "${key}" lookup failed, using default`, error);
  }
  return fallback;
}

async function send(email: SendEmail, to: string, content: EmailContent): Promise<string> {
  const result = await email.send({
    to,
    from: { email: FROM_ADDRESS.email, name: FROM_ADDRESS.name },
    replyTo: FROM_ADDRESS.email,
    subject: content.subject,
    html: content.html,
    text: content.text,
  });
  return result.messageId ?? "unknown";
}

export class WelcomeSequence extends WorkflowEntrypoint<LifecycleEnv, WelcomeParams> {
  override async run(
    event: Readonly<WorkflowEvent<WelcomeParams>>,
    step: WorkflowStep,
  ): Promise<void> {
    // Re-validate: params crossed a serialization boundary.
    const params = welcomeParamsSchema.parse(event.payload);

    // Day 0 - welcome.
    await step.do("send welcome email", async () => {
      const content = await resolveEmail(
        this.env,
        "welcome",
        { orgName: params.orgName },
        welcomeEmail(params.orgName),
      );
      return await send(this.env.EMAIL, params.email, content);
    });

    await step.sleep("wait until day 3", "3 days");

    // Day 3 - agentic setup, only if the org still exists.
    const day3 = await step.do("read org state (day 3)", async () => {
      return await readOrgState(this.env, params.orgId);
    });
    if (!day3.exists) return;
    await step.do("send agentic setup email", async () => {
      const content = await resolveEmail(this.env, "agentic", {}, agenticEmail());
      return await send(this.env.EMAIL, params.email, content);
    });

    await step.sleep("wait until day 10", "7 days");

    // Day 10 - trial ending, skipped for subscribed (or deleted) orgs.
    const day10 = await step.do("read org state (day 10)", async () => {
      return await readOrgState(this.env, params.orgId);
    });
    if (!day10.exists || hasActiveSubscription(day10)) return;

    // If trial usage pro-rates past the Starter tier, offer the tier that
    // actually fits (Launch/Scale/volume) instead of the generic copy. A null
    // recommendation (no ClickHouse, no usage, or Starter still fits) falls
    // back to the standard trial-ending email.
    const upsell = await step.do("read trial usage (day 10)", async () => {
      return await trialUpsellRecommendation(this.env, params.orgId, day10.trialEndsAt);
    });

    await step.do("send trial-ending email", async () => {
      const daysLeft = trialDaysLeft(day10.trialEndsAt);
      // The upsell variant's copy branches on usage (named tier vs. "past
      // Scale"), which a static admin merge-template can't express, so it's
      // code-managed and sent directly. The generic path stays admin-editable.
      if (upsell) {
        return await send(this.env.EMAIL, params.email, trialEndingUpsellEmail(daysLeft, upsell));
      }
      const content = await resolveEmail(
        this.env,
        "trial-ending",
        { when: trialEndsWhen(daysLeft) },
        trialEndingEmail(daysLeft),
      );
      return await send(this.env.EMAIL, params.email, content);
    });
  }
}

// ---------------------------------------------------------------------------
// HTTP trigger
// ---------------------------------------------------------------------------

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const handler = {
  async fetch(request, env, ctx): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/health") {
      return new Response("ok", { status: 200 });
    }
    if (request.method !== "POST" || url.pathname !== "/trigger") {
      return json(404, {
        error: { code: "not_found", message: `No route for ${request.method} ${url.pathname}` },
      });
    }

    const obs = readObservability(env as unknown as Record<string, unknown>, "shipos-lifecycle", {
      environment: env.SHIPOS_ENV,
      release: formatRelease({ version: VERSION, gitSha: env.SHIPOS_GIT_SHA, override: env.SHIPOS_RELEASE }),
    });

    try {
      if (!isAuthorized(request, env.LIFECYCLE_SECRET)) {
        obs.logger.warn("trigger: unauthorized", { status: 401 });
        return json(401, {
          error: { code: "unauthorized", message: "A valid bearer secret is required." },
        });
      }

      let raw: unknown;
      try {
        raw = await request.json();
      } catch {
        return json(400, { error: { code: "invalid_request", message: "Body must be valid JSON." } });
      }
      const parsed = welcomeParamsSchema.safeParse(raw);
      if (!parsed.success) {
        return json(422, { error: { code: "invalid_request", message: parsed.error.message } });
      }

      try {
        const instance = await env.WELCOME_SEQUENCE.create({
          id: instanceIdFor(parsed.data.orgId),
          params: parsed.data,
        });
        obs.logger.info("welcome sequence started", {
          org_id: parsed.data.orgId,
          instance_id: instance.id,
        });
        return json(201, { started: true, instanceId: instance.id });
      } catch (error) {
        // A duplicate id means the sequence already ran/is running, which is fine.
        const message = error instanceof Error ? error.message : String(error);
        if (/already exists|instance.*exists/i.test(message)) {
          obs.logger.info("welcome sequence already exists", { org_id: parsed.data.orgId });
          return json(200, { started: false, reason: "already_exists" });
        }
        throw error;
      }
    } catch (error) {
      const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
      obs.logger.error("trigger failed", { error: message });
      return json(500, { error: { code: "internal_error", message: "Something went wrong" } });
    } finally {
      ctx.waitUntil(obs.flush());
    }
  },
} satisfies ExportedHandler<LifecycleEnv>;

export default handler;
