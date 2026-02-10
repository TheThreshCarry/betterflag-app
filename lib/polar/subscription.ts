/**
 * Subscription plan utilities for ShipOS billing.
 *
 * Provides plan limit definitions and helpers for checking
 * whether a user/organization is within their plan limits.
 */

// ---------------------------------------------------------------------------
// Plan definitions
// ---------------------------------------------------------------------------

export const PLAN_LIMITS = {
  free: {
    name: "Free",
    slug: "free" as const,
    apiCalls: 1_000,
    flags: 5,
    configs: 2,
    changelogs: 1,
    customers: 100,
    mediaMaxFileSize: 5 * 1024 * 1024,         // 5 MB
    mediaStorage: 100 * 1024 * 1024,            // 100 MB
  },
  pro: {
    name: "Pro",
    slug: "pro" as const,
    apiCalls: 50_000,
    flags: Infinity,
    configs: Infinity,
    changelogs: Infinity,
    customers: 10_000,
    mediaMaxFileSize: 100 * 1024 * 1024,        // 100 MB
    mediaStorage: 10 * 1024 * 1024 * 1024,      // 10 GB
  },
  team: {
    name: "Team",
    slug: "team" as const,
    apiCalls: 200_000,
    flags: Infinity,
    configs: Infinity,
    changelogs: Infinity,
    customers: 50_000,
    mediaMaxFileSize: 100 * 1024 * 1024,        // 100 MB
    mediaStorage: 50 * 1024 * 1024 * 1024,      // 50 GB
  },
} as const;

export type PlanSlug = keyof typeof PLAN_LIMITS;

export type ResourceKey = "apiCalls" | "flags" | "configs" | "changelogs" | "customers" | "mediaMaxFileSize" | "mediaStorage";

// ---------------------------------------------------------------------------
// Customer state helpers
// ---------------------------------------------------------------------------

export interface Subscription {
  id: string;
  status: string;
  productId: string;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  product?: {
    id: string;
    name: string;
  };
}

export interface CustomerState {
  customer: {
    id: string;
    email: string;
    name: string | null;
  } | null;
  subscriptions: Subscription[];
  benefits: Array<{
    id: string;
    type: string;
    description: string;
  }>;
  meters: Array<{
    id: string;
    meter: {
      id: string;
      name: string;
    };
    consumedUnits: number;
    creditedUnits: number;
    balance: number;
  }>;
}

/**
 * Detect the current plan slug from a list of active subscriptions.
 */
export function detectPlan(subscriptions: Subscription[]): PlanSlug {
  if (!subscriptions || subscriptions.length === 0) return "free";

  const active = subscriptions.find(
    (sub) => sub.status === "active" || sub.status === "trialing"
  );
  if (!active) return "free";

  const productName = active.product?.name?.toLowerCase() ?? "";
  if (productName.includes("team")) return "team";
  if (productName.includes("pro")) return "pro";

  // Fallback: any active paid subscription defaults to "pro"
  return "pro";
}

/**
 * Return the limits object for the given plan slug.
 */
export function getPlanLimits(slug: PlanSlug) {
  return PLAN_LIMITS[slug];
}

/**
 * Check whether the given usage count is within the plan limit for a resource.
 */
export function isWithinLimit(
  plan: PlanSlug,
  resource: ResourceKey,
  currentUsage: number
): boolean {
  const limit = PLAN_LIMITS[plan][resource];
  return currentUsage < limit;
}

/**
 * Return remaining quota for a resource, or `Infinity` if unlimited.
 */
export function remainingQuota(
  plan: PlanSlug,
  resource: ResourceKey,
  currentUsage: number
): number {
  const limit = PLAN_LIMITS[plan][resource];
  if (limit === Infinity) return Infinity;
  return Math.max(0, limit - currentUsage);
}

/**
 * Get a human-readable description of why a limit is reached.
 */
export function limitReachedMessage(plan: PlanSlug, resource: ResourceKey): string {
  const limit = PLAN_LIMITS[plan][resource];
  const planName = PLAN_LIMITS[plan].name;

  const resourceLabels: Record<ResourceKey, string> = {
    apiCalls: "API calls",
    flags: "feature flags",
    configs: "global configs",
    changelogs: "changelogs",
    customers: "customers",
    mediaMaxFileSize: "file upload size",
    mediaStorage: "media storage",
  };

  return `You've reached the ${resourceLabels[resource]} limit (${limit.toLocaleString()}) on the ${planName} plan. Upgrade to increase your limit.`;
}
