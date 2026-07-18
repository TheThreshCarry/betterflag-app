import Link from "next/link";

import { Chip, EmptyState, RelativeTime } from "@/components/ui";
import { UserActions } from "@/components/user-actions";
import { isAdminEmail } from "@/lib/admin-auth";
import { listUsersWithOrgs } from "@/lib/stats";
import { createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const TH = "px-4 py-3 text-left text-[12px] font-semibold uppercase tracking-[0.06em] text-ink-muted";
const TD = "px-4 py-3.5 text-[14px]";

export default async function UsersPage() {
  const users = await listUsersWithOrgs(createServiceClient());
  const bannedCount = users.filter((item) => item.banned).length;

  return (
    <div className="data-in mx-auto max-w-6xl">
      <header className="mb-8">
        <h1 className="text-[26px] font-semibold tracking-[-0.02em]">Users</h1>
        <p className="mt-1 text-[14px] text-ink-muted">
          {users.length} accounts{bannedCount > 0 ? `, ${bannedCount} banned` : ""}. Bans block
          sign-in but keep data; deletes are permanent.
        </p>
      </header>

      {users.length === 0 ? (
        <EmptyState title="No users yet" body="Signups will appear here as they come in." />
      ) : (
        <div className="overflow-x-auto rounded-3xl border border-line bg-white">
          <table className="w-full min-w-[820px] border-collapse">
            <thead className="border-b border-line bg-surface/60">
              <tr>
                <th className={TH}>User</th>
                <th className={TH}>Organizations</th>
                <th className={TH}>Signed up</th>
                <th className={TH}>Last sign-in</th>
                <th className={`${TH} text-right`}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map(({ user, orgs, banned }) => {
                const teamAccount = isAdminEmail(user.email);
                return (
                  <tr key={user.id} className="border-b border-line/60 last:border-0 hover:bg-surface/50">
                    <td className={TD}>
                      <div className="flex items-center gap-2">
                        <span className={`font-medium ${banned ? "opacity-50" : ""}`}>
                          {user.email ?? user.id}
                        </span>
                        {banned ? <Chip color="pink">Banned</Chip> : null}
                        {teamAccount ? <Chip color="orange">ShipOS</Chip> : null}
                      </div>
                    </td>
                    <td className={TD}>
                      {orgs.length === 0 ? (
                        <span className="text-[13px] text-ink-muted">none</span>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {orgs.map((org) => (
                            <Link key={org.id} href={`/orgs/${org.id}`}>
                              <Chip
                                color={org.role === "owner" ? "blue" : "gray"}
                                className="px-2.5 py-0.5 text-[12px] hover:opacity-80"
                                title={org.role}
                              >
                                {org.name}
                              </Chip>
                            </Link>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className={`${TD} text-ink-muted`}>
                      <RelativeTime iso={user.created_at} />
                    </td>
                    <td className={`${TD} text-ink-muted`}>
                      {user.last_sign_in_at ? <RelativeTime iso={user.last_sign_in_at} /> : "never"}
                    </td>
                    <td className={TD}>
                      <UserActions
                        userId={user.id}
                        email={user.email ?? null}
                        banned={banned}
                        protected={teamAccount}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
