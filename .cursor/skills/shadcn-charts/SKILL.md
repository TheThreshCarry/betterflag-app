---
name: shadcn-charts
description: >-
  Build charts with shadcn/ui + Recharts (ui.shadcn.com/charts). Prefer Area
  charts for time series. Use when adding, editing, or migrating any chart,
  graph, sparkline, analytics series, usage meter visualization, or Recharts
  component in ShipOS or any shadcn project.
---

# shadcn/ui Charts

Canonical reference: [ui.shadcn.com/charts/area](https://ui.shadcn.com/charts/area)

All product charts use **shadcn chart primitives + Recharts**. Do not hand-roll SVG bar/line charts for analytics, usage, or flag series.

## Install (once per app)

```bash
npx shadcn@latest add chart -y
# pulls recharts + components/ui/chart.tsx
```

Theme tokens (ShipOS chip hues):

```css
:root {
  --chart-1: #0067f4; /* blue — primary series */
  --chart-2: #00bc72; /* green */
  --chart-3: #ff5a1a; /* orange */
  --chart-4: #ff2c5f; /* pink */
  --chart-5: #737373; /* gray / off */
}
```

Also expose `--color-chart-1` … `--color-chart-5` in `@theme` if the app uses Tailwind v4 `@theme`.

## Stack

| Layer | Role |
|-------|------|
| `components/ui/chart.tsx` | `ChartContainer`, `ChartTooltip`, `ChartTooltipContent`, `ChartLegend`, `ChartConfig` |
| `components/charts.tsx` | App helpers: `SeriesAreaChart`, `DailyAreaChart`, `StackedAreaChart`, `SparklineArea` |
| `recharts` | `AreaChart`, `Area`, `BarChart`, `Bar`, axes, grid |

## Rules

1. **Default to Area** for time series (evaluations, usage, signups volume). Soft gradient fill + 2px stroke.
2. **Bar** only for discrete counts (flags created per day, category rankings) or when the design explicitly needs bars.
3. **No raw `<svg>` / `<rect>` / `<polyline>` charts** for product metrics. Sparklines use `SparklineArea` (or equivalent ChartContainer + Area, axes hidden).
4. **Single series → no legend box.** Card/section title names the series; tooltip shows exact values.
5. **Multi series → stacked Area** + `ChartLegend` / labeled chips. Map colors via `ChartConfig`.
6. **Colors from `var(--chart-N)`** (or ShipOS chip tokens). Never hardcode `#0067F4` in new charts.
7. **Axes**: `tickLine={false}`, `axisLine={false}`, horizontal grid only (`CartesianGrid vertical={false}`).
8. **Curve**: `type="natural"` (shadcn area default). `dot={false}`, `activeDot={{ r: 4 }}`.
9. **Height**: override `aspect-video` with `className="aspect-auto h-44 w-full"` (or similar) so layout stays stable.
10. **Ranked list bars** (country tables, progress meters) are UI rows, not Recharts — leave those alone.

## Canonical Area pattern

```tsx
"use client";

import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

const chartConfig = {
  value: { label: "Evaluations", color: "var(--chart-1)" },
} satisfies ChartConfig;

export function ExampleArea({ data }: { data: { label: string; value: number }[] }) {
  return (
    <ChartContainer config={chartConfig} className="aspect-auto h-44 w-full">
      <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id="fill-value" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--color-value)" stopOpacity={0.25} />
            <stop offset="95%" stopColor="var(--color-value)" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke="var(--color-line)" />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} minTickGap={28} />
        <YAxis tickLine={false} axisLine={false} width={42} allowDecimals={false} />
        <ChartTooltip
          cursor={{ stroke: "var(--color-line-strong)" }}
          content={<ChartTooltipContent />}
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
```

`ChartContainer` injects `--color-{key}` from `chartConfig`. Use those CSS vars for stroke/fill.

## ShipOS locations

| App | Primitives | Helpers |
|-----|------------|---------|
| `apps/dashboard` | `components/ui/chart.tsx` | `components/charts.tsx` |
| `apps/admin` | `components/ui/chart.tsx` | `components/charts.tsx` |

Reuse helpers before inventing a new chart wrapper.

## Migration checklist

When touching a hand-rolled SVG chart:

- [ ] Install `chart` if missing
- [ ] Shape data as `{ label, value }` (or multi keys for stacked)
- [ ] Replace SVG with `SeriesAreaChart` / `DailyAreaChart` / `StackedAreaChart` / `SparklineArea`
- [ ] Wire `--chart-*` tokens
- [ ] Drop hardcoded hex fills
- [ ] Keep surrounding card title as the series name

## Anti-patterns

- Custom SVG bars/lines for metrics
- Chart.js / Visx / Nivo when shadcn chart already in the app
- Legend on a single-series chart
- Purple/indigo default shadcn demo colors — use ShipOS chip hues
- Inset “card inside card” solely to wrap a chart
