"use client";

/**
 * Chart building blocks on shadcn/ui + Recharts (ui.shadcn.com/charts).
 * Prefer Area for time series. Single-series charts omit a legend box —
 * card title names the series; tooltip gives exact values.
 */

import { useId } from "react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";

import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

const AXIS_TICK = { fontSize: 11 } as const;

function formatCount(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(value % 1_000_000 === 0 ? 0 : 1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(value % 1_000 === 0 ? 0 : 1)}k`;
  return value.toLocaleString();
}

function formatDayLabel(day: string): string {
  const iso = day.includes("T") || day.includes(" ") ? day : `${day}T00:00:00Z`;
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

/** Single-series soft area — default for evaluations / usage over time. */
export function SeriesAreaChart({
  data,
  label = "Evaluations",
  color = "var(--chart-1)",
  className = "h-44 w-full",
  xKey = "label",
  yKey = "value",
}: {
  data: Record<string, string | number>[];
  label?: string;
  color?: string;
  className?: string;
  xKey?: string;
  yKey?: string;
}) {
  const gradientId = useId().replace(/:/g, "");
  const config: ChartConfig = {
    [yKey]: { label, color },
  };

  return (
    <ChartContainer config={config} className={className}>
      <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={`var(--color-${yKey})`} stopOpacity={0.25} />
            <stop offset="95%" stopColor={`var(--color-${yKey})`} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke="var(--color-line)" />
        <XAxis
          dataKey={xKey}
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          minTickGap={28}
          tick={AXIS_TICK}
        />
        <YAxis
          allowDecimals={false}
          tickLine={false}
          axisLine={false}
          width={42}
          tick={AXIS_TICK}
          tickFormatter={(value: number) => formatCount(value)}
        />
        <ChartTooltip
          cursor={{ stroke: "var(--color-line-strong)" }}
          content={<ChartTooltipContent />}
        />
        <Area
          dataKey={yKey}
          type="natural"
          stroke={`var(--color-${yKey})`}
          strokeWidth={2}
          fill={`url(#${gradientId})`}
          dot={false}
          activeDot={{ r: 4 }}
        />
      </AreaChart>
    </ChartContainer>
  );
}

/** Daily points shaped `{ day, value }` → area chart with short day labels. */
export function DailyAreaChart({
  data,
  label = "Evaluations",
  color = "var(--chart-1)",
  className = "h-44 w-full",
}: {
  data: { day: string; value: number }[];
  label?: string;
  color?: string;
  className?: string;
}) {
  const points = data.map((point) => ({
    label: formatDayLabel(point.day),
    value: point.value,
    day: point.day,
  }));
  return (
    <SeriesAreaChart data={points} label={label} color={color} className={className} />
  );
}

const SERIES_COLORS = [
  "var(--chart-1)",
  "var(--chart-5)",
  "var(--chart-3)",
  "var(--chart-2)",
  "var(--chart-4)",
] as const;

/** Stacked area for multi-series time buckets (e.g. flag variations). */
export function StackedAreaChart({
  data,
  series,
  className = "h-40 w-full",
  showLegend = true,
}: {
  data: Record<string, string | number>[];
  series: { key: string; label?: string; color?: string }[];
  className?: string;
  showLegend?: boolean;
}) {
  const gradientBase = useId().replace(/:/g, "");
  const config = Object.fromEntries(
    series.map((item, i) => [
      item.key,
      {
        label: item.label ?? item.key,
        color: item.color ?? SERIES_COLORS[i % SERIES_COLORS.length],
      },
    ]),
  ) satisfies ChartConfig;

  return (
    <ChartContainer config={config} className={className}>
      <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <defs>
          {series.map((item) => (
            <linearGradient
              key={item.key}
              id={`${gradientBase}-${item.key}`}
              x1="0"
              y1="0"
              x2="0"
              y2="1"
            >
              <stop offset="5%" stopColor={`var(--color-${item.key})`} stopOpacity={0.35} />
              <stop offset="95%" stopColor={`var(--color-${item.key})`} stopOpacity={0.05} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid vertical={false} stroke="var(--color-line)" />
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          minTickGap={28}
          tick={AXIS_TICK}
        />
        <YAxis
          allowDecimals={false}
          tickLine={false}
          axisLine={false}
          width={42}
          tick={AXIS_TICK}
          tickFormatter={(value: number) => formatCount(value)}
        />
        <ChartTooltip
          cursor={{ stroke: "var(--color-line-strong)" }}
          content={<ChartTooltipContent />}
        />
        {showLegend ? <ChartLegend content={<ChartLegendContent />} /> : null}
        {series.map((item) => (
          <Area
            key={item.key}
            dataKey={item.key}
            type="natural"
            stroke={`var(--color-${item.key})`}
            strokeWidth={2}
            fill={`url(#${gradientBase}-${item.key})`}
            stackId="a"
            dot={false}
            activeDot={{ r: 3 }}
          />
        ))}
      </AreaChart>
    </ChartContainer>
  );
}

/** Tiny inline sparkline — no axes, area stroke only. */
export function SparklineArea({
  data,
  color = "var(--chart-1)",
  className = "h-7 w-24",
}: {
  data: { value: number }[];
  color?: string;
  className?: string;
}) {
  const gradientId = useId().replace(/:/g, "");
  const config: ChartConfig = { value: { label: "Evaluations", color } };

  return (
    <ChartContainer config={config} className={className} initialDimension={{ width: 96, height: 28 }}>
      <AreaChart data={data} margin={{ top: 2, right: 0, bottom: 2, left: 0 }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--color-value)" stopOpacity={0.35} />
            <stop offset="95%" stopColor="var(--color-value)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area
          dataKey="value"
          type="natural"
          stroke="var(--color-value)"
          strokeWidth={1.5}
          fill={`url(#${gradientId})`}
          dot={false}
          isAnimationActive={false}
        />
      </AreaChart>
    </ChartContainer>
  );
}
