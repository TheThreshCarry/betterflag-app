/**
 * Pure/testable pieces of the welcome sequence: the trigger contract, org
 * state reads, and the decisions between emails. `src/index.ts` (which pulls
 * in `cloudflare:workers` and can't load under plain vitest) only wires these
 * to the Workflow + Email Service bindings.
 */
import { PLAN_LIMITS } from "@shipos/db";
import { fillTemplate } from "@shipos/emails/runtime";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

// ---------------------------------------------------------------------------
// Trigger contract (zod at the boundary)
// ---------------------------------------------------------------------------

export const welcomeParamsSchema = z.object({
  orgId: z.uuid(),
  email: z.email(),
  orgName: z.string().min(1).max(120),
});

export type WelcomeParams = z.infer<typeof welcomeParamsSchema>;

export function instanceIdFor(orgId: string): string {
  return `welcome-${orgId}`;
}

export function isAuthorized(request: Request, secret: string): boolean {
  const header = request.headers.get("Authorization") ?? "";
  return secret.length > 0 && header === `Bearer ${secret}`;
}

// ---------------------------------------------------------------------------
// Org state check (between emails)
// ---------------------------------------------------------------------------

export interface SupabaseEnv {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
}

/** ClickHouse read creds (usage meter lives there, same as ingest/dashboard). */
export interface ClickhouseEnv {
  CLICKHOUSE_URL?: string;
  CLICKHOUSE_USER?: string;
  CLICKHOUSE_PASSWORD?: string;
}

/** What the workflow needs to know about an org before emailing it again. */
export interface OrgEmailState {
  exists: boolean;
  /** Raw Polar subscription status synced by shipos-webhooks (null = none). */
  subscriptionStatus: string | null;
  trialEndsAt: string | null;
}

const orgRowSchema = z.object({
  subscription_status: z.string().nullable(),
  trial_ends_at: z.string().nullable(),
});

export async function readOrgState(env: SupabaseEnv, orgId: string): Promise<OrgEmailState> {
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (input, init) => fetch(input, init) },
  });
  const result = await supabase
    .from("orgs")
    .select("subscription_status,trial_ends_at")
    .eq("id", orgId)
    .maybeSingle();
  if (result.error) throw new Error(`org query failed: ${result.error.message}`);
  if (result.data === null) return { exists: false, subscriptionStatus: null, trialEndsAt: null };
  const row = orgRowSchema.parse(result.data);
  return {
    exists: true,
    subscriptionStatus: row.subscription_status,
    trialEndsAt: row.trial_ends_at,
  };
}

/** A live subscription means upsell emails are noise, so skip them. */
export function hasActiveSubscription(state: OrgEmailState): boolean {
  return state.subscriptionStatus === "active" || state.subscriptionStatus === "trialing";
}

/** Whole days between now and the trial end, floored at 0. */
export function trialDaysLeft(trialEndsAt: string | null, now: Date = new Date()): number {
  if (trialEndsAt === null) return 0;
  const end = Date.parse(trialEndsAt);
  if (Number.isNaN(end)) return 0;
  return Math.max(0, Math.ceil((end - now.getTime()) / 86_400_000));
}

/** Human phrase for the `{{when}}` merge tag: "today" / "tomorrow" / "in N days". */
export function trialEndsWhen(daysLeft: number): string {
  const days = Math.max(daysLeft, 0);
  return days === 0 ? "today" : days === 1 ? "tomorrow" : `in ${days} days`;
}

// ---------------------------------------------------------------------------
// Usage-based tier recommendation (day-10 upsell)
// ---------------------------------------------------------------------------
//
// If, during the trial, an org's evaluation usage pro-rates to more than the
// entry tier can hold, the day-10 email offers the tier that actually fits
// (Launch, Scale, or "let's talk volume" past Scale) instead of the generic
// "plans start at ...". Usage lives in ClickHouse (evals_per_org_day), the
// same billing meter the ingest worker writes and the dashboard reads.

/** Days in the trial window we pro-rate against (mirrors TRIAL_DAYS = 14). */
export const TRIAL_WINDOW_DAYS = 14;
/** Length of a billing month, for projecting a daily rate to a monthly bill. */
const MONTH_DAYS = 30;

/**
 * Upsell tier catalog, ascending by included evaluations. Caps come from the
 * canonical `@shipos/db` PLAN_LIMITS (the same numbers billing enforces) so the
 * trigger never drifts from real pricing; name/price are display copy kept in
 * sync with apps/dashboard/lib/pricing-config.ts.
 */
export interface UpsellTier {
  key: "starter" | "launch" | "scale";
  name: string;
  price: string;
  includedEvalsPerMonth: number;
}

export const UPSELL_TIERS = [
  { key: "starter", name: "Starter", price: "$9.99", includedEvalsPerMonth: PLAN_LIMITS.starter.includedEvalsPerMonth },
  { key: "launch", name: "Launch", price: "$24.99", includedEvalsPerMonth: PLAN_LIMITS.launch.includedEvalsPerMonth },
  { key: "scale", name: "Scale", price: "$99.99", includedEvalsPerMonth: PLAN_LIMITS.scale.includedEvalsPerMonth },
] as const satisfies readonly UpsellTier[];

/** The entry tier every trial is compared against. */
const ENTRY_TIER: UpsellTier = UPSELL_TIERS[0];
/** The highest self-serve tier. */
const TOP_TIER: UpsellTier = UPSELL_TIERS[UPSELL_TIERS.length - 1] ?? UPSELL_TIERS[0];

/**
 * Worker-safe ClickHouse read (btoa auth, no Buffer). Sums an org's
 * evaluations over the trailing `days` window from the billing meter. Returns
 * null when ClickHouse is unconfigured or the query fails, so a usage read can
 * never block or break the email.
 */
export async function readTrialEvals(
  env: ClickhouseEnv,
  orgId: string,
  days: number = TRIAL_WINDOW_DAYS,
  fetchFn: typeof fetch = fetch,
): Promise<number | null> {
  if (!env.CLICKHOUSE_URL) return null;
  try {
    const url = new URL(env.CLICKHOUSE_URL);
    url.searchParams.set("param_orgId", orgId);
    url.searchParams.set("param_days", String(days));
    const res = await fetchFn(url, {
      method: "POST",
      headers: {
        Authorization: `Basic ${btoa(`${env.CLICKHOUSE_USER ?? "default"}:${env.CLICKHOUSE_PASSWORD ?? ""}`)}`,
        "Content-Type": "text/plain; charset=utf-8",
      },
      body: `SELECT sum(evaluations) AS evaluations
             FROM evals_per_org_day
             WHERE org_id = {orgId:String} AND day >= today() - {days:UInt32}
             FORMAT JSONEachRow`,
    });
    if (!res.ok) {
      console.error(`lifecycle: clickhouse usage query failed: ${res.status}`);
      return null;
    }
    const text = (await res.text()).trim();
    if (text.length === 0) return 0;
    const first = text.split("\n").find((line) => line.trim().length > 0);
    if (first === undefined) return 0;
    const parsed = z
      .object({ evaluations: z.union([z.number(), z.string()]).nullable() })
      .parse(JSON.parse(first));
    return parsed.evaluations === null ? 0 : Number(parsed.evaluations);
  } catch (error) {
    console.error("lifecycle: clickhouse usage read errored", error);
    return null;
  }
}

/**
 * Whole days of trial observed so far, clamped to [1, TRIAL_WINDOW_DAYS]. The
 * trial is TRIAL_WINDOW_DAYS long ending at `trialEndsAt`, so elapsed =
 * window - daysLeft. Clamped at 1 to avoid dividing by zero on day 0.
 */
export function trialDaysElapsed(trialEndsAt: string | null, now: Date = new Date()): number {
  const left = trialDaysLeft(trialEndsAt, now);
  const elapsed = TRIAL_WINDOW_DAYS - left;
  return Math.min(TRIAL_WINDOW_DAYS, Math.max(1, elapsed));
}

/**
 * Project observed evaluations to a 30-day month: (evals / daysObserved) * 30.
 * This is the pro-rata rate that decides which tier an org actually needs.
 */
export function projectMonthlyEvals(totalEvals: number, daysObserved: number): number {
  if (daysObserved <= 0 || totalEvals <= 0) return 0;
  return Math.round((totalEvals / daysObserved) * MONTH_DAYS);
}

export interface TierRecommendation {
  /** The tier whose included evals cover the projected monthly usage. */
  tier: UpsellTier;
  /** Projected evaluations per month at the current pace. */
  projectedMonthlyEvals: number;
  /** True when projected usage is past even the top self-serve tier. */
  exceedsTopTier: boolean;
}

/**
 * Given a projected monthly usage, return the smallest tier that fits, or the
 * top tier flagged `exceedsTopTier` when usage is past it ("Scale or even
 * more"). Returns null when the entry tier still covers it, i.e. no upsell.
 */
export function recommendTier(projectedMonthlyEvals: number): TierRecommendation | null {
  if (projectedMonthlyEvals <= ENTRY_TIER.includedEvalsPerMonth) return null;
  const fit = UPSELL_TIERS.find((t) => projectedMonthlyEvals <= t.includedEvalsPerMonth);
  if (fit === undefined) {
    return { tier: TOP_TIER, projectedMonthlyEvals, exceedsTopTier: true };
  }
  return { tier: fit, projectedMonthlyEvals, exceedsTopTier: false };
}

/** Compact evaluation count for copy: 950000 -> "950K", 7500000 -> "7.5M". */
export function formatEvals(n: number): string {
  if (n >= 1_000_000) {
    const millions = n / 1_000_000;
    return `${millions.toFixed(millions >= 10 || Number.isInteger(millions) ? 0 : 1)}M`;
  }
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return String(n);
}

/**
 * End-to-end decision for the day-10 step: read usage, pro-rate it, and return
 * a tier recommendation, or null (no ClickHouse, no usage, or entry tier still
 * fits). Never throws.
 */
export async function trialUpsellRecommendation(
  env: ClickhouseEnv,
  orgId: string,
  trialEndsAt: string | null,
  now: Date = new Date(),
  fetchFn: typeof fetch = fetch,
): Promise<TierRecommendation | null> {
  const totalEvals = await readTrialEvals(env, orgId, TRIAL_WINDOW_DAYS, fetchFn);
  if (totalEvals === null || totalEvals <= 0) return null;
  const projected = projectMonthlyEvals(totalEvals, trialDaysElapsed(trialEndsAt, now));
  return recommendTier(projected);
}

// ---------------------------------------------------------------------------
// DB-backed email templates (edited in the admin panel)
// ---------------------------------------------------------------------------

const templateRowSchema = z.object({
  subject: z.string(),
  compiled_html: z.string(),
  text: z.string(),
});

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

/**
 * Fetch a template edited in the admin panel and substitute its variables for
 * this recipient. Returns null when the template row is missing, so callers can
 * fall back to the built-in default. The worker never renders React: the admin
 * pre-compiles `compiled_html` on save via @shipos/emails.
 */
export async function fetchTemplate(
  env: SupabaseEnv,
  key: string,
  vars: Record<string, string | number | null | undefined>,
): Promise<RenderedEmail | null> {
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (input, init) => fetch(input, init) },
  });
  const result = await supabase
    .from("email_templates")
    .select("subject,compiled_html,text")
    .eq("key", key)
    .maybeSingle();
  if (result.error) throw new Error(`email_templates query failed: ${result.error.message}`);
  if (result.data === null) return null;
  const row = templateRowSchema.parse(result.data);
  return fillTemplate({ subject: row.subject, html: row.compiled_html, text: row.text }, vars);
}
