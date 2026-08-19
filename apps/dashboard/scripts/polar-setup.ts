/**
 * Idempotent Polar setup for Betterflag pricing.
 *
 * Creates (or reuses) in the Polar organization tied to POLAR_ACCESS_TOKEN:
 *   1. the "Flag Evaluations" usage meter (count of `evaluation` events),
 *   2. one meter-credit benefit per tier granting the included evaluations,
 *   3. the Starter / Launch / Scale subscription products, each with a fixed
 *      monthly price + a metered overage price on the meter, a 14-day trial,
 *      and rich metadata (tagline, features, limits) so Polar is the single
 *      source of truth for both the app and the landing page.
 *
 * Safe to re-run: existing objects are matched by metadata and reused.
 * Promote sandbox -> production by pointing POLAR_ACCESS_TOKEN / POLAR_SERVER
 * at production and running again. POLAR_SERVER is required (no silent sandbox).
 *
 * Run:  bun run polar:setup            (from apps/dashboard)
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { Polar } from "@polar-sh/sdk";

import {
  CURRENCY,
  EVALUATION_EVENT_NAME,
  EVALUATION_METER_NAME,
  PRICING_SPEC,
  TRIAL_DAYS,
  encodeLimit,
  unitAmountFromPerMillion,
  type PricingTier,
} from "../lib/pricing-config";

// Polar vars live in repo-root .env or apps/dashboard/.env.local. Last file wins.
function loadEnvFiles() {
  const here = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    resolve(here, "..", "..", "..", ".env"), // repo root .env
    resolve(here, "..", ".env"), // apps/dashboard/.env
    resolve(here, "..", ".env.local"), // apps/dashboard/.env.local (wins)
  ];
  // Parse files into a map with last-wins semantics (matches dotenv), so a
  // duplicated key in .env resolves to the LAST occurrence, then apply without
  // clobbering variables already present in the real process environment.
  const parsed: Record<string, string> = {};
  for (const file of candidates) {
    if (!existsSync(file)) continue;
    for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
      const idx = trimmed.indexOf("=");
      const key = trimmed.slice(0, idx).trim();
      parsed[key] = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, "");
    }
  }
  for (const [key, val] of Object.entries(parsed)) {
    if (!(key in process.env)) process.env[key] = val;
  }
}

loadEnvFiles();

const accessToken = process.env.POLAR_ACCESS_TOKEN;
const serverRaw = process.env.POLAR_SERVER;
const server: "sandbox" | "production" | undefined =
  serverRaw === "production" || serverRaw === "sandbox" ? serverRaw : undefined;

if (!accessToken) {
  console.error("✗ POLAR_ACCESS_TOKEN is not set. Add it to apps/dashboard/.env.local (or the repo .env).");
  process.exit(1);
}
if (!server) {
  console.error('✗ POLAR_SERVER must be "production" or "sandbox". Unset defaults used to hit Polar sandbox.');
  process.exit(1);
}

const polar = new Polar({ accessToken, server });

// Speakeasy list endpoints return an async page iterator; flatten to items.
async function collect<T>(
  iterator: AsyncIterable<{ result?: { items?: T[] } }>,
): Promise<T[]> {
  const out: T[] = [];
  for await (const page of iterator) out.push(...(page.result?.items ?? []));
  return out;
}

async function ensureMeter(): Promise<string> {
  const meters = await collect(await polar.meters.list({}));
  const existing = meters.find(
    (m) => m.metadata?.betterflag_meter === "evaluations" || m.name === EVALUATION_METER_NAME,
  );
  if (existing) {
    console.log(`• meter "${existing.name}" already exists → ${existing.id}`);
    return existing.id;
  }
  const meter = await polar.meters.create({
    name: EVALUATION_METER_NAME,
    filter: {
      conjunction: "and",
      clauses: [{ property: "name", operator: "eq", value: EVALUATION_EVENT_NAME }],
    },
    aggregation: { func: "count" },
    metadata: { betterflag_meter: "evaluations" },
  });
  console.log(`✓ created meter "${meter.name}" → ${meter.id}`);
  return meter.id;
}

async function ensureBenefit(tier: PricingTier, meterId: string): Promise<string> {
  const benefits = await collect(await polar.benefits.list({}));
  const existing = benefits.find((b) => {
    const plan = b.metadata?.betterflag_plan;
    const kind = b.metadata?.betterflag_kind;
    return plan === tier.key && kind === "included_evaluations";
  });
  if (existing) {
    console.log(`  • benefit for ${tier.key} already exists → ${existing.id}`);
    return existing.id;
  }
  const benefit = await polar.benefits.create({
    type: "meter_credit",
    // Polar caps benefit descriptions at 42 chars.
    description: `${tier.name}: ${tier.includedEvaluations / 1_000_000}M included evals/mo`,
    properties: {
      meterId,
      units: tier.includedEvaluations,
      rollover: false,
    },
    metadata: { betterflag_plan: tier.key, betterflag_kind: "included_evaluations" },
  });
  console.log(`  ✓ created included-evaluations benefit for ${tier.key} → ${benefit.id}`);
  return benefit.id;
}

function productMetadata(tier: PricingTier): Record<string, string | number | boolean> {
  return {
    plan_key: tier.key,
    tagline: tier.tagline,
    popular: tier.popular,
    included_evaluations: tier.includedEvaluations,
    overage_per_million_cents: tier.overagePerMillionCents,
    projects: encodeLimit(tier.projects),
    agent_keys: encodeLimit(tier.agentKeys),
    features: JSON.stringify(tier.features),
    overage_note: tier.overage,
    cta: tier.cta,
    sort: tier.sort,
  };
}

async function ensureProduct(tier: PricingTier, meterId: string, benefitId: string): Promise<string> {
  const products = await collect(await polar.products.list({}));
  const existing = products.find((p) => p.metadata?.plan_key === tier.key);

  let productId: string;
  if (existing) {
    await polar.products.update({
      id: existing.id,
      productUpdate: {
        name: tier.name,
        description: tier.tagline,
        metadata: productMetadata(tier),
      },
    });
    productId = existing.id;
    console.log(`• product "${tier.name}" already exists → ${productId} (metadata refreshed; prices left as-is)`);
  } else {
    const product = await polar.products.create({
      name: tier.name,
      description: tier.tagline,
      recurringInterval: "month",
      trialInterval: "day",
      trialIntervalCount: TRIAL_DAYS,
      metadata: productMetadata(tier),
      prices: [
        { amountType: "fixed", priceAmount: tier.priceCents, priceCurrency: CURRENCY },
        {
          amountType: "metered_unit",
          meterId,
          unitAmount: unitAmountFromPerMillion(tier.overagePerMillionCents),
          priceCurrency: CURRENCY,
        },
      ],
    });
    productId = product.id;
    console.log(
      `✓ created product "${tier.name}" → ${productId}  ($${(tier.priceCents / 100).toFixed(2)}/mo + overage)`,
    );
  }

  await polar.products.updateBenefits({
    id: productId,
    productBenefitsUpdate: { benefits: [benefitId] },
  });
  return productId;
}

async function main() {
  console.log(`\nBetterFlag · Polar pricing setup  [server: ${server}]\n`);

  const meterId = await ensureMeter();
  console.log("");

  const summary: { plan: string; productId: string }[] = [];
  for (const tier of PRICING_SPEC) {
    console.log(`Tier: ${tier.name}`);
    const benefitId = await ensureBenefit(tier, meterId);
    const productId = await ensureProduct(tier, meterId, benefitId);
    summary.push({ plan: tier.key, productId });
    console.log("");
  }

  console.log("Done. Products:");
  for (const s of summary) console.log(`  ${s.plan.padEnd(8)} ${s.productId}`);
  console.log(
    "\nPricing is now live in Polar. The app /api/pricing endpoint and the landing page read from it automatically.\n",
  );
}

main().catch((err) => {
  console.error("\n✗ Setup failed:", err?.message ?? err);
  if (err?.body) console.error(err.body);
  process.exit(1);
});
