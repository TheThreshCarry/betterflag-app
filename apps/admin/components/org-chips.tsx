import type { OrgPlan, OrgRow } from "@shipos/db";

import { Chip, type ChipColor } from "@/components/ui";

const PLAN_CHIP: Record<OrgPlan, { label: string; color: ChipColor }> = {
  trial: { label: "Trial", color: "gray" },
  starter: { label: "Starter", color: "blue" },
  launch: { label: "Launch", color: "green" },
  scale: { label: "Scale", color: "orange" },
};

export function PlanChip({ plan }: { plan: OrgPlan }) {
  const { label, color } = PLAN_CHIP[plan] ?? { label: plan, color: "gray" as ChipColor };
  return <Chip color={color}>{label}</Chip>;
}

/** Frozen wins over billing status; a healthy org shows nothing loud. */
export function OrgStatusChip({ org }: { org: OrgRow }) {
  if (org.frozen_at) return <Chip color="pink">Frozen</Chip>;
  if (org.subscription_status === "past_due") return <Chip color="orange">Past due</Chip>;
  if (org.subscription_status === "canceled") return <Chip color="gray">Canceled</Chip>;
  if (org.subscription_status === "active") return <Chip color="green">Active</Chip>;
  if (org.plan === "trial") {
    const expired = new Date(org.trial_ends_at).getTime() < Date.now();
    return <Chip color={expired ? "orange" : "blue"}>{expired ? "Trial expired" : "Trialing"}</Chip>;
  }
  return <Chip color="gray">{org.subscription_status ?? "No subscription"}</Chip>;
}
