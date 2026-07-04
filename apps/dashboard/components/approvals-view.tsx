"use client";

/**
 * The "agent stages, human confirms" surface. Pending approvals render the
 * staged payload human-readably; owners/admins approve or reject.
 */

import { useCallback, useEffect, useState } from "react";

import { useApp } from "@/components/app-shell";
import {
  Button,
  Chip,
  EmptyState,
  ErrorNote,
  JsonBlock,
  PageLoading,
  RelativeTime,
} from "@/components/ui";
import type { ApiApproval } from "@/lib/api-types";
import { api } from "@/lib/client-api";

interface StagedActionView {
  action: string;
  flagKey: string;
  envSlug: string;
  fromEnvSlug?: string;
  patch?: Record<string, unknown>;
}

function readStagedAction(raw: unknown): StagedActionView | null {
  if (typeof raw !== "object" || raw === null) return null;
  const obj = raw as Record<string, unknown>;
  if (typeof obj.action !== "string") return null;
  return {
    action: obj.action,
    flagKey: typeof obj.flagKey === "string" ? obj.flagKey : "?",
    envSlug: typeof obj.envSlug === "string" ? obj.envSlug : "?",
    ...(typeof obj.fromEnvSlug === "string" ? { fromEnvSlug: obj.fromEnvSlug } : {}),
    ...(typeof obj.patch === "object" && obj.patch !== null
      ? { patch: obj.patch as Record<string, unknown> }
      : {}),
  };
}

function actionHeadline(staged: StagedActionView): string {
  switch (staged.action) {
    case "kill_flag":
      return `Kill switch — ${staged.flagKey} in ${staged.envSlug}`;
    case "promote":
      return `Promote — ${staged.flagKey} ${staged.fromEnvSlug ?? "?"} → ${staged.envSlug}`;
    case "update_flag_config":
      return `Config change — ${staged.flagKey} in ${staged.envSlug}`;
    default:
      return `${staged.action} — ${staged.flagKey} in ${staged.envSlug}`;
  }
}

function patchLines(patch: Record<string, unknown> | undefined): string[] {
  if (!patch) return [];
  const lines: string[] = [];
  if (typeof patch.enabled === "boolean") lines.push(`enabled → ${patch.enabled ? "on" : "off"}`);
  if (typeof patch.rolloutPct === "number") lines.push(`rollout → ${patch.rolloutPct}%`);
  if (Array.isArray(patch.rules)) {
    lines.push(`rules → ${patch.rules.length} rule${patch.rules.length === 1 ? "" : "s"}`);
  }
  if ("valueOn" in patch) lines.push(`valueOn → ${JSON.stringify(patch.valueOn)}`);
  if ("valueOff" in patch) lines.push(`valueOff → ${JSON.stringify(patch.valueOff)}`);
  if (patch.clearKill === true) lines.push("clears the kill switch");
  if (typeof patch.expectedVersion === "number") {
    lines.push(`expects config version ${patch.expectedVersion}`);
  }
  return lines;
}

export function ApprovalsView() {
  const { org } = useApp();
  const canResolve = org.role === "owner" || org.role === "admin";

  const [approvals, setApprovals] = useState<ApiApproval[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const { approvals: loaded } = await api<{ approvals: ApiApproval[] }>("/api/v1/approvals");
      setApprovals(loaded);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load approvals");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function resolve(id: string, verb: "approve" | "reject") {
    setBusyId(id);
    setError(null);
    try {
      await api(`/api/v1/approvals/${id}/${verb}`, { method: "POST" });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to ${verb}`);
    } finally {
      setBusyId(null);
    }
  }

  if (!approvals) {
    return (
      <div>
        <Header />
        <PageLoading />
      </div>
    );
  }

  const pending = approvals.filter((a) => a.status === "pending");
  const resolved = approvals.filter((a) => a.status !== "pending").slice(0, 20);

  return (
    <div>
      <Header />
      <ErrorNote message={error} />

      {!canResolve && pending.length > 0 ? (
        <div className="mb-4 rounded-2xl bg-chip-gray/10 px-4 py-3 text-[13px] text-ink-muted">
          You can see pending requests, but only org owners and admins can approve or reject them.
        </div>
      ) : null}

      {pending.length === 0 ? (
        <EmptyState
          title="No pending approvals"
          body="When a guardrail catches an agent action — a kill switch, a 100% rollout, a prod promote — it lands here for a human decision."
        />
      ) : (
        <div className="space-y-4">
          {pending.map((approval) => {
            const staged = readStagedAction(approval.action);
            const lines = patchLines(staged?.patch);
            return (
              <div key={approval.id} className="rounded-3xl border border-line bg-surface p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2.5">
                      <Chip
                        color={staged?.action === "kill_flag" ? "pink" : "orange"}
                        className="!px-2.5 !py-0.5 text-[12px]"
                      >
                        {staged?.action === "kill_flag"
                          ? "kill switch"
                          : staged?.action === "promote"
                            ? "promote"
                            : "config change"}
                      </Chip>
                      <h3 className="font-mono text-[15px] font-semibold">
                        {staged ? actionHeadline(staged) : "Staged action"}
                      </h3>
                    </div>
                    <p className="mt-2 text-[13px] text-ink-muted">
                      Requested by{" "}
                      <Chip color="green" className="!px-1.5 !py-0 font-mono text-[11px]">
                        {approval.requestedByKey}
                      </Chip>{" "}
                      <RelativeTime iso={approval.createdAt} />. Nothing has been changed yet.
                    </p>
                    {staged?.action === "kill_flag" ? (
                      <p className="mt-2 text-[13px]">
                        Approving serves <span className="font-medium">OFF to everyone</span> in{" "}
                        <span className="font-mono text-[12px]">{staged.envSlug}</span> within
                        seconds.
                      </p>
                    ) : null}
                    {lines.length > 0 ? (
                      <ul className="mt-3 space-y-1">
                        {lines.map((line) => (
                          <li key={line} className="flex items-center gap-2 text-[13px]">
                            <span className="h-1.5 w-1.5 rounded-full bg-chip-orange" />
                            <span className="font-mono text-[12px]">{line}</span>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    <details className="mt-3">
                      <summary className="cursor-pointer text-[12px] font-medium text-ink-muted hover:text-ink">
                        Raw staged payload
                      </summary>
                      <div className="mt-2">
                        <JsonBlock value={approval.action} />
                      </div>
                    </details>
                  </div>
                  <div className="flex shrink-0 flex-col gap-2">
                    <Button
                      disabled={!canResolve || busyId === approval.id}
                      onClick={() => void resolve(approval.id, "approve")}
                    >
                      {busyId === approval.id ? "Working…" : "Approve & execute"}
                    </Button>
                    <Button
                      variant="secondary"
                      disabled={!canResolve || busyId === approval.id}
                      onClick={() => void resolve(approval.id, "reject")}
                    >
                      Reject
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {resolved.length > 0 ? (
        <div className="mt-10">
          <h2 className="mb-3 text-[16px] font-semibold">History</h2>
          <div className="overflow-hidden rounded-3xl border border-line">
            {resolved.map((approval) => {
              const staged = readStagedAction(approval.action);
              return (
                <div
                  key={approval.id}
                  className="flex items-center gap-4 border-b border-line px-5 py-3 last:border-b-0"
                >
                  <Chip
                    color={approval.status === "approved" ? "green" : "pink"}
                    className="!px-2 !py-0.5 text-[11px]"
                  >
                    {approval.status}
                  </Chip>
                  <span className="flex-1 truncate font-mono text-[12px]">
                    {staged ? actionHeadline(staged) : approval.id}
                  </span>
                  <Chip color="green" className="!px-1.5 !py-0 font-mono text-[11px]">
                    {approval.requestedByKey}
                  </Chip>
                  <span className="shrink-0 text-[12px] text-ink-muted">
                    {approval.resolvedAt ? <RelativeTime iso={approval.resolvedAt} /> : null}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Header() {
  return (
    <div className="mb-6">
      <h1 className="text-[28px] font-semibold tracking-[-0.01em]">Approvals</h1>
      <p className="mt-0.5 text-[14px] text-ink-muted">
        Agents stage the risky changes. You pull the trigger.
      </p>
    </div>
  );
}
