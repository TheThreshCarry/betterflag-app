import Link from "next/link";
import { notFound } from "next/navigation";

import { DailyAreaChart } from "@/components/charts";
import { OrgActions } from "@/components/org-actions";
import { OrgStatusChip, PlanChip } from "@/components/org-chips";
import { Panel, StatCard } from "@/components/stat-card";
import { Chip, RelativeTime } from "@/components/ui";
import { loadOrgDetail } from "@/lib/stats";
import { createServiceClient } from "@/lib/supabase/server";
import { formatCount } from "@/lib/utils";

export const dynamic = "force-dynamic";

const TH = "px-4 py-2.5 text-left text-[12px] font-semibold uppercase tracking-[0.06em] text-ink-muted";
const TD = "px-4 py-3 text-[14px]";

export default async function OrgDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = await loadOrgDetail(createServiceClient(), id);
  if (!detail) notFound();

  const { org, members, projects, apiKeys, audit, evalsPerDay } = detail;
  const totalFlags = projects.reduce((sum, project) => sum + project.flags, 0);
  const evals7d = evalsPerDay.slice(-7).reduce((sum, point) => sum + point.value, 0);
  const activeKeys = apiKeys.filter((key) => !key.revoked_at);

  return (
    <div className="data-in mx-auto max-w-6xl">
      <div className="mb-2 text-[13px]">
        <Link href="/orgs" className="text-ink-muted hover:text-ink hover:underline">
          ← Organizations
        </Link>
      </div>
      <header className="mb-8 flex flex-wrap items-center gap-3">
        <h1 className="text-[26px] font-semibold tracking-[-0.02em]">{org.name}</h1>
        <PlanChip plan={org.plan} />
        <OrgStatusChip org={org} />
        <span className="font-mono text-[12px] text-ink-muted">{org.id}</span>
      </header>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Members" value={String(members.length)} />
        <StatCard label="Projects" value={String(projects.length)} />
        <StatCard label="Flags" value={String(totalFlags)} />
        <StatCard label="Evaluations, 7 days" value={formatCount(evals7d)} />
      </div>

      <div className="mt-8 grid gap-6">
        <Panel title="Flag evaluations per day, 30 days">
          <DailyAreaChart data={evalsPerDay} label="Evaluations" className="h-60 w-full" />
        </Panel>

        <div className="grid gap-6 lg:grid-cols-2">
          <Panel title={`Members (${members.length})`}>
            {members.length === 0 ? (
              <p className="text-[14px] text-ink-muted">
                No members. This org is orphaned (its users were deleted).
              </p>
            ) : (
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-line">
                    <th className={TH}>Email</th>
                    <th className={TH}>Role</th>
                    <th className={TH}>Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((member) => (
                    <tr key={member.userId} className="border-b border-line/60 last:border-0">
                      <td className={TD}>{member.email ?? member.userId}</td>
                      <td className={TD}>
                        <Chip color={member.role === "owner" ? "orange" : member.role === "admin" ? "blue" : "gray"}>
                          {member.role}
                        </Chip>
                      </td>
                      <td className={`${TD} text-ink-muted`}>
                        <RelativeTime iso={member.joinedAt} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Panel>

          <Panel title={`Projects (${projects.length})`}>
            {projects.length === 0 ? (
              <p className="text-[14px] text-ink-muted">No projects.</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {projects.map(({ project, environments, flags }) => (
                  <li key={project.id} className="rounded-2xl border border-line bg-surface px-4 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-[14px] font-medium">{project.name}</p>
                        <p className="font-mono text-[12px] text-ink-muted">{project.slug}</p>
                      </div>
                      <span className="font-mono text-[13px] text-ink-muted">{flags} flags</span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {environments.map((environment) => (
                        <Chip key={environment.id} color="gray" className="px-2.5 py-0.5 text-[12px]">
                          {environment.slug}
                        </Chip>
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title={`API keys (${activeKeys.length} active)`}>
            {apiKeys.length === 0 ? (
              <p className="text-[14px] text-ink-muted">No API keys.</p>
            ) : (
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-line">
                    <th className={TH}>Key</th>
                    <th className={TH}>Kind</th>
                    <th className={TH}>Last used</th>
                  </tr>
                </thead>
                <tbody>
                  {apiKeys.slice(0, 10).map((key) => (
                    <tr key={key.id} className="border-b border-line/60 last:border-0">
                      <td className={TD}>
                        <span className={key.revoked_at ? "line-through opacity-50" : ""}>{key.name}</span>
                        <span className="ml-2 font-mono text-[12px] text-ink-muted">{key.prefix}…</span>
                      </td>
                      <td className={TD}>
                        <Chip color={key.kind === "agent" ? "orange" : key.kind === "admin" ? "pink" : "blue"}>
                          {key.kind}
                        </Chip>
                      </td>
                      <td className={`${TD} text-ink-muted`}>
                        {key.last_used_at ? <RelativeTime iso={key.last_used_at} /> : "never"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Panel>

          <Panel title="Recent audit activity">
            {audit.length === 0 ? (
              <p className="text-[14px] text-ink-muted">No audit entries.</p>
            ) : (
              <ul className="flex flex-col gap-2.5">
                {audit.map((entry) => (
                  <li key={entry.id} className="flex items-baseline justify-between gap-3 text-[13px]">
                    <span>
                      <span className="font-mono font-medium">{entry.action}</span>{" "}
                      <span className="text-ink-muted">{entry.subject}</span>
                      {entry.actor_type === "agent" ? (
                        <Chip color="orange" className="ml-2 px-2 py-0 text-[11px]">
                          agent
                        </Chip>
                      ) : null}
                    </span>
                    <span className="shrink-0 text-ink-muted">
                      <RelativeTime iso={entry.created_at} />
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        <Panel title="Moderation" className="border-chip-pink/30">
          <p className="mb-4 text-[14px] text-ink-muted">
            {org.frozen_at
              ? `Frozen since ${new Date(org.frozen_at).toLocaleString("en-US")}. Control-plane writes are rejected with 403 org_frozen.`
              : "Freezing blocks all control-plane writes (dashboard, REST, MCP) while flags keep serving at the edge."}
          </p>
          <OrgActions orgId={org.id} orgName={org.name} frozen={Boolean(org.frozen_at)} />
        </Panel>
      </div>
    </div>
  );
}
