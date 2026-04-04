import { createLogger } from "@/lib/logger";
import { polarClient } from "./index";
import type { PlanSlug } from "./subscription";

const log = createLogger("polar.org-plan");

function detectPlanSlugFromPolarState(state: {
  activeSubscriptions: Array<{ status: string; productId: string }>;
}): PlanSlug {
  const subs = state.activeSubscriptions ?? [];
  const active = subs.find(
    (s) => s.status === "active" || s.status === "trialing"
  );
  if (!active) return "free";

  const teamId = process.env.POLAR_TEAM_PRODUCT_ID;
  const proId = process.env.POLAR_PRO_PRODUCT_ID;
  if (teamId && active.productId === teamId) return "team";
  if (proId && active.productId === proId) return "pro";
  return "pro";
}

/**
 * Resolve billing plan for limits using Polar customer `external_id` (matches `user.id` at signup).
 */
export async function getPlanSlugForUser(userId: string): Promise<PlanSlug> {
  if (!process.env.POLAR_ACCESS_TOKEN) {
    return "free";
  }
  try {
    const state = await polarClient.customers.getStateExternal({
      externalId: userId,
    });
    return detectPlanSlugFromPolarState(state);
  } catch (e) {
    log.debug(
      { err: e, userId },
      "getStateExternal failed; using free tier limits"
    );
    return "free";
  }
}
