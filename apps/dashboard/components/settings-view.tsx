"use client";

import { PLAN_LIMITS } from "@shipos/db";
import { useEffect, useState } from "react";

import { Card, Chip, ErrorNote, PageLoading, inputClass, type ChipColor } from "@/components/ui";
import type { ApiOrg } from "@/lib/api-types";
import { api } from "@/lib/client-api";

const ROLE_COLORS: Record<string, ChipColor> = {
  owner: "orange",
  admin: "blue",
  member: "gray",
};

export function SettingsView() {
  const [org, setOrg] = useState<ApiOrg | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void api<{ orgs: ApiOrg[] }>("/api/v1/orgs?members=1")
      .then(({ orgs }) => setOrg(orgs[0] ?? null))
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : "Failed to load settings"),
      );
  }, []);

  if (error) return <ErrorNote message={error} />;
  if (!org) return <PageLoading />;

  const limits = PLAN_LIMITS[org.plan];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-[28px] font-semibold tracking-[-0.01em]">Settings</h1>
        <p className="mt-0.5 text-[14px] text-ink-muted">Organization, plan and members.</p>
      </div>

      <div className="space-y-6">
        <Card className="p-6">
          <h2 className="text-[16px] font-semibold">Organization</h2>
          <div className="mt-4 max-w-sm">
            <label className="mb-1.5 block text-[13px] font-medium">Name</label>
            <input className={inputClass} value={org.name} readOnly disabled />
            <p className="mt-1.5 text-[12px] text-ink-muted">
              Renaming and member management are coming soon.
            </p>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-[16px] font-semibold">Plan</h2>
            <Chip color={org.plan === "trial" ? "orange" : "green"}>{org.plan}</Chip>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-line bg-white p-4">
              <p className="font-mono text-[22px] font-semibold">
                {limits.projects === null ? "∞" : limits.projects}
              </p>
              <p className="text-[13px] text-ink-muted">projects</p>
            </div>
            <div className="rounded-2xl border border-line bg-white p-4">
              <p className="font-mono text-[22px] font-semibold">
                {limits.agentKeys === null ? "∞" : limits.agentKeys}
              </p>
              <p className="text-[13px] text-ink-muted">agent keys</p>
            </div>
            <div className="rounded-2xl border border-line bg-white p-4">
              <p className="font-mono text-[22px] font-semibold">
                {(limits.includedEvalsPerMonth / 1_000_000).toLocaleString()}M
              </p>
              <p className="text-[13px] text-ink-muted">evaluations / month</p>
            </div>
          </div>
          {org.plan === "trial" ? (
            <p className="mt-4 text-[13px] text-ink-muted">
              Trial ends{" "}
              <span className="font-medium text-ink">
                {new Date(org.trialEndsAt).toLocaleDateString()}
              </span>
              . Billing is coming soon — you will pick a plan here.
            </p>
          ) : null}
        </Card>

        <Card className="p-6">
          <h2 className="text-[16px] font-semibold">Members</h2>
          <div className="mt-4 overflow-hidden rounded-2xl border border-line bg-white">
            {(org.members ?? []).map((member) => (
              <div
                key={member.userId}
                className="flex items-center justify-between border-b border-line px-4 py-3 last:border-b-0"
              >
                <div>
                  <p className="text-[14px] font-medium">
                    {member.email ?? `${member.userId.slice(0, 8)}…`}
                  </p>
                  <p className="text-[12px] text-ink-muted">
                    joined {new Date(member.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <Chip color={ROLE_COLORS[member.role] ?? "gray"} className="!px-2.5 !py-0.5 text-[12px]">
                  {member.role}
                </Chip>
              </div>
            ))}
            {(org.members ?? []).length === 0 ? (
              <p className="px-4 py-6 text-center text-[13px] text-ink-muted">
                Member list unavailable.
              </p>
            ) : null}
          </div>
          <p className="mt-3 text-[12px] text-ink-muted">
            Invites are read-only for now — ask us to add teammates during the alpha.
          </p>
        </Card>
      </div>
    </div>
  );
}
