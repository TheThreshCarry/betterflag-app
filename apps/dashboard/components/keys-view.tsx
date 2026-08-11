"use client";

import { PLAN_LIMITS } from "@betterflag/db";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { useApp } from "@/components/app-shell";
import {
  Button,
  Chip,
  CopyButton,
  Dialog,
  EmptyState,
  ErrorNote,
  Field,
  RelativeTime,
  inputClass,
  type ChipColor,
} from "@/components/ui";
import { DataTable, TableCell, TableRow, type Column } from "@/components/data-table";
import { Stagger } from "@/components/stagger";
import type { ApiApiKey } from "@/lib/api-types";
import { api } from "@/lib/client-api";
import { toast } from "@/lib/toast";

const KEY_COLUMNS: readonly Column[] = [
  { key: "key", label: "Key", colWidth: "w-[14%]", skeletonWidth: "w-20" },
  { key: "name", label: "Name", colWidth: "w-[22%]", skeletonWidth: "w-28" },
  { key: "kind", label: "Kind", colWidth: "w-[12%]", skeletonWidth: "w-14" },
  { key: "scope", label: "Scope", colWidth: "w-[18%]", skeletonWidth: "w-24" },
  { key: "lastUsed", label: "Last used", colWidth: "w-[12%]", skeletonWidth: "w-16" },
  { key: "created", label: "Created", colWidth: "w-[12%]", skeletonWidth: "w-16" },
  { key: "actions", label: "", colWidth: "w-[10%]", skeletonWidth: "w-14", align: "right" },
];

const KIND_COLORS: Record<ApiApiKey["kind"], ChipColor> = {
  sdk: "blue",
  agent: "green",
  admin: "orange",
};

const KIND_EXPLAINERS: Record<ApiApiKey["kind"], { title: string; body: string }> = {
  sdk: {
    title: "SDK key",
    body: "Publishable. Evaluates flags at the edge for one project + environment. Safe to ship in clients, it can never change config.",
  },
  agent: {
    title: "Agent key",
    body: "For AI agents and automations. Full flag control, create, target, roll out, and kill flags via the MCP server or REST API.",
  },
  admin: {
    title: "Admin key",
    body: "Full control plane access for CI and scripts, treat it like a password.",
  },
};

export function KeysView({ initialKeys }: { initialKeys: ApiApiKey[] }) {
  const router = useRouter();
  const { org, projects } = useApp();
  const keys = initialKeys;
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<ApiApiKey | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(() => {
    router.refresh();
  }, [router]);

  const agentLimit = PLAN_LIMITS[org.plan].agentKeys;
  const activeAgentKeys = useMemo(
    // OAuth-connection keys are exempt from the plan agent-key limit.
    () =>
      keys.filter(
        (key) => key.kind === "agent" && key.revokedAt === null && key.source !== "oauth",
      ).length,
    [keys],
  );

  const projectName = useCallback(
    (projectId: string | null, environmentId: string | null) => {
      if (!projectId) return "org-wide";
      const project = projects.find((p) => p.id === projectId);
      if (!project) return "-";
      const env = environmentId
        ? project.environments.find((e) => e.id === environmentId)
        : null;
      return env ? `${project.slug} · ${env.slug}` : project.slug;
    },
    [projects],
  );

  return (
    <>
      <Stagger>
        <div className="mb-5 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-[20px] font-semibold tracking-[-0.01em]">API keys</h2>
            <p className="mt-1 text-[13px] text-ink-muted">
              SDK keys evaluate, agent keys automate, admin keys administer.
            </p>
          </div>
          <Button onClick={() => setCreateOpen(true)}>New key</Button>
        </div>

        <ErrorNote message={error} />

        {!keys.length ? (
          <EmptyState
            title="No keys yet"
            body="Create an SDK key to evaluate flags, or an agent key to let your agents manage them."
            action={<Button onClick={() => setCreateOpen(true)}>New key</Button>}
          />
        ) : (
          <DataTable columns={KEY_COLUMNS} staggerSelf>
            {keys.map((key) => (
              <TableRow key={key.id} className={key.revokedAt ? "opacity-45" : undefined}>
                <TableCell className="truncate font-mono text-[13px]">{key.prefix}…</TableCell>
                <TableCell className="truncate whitespace-nowrap text-foreground-strong">
                  {key.name}
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  <span className="inline-flex items-center gap-1.5">
                    <Chip color={KIND_COLORS[key.kind]} className="!px-2.5 !py-0.5 text-[12px]">
                      {key.kind}
                    </Chip>
                    {key.source === "oauth" ? (
                      <Chip color="gray" className="!px-2.5 !py-0.5 text-[12px]">
                        oauth
                      </Chip>
                    ) : null}
                  </span>
                </TableCell>
                <TableCell className="truncate font-mono text-[12px] text-foreground-muted">
                  {projectName(key.projectId, key.environmentId)}
                </TableCell>
                <TableCell className="whitespace-nowrap text-foreground-muted">
                  {key.lastUsedAt ? <RelativeTime iso={key.lastUsedAt} /> : "never"}
                </TableCell>
                <TableCell className="whitespace-nowrap text-foreground-muted">
                  <RelativeTime iso={key.createdAt} />
                </TableCell>
                <TableCell className="text-end whitespace-nowrap">
                  {key.revokedAt ? (
                    <span className="text-[12px] text-foreground-muted">revoked</span>
                  ) : (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={(event) => {
                        event.stopPropagation();
                        setRevokeTarget(key);
                      }}
                    >
                      Revoke
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </DataTable>
        )}
      </Stagger>

      <CreateKeyDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        agentLimit={agentLimit}
        activeAgentKeys={activeAgentKeys}
        plan={org.plan}
        onCreated={refresh}
      />

      <Dialog
        open={revokeTarget !== null}
        onClose={() => setRevokeTarget(null)}
        title="Revoke key?"
      >
        {revokeTarget ? (
          <>
            <p className="text-[14px] text-ink-muted">
              <span className="font-mono text-[13px] text-ink">{revokeTarget.prefix}…</span> (
              {revokeTarget.name}) stops working immediately.
              {revokeTarget.kind === "sdk"
                ? " Edge SDKs using it will be rejected within seconds."
                : " Any agent or script using it will get 401s."}
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setRevokeTarget(null)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                loading={busy}
                onClick={() => {
                  setBusy(true);
                  void api(`/api/v1/keys/${revokeTarget.id}`, { method: "DELETE" })
                    .then(async () => {
                      toast.success({
                        title: "Key revoked",
                        description: `${revokeTarget.prefix}…`,
                      });
                      setRevokeTarget(null);
                      refresh();
                    })
                    .catch((err: unknown) =>
                      setError(err instanceof Error ? err.message : "Failed to revoke"),
                    )
                    .finally(() => setBusy(false));
                }}
              >
                {busy ? "Revoking…" : "Revoke key"}
              </Button>
            </div>
          </>
        ) : null}
      </Dialog>
    </>
  );
}

function CreateKeyDialog({
  open,
  onClose,
  agentLimit,
  activeAgentKeys,
  plan,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  agentLimit: number | null;
  activeAgentKeys: number;
  plan: string;
  onCreated: () => void;
}) {
  const { projects } = useApp();
  const [kind, setKind] = useState<ApiApiKey["kind"]>("sdk");
  const [name, setName] = useState("");
  const [projectId, setProjectId] = useState("");
  const [environmentId, setEnvironmentId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ apiKey: ApiApiKey; plaintext: string } | null>(null);

  const selectedProject = projects.find((p) => p.id === projectId) ?? null;
  const atAgentLimit = kind === "agent" && agentLimit !== null && activeAgentKeys >= agentLimit;

  useEffect(() => {
    if (open) {
      setCreated(null);
      setError(null);
      setName("");
      setProjectId(projects[0]?.id ?? "");
      setEnvironmentId("");
    }
  }, [open, projects]);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const result = await api<{ apiKey: ApiApiKey; plaintext: string }>("/api/v1/keys", {
        method: "POST",
        body: JSON.stringify({
          kind,
          name,
          ...(kind === "sdk" ? { projectId, environmentId } : {}),
        }),
      });
      setCreated(result);
      toast.success({ title: "Key created", description: result.apiKey.name });
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create key");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title={created ? "Key created" : "New API key"} wide>
      {created ? (
        <div className="space-y-4">
          <div className="rounded-2xl bg-chip-orange/10 px-4 py-3 text-[13px] font-medium text-chip-orange">
            This is the only time the full key is shown. Copy it now.
          </div>
          <div className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-4">
            <code className="flex-1 break-all font-mono text-[13px]">{created.plaintext}</code>
            <CopyButton text={created.plaintext} />
          </div>
          <div className="flex justify-end">
            <Button onClick={onClose}>Done</Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-2 sm:grid-cols-3">
            {(Object.keys(KIND_EXPLAINERS) as ApiApiKey["kind"][]).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setKind(option)}
                className={`rounded-2xl border p-3.5 text-left transition-colors ${
                  kind === option
                    ? "border-line-strong bg-surface"
                    : "border-line bg-canvas hover:bg-surface/50"
                }`}
              >
                <Chip color={KIND_COLORS[option]} className="!px-2 !py-0.5 text-[11px]">
                  {option}
                </Chip>
                <p className="mt-2 text-[13px] font-semibold">{KIND_EXPLAINERS[option].title}</p>
                <p className="mt-1 text-[12px] leading-snug text-ink-muted">
                  {KIND_EXPLAINERS[option].body}
                </p>
              </button>
            ))}
          </div>

          {atAgentLimit ? (
            <div className="rounded-2xl bg-chip-orange/10 px-4 py-3 text-[13px] font-medium text-chip-orange">
              The {plan} plan includes {agentLimit} agent key{agentLimit === 1 ? "" : "s"} and all{" "}
              {agentLimit} are active. Revoke one or upgrade your plan.
            </div>
          ) : null}

          <Field label="Name">
            <input
              className={inputClass}
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={
                kind === "sdk" ? "Web app (prod)" : kind === "agent" ? "Deploy agent" : "CI"
              }
            />
          </Field>

          {kind === "sdk" ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Project">
                <select
                  className={inputClass}
                  value={projectId}
                  onChange={(event) => {
                    setProjectId(event.target.value);
                    setEnvironmentId("");
                  }}
                >
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Environment">
                <select
                  className={inputClass}
                  value={environmentId}
                  onChange={(event) => setEnvironmentId(event.target.value)}
                >
                  <option value="">Select…</option>
                  {(selectedProject?.environments ?? []).map((env) => (
                    <option key={env.id} value={env.id}>
                      {env.name}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          ) : null}

          <ErrorNote message={error} />

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button
              loading={busy}
              disabled={
                name.trim().length === 0 ||
                (kind === "sdk" && (!projectId || !environmentId)) ||
                atAgentLimit
              }
              onClick={() => void submit()}
            >
              {busy ? "Creating…" : "Create key"}
            </Button>
          </div>
        </div>
      )}
    </Dialog>
  );
}
