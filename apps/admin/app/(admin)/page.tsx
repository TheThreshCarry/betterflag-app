import { CategoryBarChart, DailyAreaChart, DailyBarChart } from "@/components/charts";
import { Panel, StatCard } from "@/components/stat-card";
import { loadOverviewStats } from "@/lib/stats";
import { createServiceClient } from "@/lib/supabase/server";
import { formatCount } from "@/lib/utils";

export const dynamic = "force-dynamic";

const PLAN_LABELS: Record<string, string> = {
  trial: "Trial",
  starter: "Starter",
  launch: "Launch",
  scale: "Scale",
};

export default async function OverviewPage() {
  const stats = await loadOverviewStats(createServiceClient());

  return (
    <div className="data-in mx-auto max-w-6xl">
      <header className="mb-8">
        <h1 className="text-[26px] font-semibold tracking-[-0.02em]">Overview</h1>
        <p className="mt-1 text-[14px] text-ink-muted">
          Platform-wide health across every organization.
        </p>
      </header>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Organizations" value={formatCount(stats.totals.orgs)} />
        <StatCard label="Users" value={formatCount(stats.totals.users)} />
        <StatCard
          label="Active flags"
          value={formatCount(stats.totals.activeFlags)}
          hint={`${formatCount(stats.totals.projects)} projects`}
        />
        <StatCard
          label="Evaluations, 7 days"
          value={formatCount(stats.totals.evals7d)}
          hint="ClickHouse billing meter"
        />
      </div>

      <div className="mt-4 grid grid-cols-3 gap-4">
        <StatCard label="Flags created today" value={formatCount(stats.flagsCreated.today)} />
        <StatCard label="Flags created, 7 days" value={formatCount(stats.flagsCreated.past7d)} />
        <StatCard label="Flags created, 30 days" value={formatCount(stats.flagsCreated.past30d)} />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Panel title="Flags created per day, 30 days">
          <DailyBarChart data={stats.flagsPerDay} label="Flags created" />
        </Panel>
        <Panel title="User signups per day, 30 days">
          <DailyBarChart data={stats.signupsPerDay} label="Signups" color="var(--chart-2)" />
        </Panel>
        <Panel title="Flag evaluations per day, 30 days" className="lg:col-span-2">
          <DailyAreaChart data={stats.evalsPerDay} label="Evaluations" className="h-64 w-full" />
        </Panel>
        <Panel title="Organizations by plan" className="lg:col-span-2">
          <CategoryBarChart
            data={stats.planMix.map(({ plan, count }) => ({
              name: PLAN_LABELS[plan] ?? plan,
              value: count,
            }))}
            label="Organizations"
            className="h-48 w-full"
          />
        </Panel>
      </div>
    </div>
  );
}
