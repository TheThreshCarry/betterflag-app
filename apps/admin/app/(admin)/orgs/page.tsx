import Link from "next/link";

import { OrgStatusChip, PlanChip } from "@/components/org-chips";
import { EmptyState, RelativeTime } from "@/components/ui";
import { listOrgsWithCounts } from "@/lib/stats";
import { createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const TH = "px-4 py-3 text-left text-[12px] font-semibold uppercase tracking-[0.06em] text-ink-muted";
const TD = "px-4 py-3.5 text-[14px]";

export default async function OrgsPage() {
  const orgs = await listOrgsWithCounts(createServiceClient());

  return (
    <div className="data-in mx-auto max-w-6xl">
      <header className="mb-8">
        <h1 className="text-[26px] font-semibold tracking-[-0.02em]">Organizations</h1>
        <p className="mt-1 text-[14px] text-ink-muted">
          {orgs.length} total. Click through for per-org analytics and moderation actions.
        </p>
      </header>

      {orgs.length === 0 ? (
        <EmptyState title="No organizations yet" body="Signups will appear here as they come in." />
      ) : (
        <div className="overflow-x-auto rounded-3xl border border-line bg-white">
          <table className="w-full min-w-[760px] border-collapse">
            <thead className="border-b border-line bg-surface/60">
              <tr>
                <th className={TH}>Organization</th>
                <th className={TH}>Plan</th>
                <th className={TH}>Status</th>
                <th className={`${TH} text-right`}>Members</th>
                <th className={`${TH} text-right`}>Projects</th>
                <th className={`${TH} text-right`}>Flags</th>
                <th className={TH}>Created</th>
              </tr>
            </thead>
            <tbody>
              {orgs.map(({ org, members, projects, flags }) => (
                <tr key={org.id} className="border-b border-line/60 last:border-0 hover:bg-surface/50">
                  <td className={TD}>
                    <Link href={`/orgs/${org.id}`} className="font-medium hover:underline">
                      {org.name}
                    </Link>
                    {members === 0 ? (
                      <span className="ml-2 text-[12px] text-ink-muted">(orphaned)</span>
                    ) : null}
                  </td>
                  <td className={TD}>
                    <PlanChip plan={org.plan} />
                  </td>
                  <td className={TD}>
                    <OrgStatusChip org={org} />
                  </td>
                  <td className={`${TD} text-right font-mono`}>{members}</td>
                  <td className={`${TD} text-right font-mono`}>{projects}</td>
                  <td className={`${TD} text-right font-mono`}>{flags}</td>
                  <td className={`${TD} text-ink-muted`}>
                    <RelativeTime iso={org.created_at} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
