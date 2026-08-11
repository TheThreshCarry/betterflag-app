/**
 * Pure mapping from Polar products → normalized `PricingTier[]`.
 *
 * Kept free of any SDK / env / network imports so it is trivially unit-testable
 * with recorded Polar payloads. `lib/pricing.ts` fetches the products and
 * delegates the shaping to `mapPolarProductsToTiers`.
 */

import { decodeLimit, type PlanKey, type PricingTier } from "@/lib/pricing-config";

const PLAN_KEYS: readonly PlanKey[] = ["starter", "launch", "scale"];

export interface PolarPriceLike {
  amountType?: string;
  amount_type?: string;
  priceAmount?: number;
  price_amount?: number;
  priceCurrency?: string;
  price_currency?: string;
  unitAmount?: number | string;
  unit_amount?: number | string;
  isArchived?: boolean;
  is_archived?: boolean;
}

export interface PolarProductLike {
  id: string;
  name: string;
  description?: string | null;
  isArchived?: boolean;
  is_archived?: boolean;
  metadata?: Record<string, unknown>;
  prices?: PolarPriceLike[];
}

export function asString(v: unknown): string {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}

export function asNumber(v: unknown, fallback = 0): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export function asBool(v: unknown): boolean {
  return v === true || v === "true" || v === 1 || v === "1";
}

export function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2).replace(/\.00$/, "")}`;
}

export function parseFeatures(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(asString);
  if (typeof v === "string") {
    try {
      const parsed = JSON.parse(v);
      if (Array.isArray(parsed)) return parsed.map(asString);
    } catch {
      /* fall through */
    }
  }
  return [];
}

// Tolerate both camelCase (SDK-parsed) and snake_case (raw API) payloads.
function priceAmountType(p: PolarPriceLike): string {
  return asString(p.amountType ?? p.amount_type);
}
function priceFixedAmount(p: PolarPriceLike): number {
  return asNumber(p.priceAmount ?? p.price_amount, 0);
}
function priceCurrency(p: PolarPriceLike): string {
  return asString(p.priceCurrency ?? p.price_currency) || "usd";
}
function priceUnitAmount(p: PolarPriceLike): number {
  return asNumber(p.unitAmount ?? p.unit_amount, 0);
}
function productArchived(p: PolarProductLike): boolean {
  return Boolean(p.isArchived ?? p.is_archived);
}

/** Map a single Polar product to a tier, or null if it isn't a Betterflag tier. */
export function mapPolarProductToTier(product: PolarProductLike): PricingTier | null {
  const meta = product.metadata ?? {};
  const key = asString(meta.plan_key) as PlanKey;
  if (!PLAN_KEYS.includes(key)) return null;
  if (productArchived(product)) return null;

  const prices = product.prices ?? [];
  const fixed = prices.find((pr) => priceAmountType(pr) === "fixed");
  const metered = prices.find((pr) => priceAmountType(pr) === "metered_unit");

  const priceCents = fixed ? priceFixedAmount(fixed) : 0;
  const currency = fixed ? priceCurrency(fixed) : "usd";
  const overagePerMillionCents = meta.overage_per_million_cents
    ? asNumber(meta.overage_per_million_cents)
    : metered
      ? Math.round(priceUnitAmount(metered) * 1_000_000)
      : 0;

  return {
    key,
    name: product.name,
    tagline: asString(meta.tagline) || asString(product.description),
    popular: asBool(meta.popular),
    priceCents,
    currency,
    price: formatPrice(priceCents),
    period: "/mo",
    includedEvaluations: asNumber(meta.included_evaluations),
    overagePerMillionCents,
    overage:
      asString(meta.overage_note) ||
      `${formatPrice(overagePerMillionCents)} per additional 1M evaluations.`,
    projects: decodeLimit(asNumber(meta.projects, -1)),
    agentKeys: decodeLimit(asNumber(meta.agent_keys, -1)),
    features: parseFeatures(meta.features),
    cta: asString(meta.cta) || "Start 14-day trial",
    sort: asNumber(meta.sort, 99),
    productId: product.id,
  };
}

/** Map + sort a list of Polar products into Betterflag tiers. */
export function mapPolarProductsToTiers(products: PolarProductLike[]): PricingTier[] {
  const tiers: PricingTier[] = [];
  for (const product of products) {
    const tier = mapPolarProductToTier(product);
    if (tier) tiers.push(tier);
  }
  tiers.sort((a, b) => a.sort - b.sort || a.priceCents - b.priceCents);
  return tiers;
}
