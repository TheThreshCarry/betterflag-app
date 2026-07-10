"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { Button, Card, Chip, ErrorNote } from "@/components/ui";
import { UsageSkeleton } from "@/components/skeletons";
import type { ApiUsage } from "@/lib/api-types";
import { api } from "@/lib/client-api";

function formatCount(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(value % 1_000_000 === 0 ? 0 : 1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(value % 1_000 === 0 ? 0 : 1)}k`;
  return value.toLocaleString();
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
    const days: { day: string; evaluations: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const key = date.toISOString().slice(0, 10);
      days.push({ day: key, evaluations: byDay.get(key) ?? 0 });
    }
    const max = Math.max(...days.map((d) => d.evaluations), 1);
    return { days, max };
  }, [usage]);

  if (error) return <ErrorNote message={error} />;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-[28px] font-semibold tracking-[-0.01em]">Usage</h1>
          <p className="mt-0.5 text-[14px] text-ink-muted">
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
        <div className="data-in">
          <UsageContent usage={usage} chart={chart} />
        </div>
      )}
    </div>
  );
}

function UsageContent({
  usage,
  chart,
}: {
  usage: ApiUsage;
  chart: { days: { day: string; evaluations: number }[]; max: number };
}) {
  const pctUsed = Math.min(100, (usage.used / usage.includedEvalsPerMonth) * 100);
  const trialDaysLeft = Math.max(
    0,
    Math.ceil((new Date(usage.trialEndsAt).getTime() - Date.now()) / 86_400_000),
  );
  const barWidth = 100 / 30;

  return (
    <>
      {usage.billingState === "trialing" ? (
        <div className="mb-6 flex items-center justify-between rounded-3xl border border-line bg-surface px-6 py-4">
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
          <Link href="/settings">
            <Button size="sm">Add payment</Button>
          </Link>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="p-6 lg:col-span-2">
          <div className="mb-4 flex items-baseline justify-between">
            <h2 className="text-[16px] font-semibold">Evaluations per day</h2>
            <span className="text-[12px] text-ink-muted">last 30 days</span>
          </div>
          <svg viewBox="0 0 100 40" className="h-44 w-full" preserveAspectRatio="none" role="img" aria-label="Evaluations per day bar chart">
            {chart.days.map((point, i) => {
              const height = (point.evaluations / chart.max) * 36;
              return (
                <rect
                  key={point.day}
                  x={i * barWidth + barWidth * 0.15}
                  y={40 - height}
                  width={barWidth * 0.7}
                  height={Math.max(height, point.evaluations > 0 ? 0.5 : 0)}
                  rx={0.6}
                  fill="#0067F4"
                  opacity={0.85}
                >
                  <title>
                    {point.day}: {point.evaluations.toLocaleString()} evaluations
                  </title>
                </rect>
              );
            })}
            <line x1="0" y1="40" x2="100" y2="40" stroke="#e8e4de" strokeWidth="0.4" />
          </svg>
          <div className="mt-2 flex justify-between text-[11px] text-ink-muted">
            <span>{chart.days[0]?.day}</span>
            <span>{chart.days[chart.days.length - 1]?.day}</span>
          </div>
        </Card>

        <div className="space-y-6">
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
                className={`h-full rounded-full ${pctUsed > 90 ? "bg-chip-pink" : "bg-chip-green"}`}
                style={{ width: `${Math.max(pctUsed, usage.used > 0 ? 2 : 0)}%` }}
              />
            </div>
            <p className="mt-2 text-[12px] text-ink-muted">
              {pctUsed.toFixed(pctUsed < 10 ? 1 : 0)}% used. Evaluations are metered, never blocked
              mid-cycle.
            </p>
          </Card>

          <Card className="p-6">
            <h2 className="text-[16px] font-semibold">Need more headroom?</h2>
            <p className="mt-1.5 text-[13px] text-ink-muted">
              Upgrade for more projects, agent keys and included evaluations.
            </p>
            <Link href="/settings" className="mt-4 block">
              <Button variant="secondary" size="sm" className="w-full">
                View plans
              </Button>
            </Link>
          </Card>
        </div>
      </div>
    </>
  );
}
