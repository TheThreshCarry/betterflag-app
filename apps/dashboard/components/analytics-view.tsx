"use client";

import { ANALYTICS_RETENTION_DAYS } from "@shipos/db";
import { useEffect, useMemo, useState } from "react";

import { useApp } from "@/components/app-shell";
import { Card, Chip, EmptyState, ErrorNote } from "@/components/ui";
import { Skeleton } from "@/components/ui/skeleton";
import type { AnalyticsPeriod, ApiAnalytics } from "@/lib/api-types";
import { api } from "@/lib/client-api";

const PERIODS: { value: AnalyticsPeriod; label: string; days: number }[] = [
  { value: "24h", label: "24 hours", days: 1 },
  { value: "7d", label: "7 days", days: 7 },
  { value: "30d", label: "30 days", days: 30 },
  { value: "90d", label: "90 days", days: 90 },
];

export function formatCount(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(value % 1_000_000 === 0 ? 0 : 1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(value % 1_000 === 0 ? 0 : 1)}k`;
  return value.toLocaleString();
}

const regionNames =
  typeof Intl !== "undefined" ? new Intl.DisplayNames(["en"], { type: "region" }) : null;

export function countryName(code: string): string {
  if (!/^[A-Z]{2}$/.test(code)) return "Unknown";
  try {
    return regionNames?.of(code) ?? code;
  } catch {
    return code;
  }
}

export function countryFlag(code: string): string {
  if (!/^[A-Z]{2}$/.test(code)) return "🌐";
  return String.fromCodePoint(...[...code].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}

export function AnalyticsView() {
  const { org, activeProject, environments } = useApp();
  const [period, setPeriod] = useState<AnalyticsPeriod>("7d");
  const [envFilter, setEnvFilter] = useState<string>("all");
  const [data, setData] = useState<ApiAnalytics | null>(null);
  const [error, setError] = useState<string | null>(null);

  const retentionDays = ANALYTICS_RETENTION_DAYS[org.plan];

  useEffect(() => {
    if (!activeProject) return;
    let cancelled = false;
    setData(null);
    setError(null);
    const query = new URLSearchParams({ period, projectId: activeProject.id });
    if (envFilter !== "all") query.set("env", envFilter);
    void api<ApiAnalytics>(`/api/v1/analytics?${query.toString()}`)
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load analytics");
      });
    return () => {
      cancelled = true;
    };
  }, [activeProject, period, envFilter]);

  if (!activeProject) {
    return (
      <EmptyState
        title="No project selected"
        body="Create or select a project to see its evaluation analytics."
      />
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-[28px] font-semibold tracking-[-0.01em]">Analytics</h1>
          <p className="mt-0.5 text-[14px] text-ink-muted">
            Where and how often your flags are evaluated.
          </p>
        </div>
        <Chip color="gray">{retentionDays}-day retention</Chip>
      </div>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5" role="group" aria-label="Timeframe">
          {PERIODS.map(({ value, label, days }) => {
            const beyondRetention = days > retentionDays;
            return (
              <button
                key={value}
                type="button"
                disabled={beyondRetention}
                title={
                  beyondRetention
                    ? `Beyond your plan's ${retentionDays}-day analytics retention`
                    : undefined
                }
                onClick={() => setPeriod(value)}
                className={`h-8 rounded-lg border px-3 text-[13px] font-medium transition-colors ${
                  period === value
                    ? "border-ink bg-ink text-white"
                    : beyondRetention
                      ? "cursor-not-allowed border-line text-ink-muted/50"
                      : "border-line bg-white text-ink hover:bg-surface"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-1.5" role="group" aria-label="Environment">
          {["all", ...environments.map((env) => env.slug)].map((slug) => (
            <button
              key={slug}
              type="button"
              onClick={() => setEnvFilter(slug)}
              className={`h-8 rounded-lg border px-3 font-mono text-[12px] transition-colors ${
                envFilter === slug
                  ? "border-ink bg-ink text-white"
                  : "border-line bg-white text-ink hover:bg-surface"
              }`}
            >
              {slug === "all" ? "all envs" : slug}
            </button>
          ))}
        </div>
      </div>

      {error ? <ErrorNote message={error} /> : null}
      {/* Stable min-height so the page doesn't reflow as the view moves between
          skeleton, empty and loaded states (each has a different height). */}
      <div className="min-h-[460px]">
        {!error && !data ? <AnalyticsSkeleton /> : null}
        {!error && data ? (
          <div className="data-in">
            <AnalyticsContent data={data} />
          </div>
        ) : null}
      </div>
    </div>
  );
}

function AnalyticsContent({ data }: { data: ApiAnalytics }) {
  if (data.total === 0) {
    return (
      <EmptyState
        title="No evaluations in this period"
        body="Once your SDKs or agents evaluate flags, country and flag breakdowns show up here."
      />
    );
  }
  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="p-6 lg:col-span-2">
          <div className="mb-4 flex items-baseline justify-between">
            <h2 className="text-[16px] font-semibold">Evaluations</h2>
            <span className="text-[12px] text-ink-muted">
              {data.period === "24h" ? "hourly" : "daily"}
            </span>
          </div>
          <SeriesChart series={data.series} hourly={data.period === "24h"} />
        </Card>
        <Card className="p-6">
          <h2 className="text-[16px] font-semibold">Total</h2>
          <p className="mt-3 font-mono text-[32px] font-semibold tracking-tight">
            {formatCount(data.total)}
          </p>
          <p className="text-[13px] text-ink-muted">evaluations in the last {data.period}</p>
          <div className="mt-5 space-y-2 border-t border-line pt-4">
            {data.environments.map((row) => (
              <div key={row.env} className="flex items-center justify-between text-[13px]">
                <span className="font-mono text-[12px]">{row.env}</span>
                <span className="font-mono">{formatCount(row.evaluations)}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-6">
          <div className="mb-4 flex items-baseline justify-between">
            <h2 className="text-[16px] font-semibold">By country</h2>
            <span className="text-[12px] text-ink-muted">{data.countries.length} countries</span>
          </div>
          <CountryTable countries={data.countries} total={data.total} />
        </Card>
        <Card className="p-6">
          <div className="mb-4 flex items-baseline justify-between">
            <h2 className="text-[16px] font-semibold">Top flags</h2>
            <span className="text-[12px] text-ink-muted">by evaluations</span>
          </div>
          <RankedBars
            rows={data.flags.map((row) => ({
              key: row.flagKey,
              label: row.flagKey,
              mono: true,
              evaluations: row.evaluations,
            }))}
            total={data.total}
          />
        </Card>
      </div>
    </div>
  );
}

export function SeriesChart({
  series,
  hourly,
}: {
  series: { bucket: string; evaluations: number }[];
  hourly: boolean;
}) {
  const chart = useMemo(() => {
    const byBucket = new Map(series.map((point) => [point.bucket, point.evaluations]));
    const buckets: { bucket: string; label: string; evaluations: number }[] = [];
    const count = hourly ? 24 : Math.max(series.length, 7);
    const stepMs = hourly ? 3_600_000 : 86_400_000;
    const now = Date.now();
    for (let i = count - 1; i >= 0; i--) {
      const date = new Date(now - i * stepMs);
      const key = hourly
        ? `${date.toISOString().slice(0, 13).replace("T", " ")}:00:00`
        : date.toISOString().slice(0, 10);
      const label = hourly ? `${date.toISOString().slice(11, 13)}:00 UTC` : key;
      buckets.push({ bucket: key, label, evaluations: byBucket.get(key) ?? 0 });
    }
    const max = Math.max(...buckets.map((b) => b.evaluations), 1);
    return { buckets, max };
  }, [series, hourly]);

  const barWidth = 100 / chart.buckets.length;
  return (
    <>
      <svg
        viewBox="0 0 100 40"
        className="h-44 w-full"
        preserveAspectRatio="none"
        role="img"
        aria-label="Evaluations over time bar chart"
      >
        {chart.buckets.map((point, i) => {
          const height = (point.evaluations / chart.max) * 36;
          return (
            <rect
              key={point.bucket}
              x={i * barWidth + barWidth * 0.15}
              y={40 - height}
              width={barWidth * 0.7}
              height={Math.max(height, point.evaluations > 0 ? 0.5 : 0)}
              rx={0.6}
              fill="#0067F4"
              opacity={0.85}
            >
              <title>
                {point.label}: {point.evaluations.toLocaleString()} evaluations
              </title>
            </rect>
          );
        })}
        <line x1="0" y1="40" x2="100" y2="40" stroke="#e8e4de" strokeWidth="0.4" />
      </svg>
      <div className="mt-2 flex justify-between text-[11px] text-ink-muted">
        <span>{chart.buckets[0]?.label}</span>
        <span>{chart.buckets[chart.buckets.length - 1]?.label}</span>
      </div>
    </>
  );
}

export function CountryTable({
  countries,
  total,
}: {
  countries: { country: string; evaluations: number }[];
  total: number;
}) {
  if (countries.length === 0) {
    return <p className="py-6 text-center text-[13px] text-ink-muted">No country data yet.</p>;
  }
  return (
    <RankedBars
      rows={countries.map((row) => ({
        key: row.country,
        label: `${countryFlag(row.country)} ${countryName(row.country)}`,
        mono: false,
        evaluations: row.evaluations,
      }))}
      total={total}
    />
  );
}

function RankedBars({
  rows,
  total,
}: {
  rows: { key: string; label: string; mono: boolean; evaluations: number }[];
  total: number;
}) {
  const max = Math.max(...rows.map((row) => row.evaluations), 1);
  if (rows.length === 0) {
    return <p className="py-6 text-center text-[13px] text-ink-muted">Nothing here yet.</p>;
  }
  return (
    <div className="space-y-2.5">
      {rows.map((row) => {
        const pct = total > 0 ? (row.evaluations / total) * 100 : 0;
        return (
          <div key={row.key} className="flex items-center gap-3">
            <span
              className={`w-40 shrink-0 truncate text-[13px] ${row.mono ? "font-mono text-[12px]" : ""}`}
              title={row.label}
            >
              {row.label}
            </span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-line/60">
              <div
                className="h-full rounded-full bg-[#0067F4]/85"
                style={{ width: `${Math.max((row.evaluations / max) * 100, 1)}%` }}
              />
            </div>
            <span className="w-14 shrink-0 text-right font-mono text-[12px]">
              {formatCount(row.evaluations)}
            </span>
            <span className="w-12 shrink-0 text-right text-[12px] text-ink-muted">
              {pct < 0.1 ? "<0.1" : pct.toFixed(1)}%
            </span>
          </div>
        );
      })}
    </div>
  );
}

function AnalyticsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-3xl border border-line bg-surface p-6 lg:col-span-2">
          <Skeleton className="h-5 w-28" />
          <Skeleton className="mt-4 h-44 w-full" />
        </div>
        <div className="rounded-3xl border border-line bg-surface p-6">
          <Skeleton className="h-5 w-16" />
          <Skeleton className="mt-4 h-9 w-24" />
          <Skeleton className="mt-2 h-4 w-40" />
        </div>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="rounded-3xl border border-line bg-surface p-6">
            <Skeleton className="h-5 w-28" />
            <div className="mt-4 space-y-3">
              {Array.from({ length: 6 }).map((_, j) => (
                <Skeleton key={j} className="h-4 w-full" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
