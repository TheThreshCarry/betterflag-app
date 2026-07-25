"use client";

/**
 * Chart building blocks on top of the shadcn chart primitives (recharts).
 * Every chart here is single-series, so per the dataviz rules there is no
 * legend box: the surrounding card title names the series, one hue carries
 * it, and the hover tooltip gives exact values.
 */

import { Area, AreaChart, Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import type { DayPoint } from "@/lib/stats";
import { formatCount } from "@/lib/utils";

function formatDay(day: string): string {
  return new Date(`${day}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

const AXIS_TICK = { fontSize: 11 } as const;

function dayChartConfig(label: string, color: string): ChartConfig {
  return { value: { label, color } };
}

/** Daily counts as thin rounded bars (flags created, signups). */
export function DailyBarChart({
  data,
  label,
  color = "var(--chart-1)",
  className = "h-56 w-full",
}: {
  data: DayPoint[];
  label: string;
  color?: string;
  className?: string;
}) {
  return (
    <ChartContainer config={dayChartConfig(label, color)} className={className}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid vertical={false} stroke="var(--color-line)" />
        <XAxis
          dataKey="day"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          minTickGap={28}
          tick={AXIS_TICK}
          tickFormatter={formatDay}
        />
        <YAxis
          allowDecimals={false}
          tickLine={false}
          axisLine={false}
          width={36}
          tick={AXIS_TICK}
          tickFormatter={(value: number) => formatCount(value)}
        />
        <ChartTooltip
          cursor={{ fill: "var(--color-surface-alt)" }}
          content={<ChartTooltipContent labelFormatter={(_, payload) => formatDay(String(payload?.[0]?.payload?.day ?? ""))} />}
        />
        <Bar dataKey="value" fill="var(--color-value)" radius={[4, 4, 0, 0]} maxBarSize={16} />
      </BarChart>
    </ChartContainer>
  );
}

/** Daily volume as a soft area (evaluations). */
export function DailyAreaChart({
  data,
  label,
  color = "var(--chart-1)",
  className = "h-56 w-full",
}: {
  data: DayPoint[];
  label: string;
  color?: string;
  className?: string;
}) {
  return (
    <ChartContainer config={dayChartConfig(label, color)} className={className}>
      <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id="fill-value" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--color-value)" stopOpacity={0.25} />
            <stop offset="95%" stopColor="var(--color-value)" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke="var(--color-line)" />
        <XAxis
          dataKey="day"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          minTickGap={28}
          tick={AXIS_TICK}
          tickFormatter={formatDay}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={42}
          tick={AXIS_TICK}
          tickFormatter={(value: number) => formatCount(value)}
        />
        <ChartTooltip
          cursor={{ stroke: "var(--color-line-strong)" }}
          content={<ChartTooltipContent labelFormatter={(_, payload) => formatDay(String(payload?.[0]?.payload?.day ?? ""))} />}
        />
        <Area
          dataKey="value"
          type="natural"
          stroke="var(--color-value)"
          strokeWidth={2}
          fill="url(#fill-value)"
          dot={false}
          activeDot={{ r: 4 }}
        />
      </AreaChart>
    </ChartContainer>
  );
}

/** Labeled categories as horizontal bars, one hue (plan mix, top orgs). */
export function CategoryBarChart({
  data,
  label,
  color = "var(--chart-1)",
  className = "h-56 w-full",
}: {
  data: { name: string; value: number }[];
  label: string;
  color?: string;
  className?: string;
}) {
  return (
    <ChartContainer config={dayChartConfig(label, color)} className={className}>
      <BarChart data={data} layout="vertical" margin={{ top: 8, right: 16, bottom: 0, left: 8 }}>
        <CartesianGrid horizontal={false} stroke="var(--color-line)" />
        <XAxis
          type="number"
          allowDecimals={false}
          tickLine={false}
          axisLine={false}
          tick={AXIS_TICK}
          tickFormatter={(value: number) => formatCount(value)}
        />
        <YAxis
          type="category"
          dataKey="name"
          tickLine={false}
          axisLine={false}
          width={90}
          tick={AXIS_TICK}
        />
        <ChartTooltip
          cursor={{ fill: "var(--color-surface-alt)" }}
          content={<ChartTooltipContent hideLabel />}
        />
        <Bar dataKey="value" fill="var(--color-value)" radius={[0, 4, 4, 0]} maxBarSize={18} />
      </BarChart>
    </ChartContainer>
  );
}
