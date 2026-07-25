"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { DailyAreaChart } from "@/components/charts";
import { Button, Card, Chip, ErrorNote } from "@/components/ui";
import { UsageSkeleton } from "@/components/skeletons";
import { Stagger } from "@/components/stagger";
import type { ApiUsage } from "@/lib/api-types";
import { api } from "@/lib/client-api";
import { PRICING_SPEC, type PlanKey } from "@/lib/pricing-config";
import { tierForPlan, usePricingTiers } from "@/lib/use-pricing";

function formatCount(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(value % 1_000_000 === 0 ? 0 : 1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(value % 1_000 === 0 ? 0 : 1)}k`;
  return value.toLocaleString();
}

function formatUsdFromCents(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

function overageRateCents(plan: ApiUsage["plan"], tiers: ReturnType<typeof usePricingTiers>): number {
  const fromPolar = tierForPlan(tiers, plan)?.overagePerMillionCents;
  if (fromPolar != null) return fromPolar;
  const key: PlanKey = plan === "trial" ? "launch" : plan;
  return PRICING_SPEC.find((t) => t.key === key)?.overagePerMillionCents ?? 0;
}

export function UsageView() {
  const [usage, setUsage] = useState<ApiUsage | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void api<ApiUsage>("/api/v1/usage?days=30")
      .then(setUsage)
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : "Failed to load usage"),
      );
  }, []);

  const chart = useMemo(() => {
    if (!usage) return null;
    const byDay = new Map(usage.series.map((point) => [point.day.slice(0, 10), point.evaluations]));
    const days: { day: string; value: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const key = date.toISOString().slice(0, 10);
      days.push({ day: key, value: byDay.get(key) ?? 0 });
    }
    return { days };
  }, [usage]);

  if (error) return <ErrorNote message={error} />;

  return (
    <Stagger>
      <div className="mb-5 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-[20px] font-semibold tracking-[-0.01em]">Usage</h2>
          <p className="mt-1 text-[13px] text-ink-muted">
            Evaluations are the one meter. Flags, seats and environments are never counted.
          </p>
        </div>
        {usage ? (
          <Chip color={usage.billingState === "trialing" ? "orange" : "green"}>
            {usage.plan} plan{usage.billingState === "trialing" ? " (trial)" : ""}
          </Chip>
        ) : (
          <div className="h-7 w-20 animate-pulse rounded-full bg-line" />
        )}
      </div>

      {!usage || !chart ? (
        <UsageSkeleton />
      ) : (
        <UsageContent usage={usage} chart={chart} staggerSelf />
      )}
    </Stagger>
  );
}

function UsageContent({
  usage,
  chart,
  staggerFrom = 0,
  staggerSelf: _staggerSelf,
}: {
  usage: ApiUsage;
  chart: { days: { day: string; value: number }[] };
  staggerFrom?: number;
  staggerSelf?: boolean;
}) {
  const tiers = usePricingTiers();
  const included = Math.max(1, usage.includedEvalsPerMonth);
  const overageEvals = Math.max(0, usage.used - usage.includedEvalsPerMonth);
  const overLimit = overageEvals > 0;
  const pctRaw = (usage.used / included) * 100;
  const pctBar = Math.min(100, pctRaw);
  const perMillionCents = overageRateCents(usage.plan, tiers);
  const overageCents = overLimit
    ? Math.round((overageEvals / 1_000_000) * perMillionCents)
    : 0;
  const trialDaysLeft = Math.max(
    0,
    Math.ceil((new Date(usage.trialEndsAt).getTime() - Date.now()) / 86_400_000),
  );

  return (
    <Stagger from={staggerFrom} className="space-y-6">
      {usage.billingState === "trialing" ? (
        <div className="flex items-center justify-between rounded-3xl border border-line bg-surface px-6 py-4">
          <div>
            <p className="text-[14px] font-medium">
              Trial -{" "}
              <span className="text-chip-orange">
                {trialDaysLeft} day{trialDaysLeft === 1 ? "" : "s"} left
              </span>
            </p>
            <p className="mt-0.5 text-[13px] text-ink-muted">
              After that the dashboard locks until you add payment, but your flags keep serving
              either way.
            </p>
          </div>
          <Link href="/settings/billing">
            <Button size="sm">Add payment</Button>
          </Link>
        </div>
      ) : null}

      <Card className="p-6">
        <div className="mb-4 flex items-baseline justify-between">
          <h2 className="text-[16px] font-semibold">Evaluations per day</h2>
          <span className="text-[12px] text-ink-muted">last 30 days</span>
        </div>
        <DailyAreaChart
          data={chart.days}
          label="Evaluations"
          className="aspect-auto h-44 w-full"
        />
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-6">
          <h2 className="text-[16px] font-semibold">This period</h2>
          <p className="mt-3 font-mono text-[32px] font-semibold tracking-tight">
            {formatCount(usage.used)}
          </p>
          <p className="text-[13px] text-ink-muted">
            of {formatCount(usage.includedEvalsPerMonth)} included evaluations
          </p>
          <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-line">
            <div
              className={`h-full rounded-full ${overLimit || pctBar > 90 ? "bg-chip-pink" : "bg-chip-green"}`}
              style={{ width: `${Math.max(pctBar, usage.used > 0 ? 2 : 0)}%` }}
            />
          </div>
          <p className="mt-2 text-[12px] text-ink-muted">
            {overLimit ? (
              <>
                {formatCount(overageEvals)} over included
                {perMillionCents > 0 ? (
                  <>
                    {" "}
                    · {formatUsdFromCents(perMillionCents)} / additional 1M
                  </>
                ) : null}
                . Evaluations are metered, never blocked mid-cycle.
              </>
            ) : (
              <>
                {pctBar.toFixed(pctBar < 10 ? 1 : 0)}% used. Evaluations are metered, never
                blocked mid-cycle.
              </>
            )}
          </p>
          {overLimit && perMillionCents > 0 ? (
            <div className="mt-4 flex items-baseline justify-between gap-3 border-t border-line pt-4">
              <div>
                <p className="text-[13px] font-medium text-ink">
                  {usage.billingState === "trialing" ? "Est. overage bill" : "Overage this period"}
                </p>
                <p className="mt-0.5 text-[12px] text-ink-muted">
                  Billed on your {usage.plan} plan rate
                </p>
              </div>
              <p className="font-mono text-[20px] font-semibold tracking-tight text-chip-pink">
                {formatUsdFromCents(overageCents)}
              </p>
            </div>
          ) : null}
        </Card>

        <Card className="p-6">
          <h2 className="text-[16px] font-semibold">Need more headroom?</h2>
          <p className="mt-1.5 text-[13px] text-ink-muted">
            Upgrade for more projects, agent keys and included evaluations.
          </p>
          <Link href="/settings/billing" className="mt-4 block">
            <Button variant="secondary" size="sm" className="w-full">
              View plans
            </Button>
          </Link>
        </Card>
      </div>
    </Stagger>
  );
}
