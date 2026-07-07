"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";

import { useApp } from "@/components/app-shell";
import {
  Button,
  Chip,
  Dialog,
  EmptyState,
  ErrorNote,
  Field,
  RelativeTime,
  inputClass,
  textareaClass,
  type ChipColor,
} from "@/components/ui";
import { DataTable, DataTableSkeleton, type Column } from "@/components/data-table";
import type { ApiFlag, ApiFlagConfig } from "@/lib/api-types";
import { api } from "@/lib/client-api";

type FlagWithConfigs = ApiFlag & { configs: ApiFlagConfig[] };

const FLAG_COLUMNS: readonly Column[] = [
  { key: "key", label: "Key", colWidth: "w-[18%]", skeletonWidth: "w-24" },
  { key: "name", label: "Name", colWidth: "w-[26%]", skeletonWidth: "w-32" },
  { key: "kind", label: "Kind", colWidth: "w-[12%]", skeletonWidth: "w-14" },
  { key: "environments", label: "Environments", colWidth: "w-[32%]", skeletonWidth: "w-40" },
  { key: "updated", label: "Updated", colWidth: "w-[12%]", skeletonWidth: "w-16" },
];

export const KIND_COLORS: Record<ApiFlag["kind"], ChipColor> = {
  boolean: "blue",
  string: "orange",
  number: "green",
  json: "pink",
};

const ENV_ORDER = ["dev", "staging", "prod"];

export function slugifyFlagKey(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^[-._]+|[-._]+$/g, "")
    .slice(0, 128);
}

export function slugifyProjectSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 63);
}

export function FlagsView() {
  const { activeProject } = useApp();
  const router = useRouter();
  const [flags, setFlags] = useState<FlagWithConfigs[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const load = useCallback(async () => {
    if (!activeProject) return;
    try {
      const { flags: loaded } = await api<{ flags: FlagWithConfigs[] }>(
        `/api/v1/projects/${activeProject.id}/flags`,
      );
      setFlags(loaded);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load flags");
    }
  }, [activeProject]);

  useEffect(() => {
    setFlags(null);
    void load();
  }, [load]);

  const environments = useMemo(
    () =>
      activeProject
        ? [...activeProject.environments].sort(
            (a, b) => ENV_ORDER.indexOf(a.slug) - ENV_ORDER.indexOf(b.slug),
          )
        : [],
    [activeProject],
  );

  if (!activeProject) {
    return (
      <EmptyState
        title="No project yet"
        body="Create your first project to start shipping flags."
        action={<CreateProjectButton />}
      />
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-[28px] font-semibold tracking-[-0.01em]">Flags</h1>
          <p className="mt-0.5 text-[14px] text-ink-muted">
            {activeProject.name}
            {flags ? `, ${flags.length} flag${flags.length === 1 ? "" : "s"}` : null}
            {!flags ? (
              <>
                {", "}
                <span className="inline-block h-3.5 w-12 translate-y-0.5 animate-pulse rounded-md bg-muted align-middle" />
              </>
            ) : null}
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>New flag</Button>
      </div>

      <ErrorNote message={error} />

      {!flags ? (
        <DataTableSkeleton columns={FLAG_COLUMNS} />
      ) : flags.length === 0 ? (
        <EmptyState
          title="Ship your first flag"
          body="Flags are created with configs in every environment, disabled by default."
          action={<Button onClick={() => setDialogOpen(true)}>New flag</Button>}
        />
      ) : (
        <DataTable columns={FLAG_COLUMNS}>
          {flags.map((flag) => {
                const lastUpdated = flag.configs.reduce<string | null>(
                  (latest, config) =>
                    !latest || config.updatedAt > latest ? config.updatedAt : latest,
                  null,
                );
                return (
                  <tr
                    key={flag.id}
                    className="cursor-pointer border-t border-line transition-colors hover:bg-surface/60"
                    onClick={() => router.push(`/flags/${flag.id}`)}
                  >
                    <td className="px-5 py-3.5">
                      <Link
                        href={`/flags/${flag.id}`}
                        className="font-mono text-[13px] font-medium"
                        onClick={(event) => event.stopPropagation()}
                      >
                        {flag.key}
                      </Link>
                    </td>
                    <td className="px-5 py-3.5">{flag.name}</td>
                    <td className="px-5 py-3.5">
                      <Chip color={KIND_COLORS[flag.kind]} className="!px-2.5 !py-0.5 text-[12px]">
                        {flag.kind}
                      </Chip>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        {environments.map((env) => {
                          const config = flag.configs.find((c) => c.environmentId === env.id);
                          const dotColor = config?.killed
                            ? "bg-chip-pink"
                            : config?.enabled
                              ? "bg-chip-green"
                              : "bg-line-strong";
                          const state = config?.killed
                            ? "killed"
                            : config?.enabled
                              ? `on · ${config.rolloutPct}%`
                              : "off";
                          return (
                            <span
                              key={env.id}
                              title={`${env.slug}: ${state}`}
                              className="flex items-center gap-1 text-[11px] text-ink-muted"
                            >
                              <span className={`h-2 w-2 rounded-full ${dotColor}`} />
                              {env.slug}
                            </span>
                          );
                        })}
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-[13px] text-ink-muted">
                      {lastUpdated ? <RelativeTime iso={lastUpdated} /> : "-"}
                    </td>
                  </tr>
                );
              })}
        </DataTable>
      )}

      <NewFlagDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        projectId={activeProject.id}
        onCreated={(flag) => {
          setDialogOpen(false);
          router.push(`/flags/${flag.id}`);
        }}
      />
    </div>
  );
}

function CreateProjectButton() {
  const { refreshProjects } = useApp();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api("/api/v1/projects", {
        method: "POST",
        body: JSON.stringify({ name, slug: slug || slugifyProjectSlug(name) }),
      });
      await refreshProjects();
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create project");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>Create project</Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="New project">
        <form onSubmit={(event) => void submit(event)} className="space-y-4">
          <Field label="Name">
            <input
              className={inputClass}
              value={name}
              required
              onChange={(event) => {
                setName(event.target.value);
                if (!slugTouched) setSlug(slugifyProjectSlug(event.target.value));
              }}
              placeholder="My App"
            />
          </Field>
          <Field label="Slug" hint="Used in SDK snapshots and API lookups.">
            <input
              className={`${inputClass} font-mono`}
              value={slug}
              required
              onChange={(event) => {
                setSlugTouched(true);
                setSlug(slugifyProjectSlug(event.target.value));
              }}
              placeholder="my-app"
            />
          </Field>
          <ErrorNote message={error} />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy || !name}>
              {busy ? "Creating…" : "Create project"}
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}

function NewFlagDialog({
  open,
  onClose,
  projectId,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  projectId: string;
  onCreated: (flag: ApiFlag) => void;
}) {
  const [name, setName] = useState("");
  const [key, setKey] = useState("");
  const [keyTouched, setKeyTouched] = useState(false);
  const [kind, setKind] = useState<ApiFlag["kind"]>("boolean");
  const [description, setDescription] = useState("");
  const [defaultValueText, setDefaultValueText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      let defaultValue: unknown;
      if (kind !== "boolean" && defaultValueText.trim().length > 0) {
        if (kind === "string") {
          defaultValue = defaultValueText;
        } else {
          try {
            defaultValue = JSON.parse(defaultValueText);
          } catch {
            throw new Error("Default value must be valid JSON");
          }
          if (kind === "number" && typeof defaultValue !== "number") {
            throw new Error("Default value must be a number");
          }
        }
      }
      const { flag } = await api<{ flag: ApiFlag }>(`/api/v1/projects/${projectId}/flags`, {
        method: "POST",
        body: JSON.stringify({
          key: key || slugifyFlagKey(name),
          name,
          kind,
          ...(description ? { description } : {}),
          ...(defaultValue !== undefined ? { defaultValue } : {}),
        }),
      });
      setName("");
      setKey("");
      setKeyTouched(false);
      setDescription("");
      setDefaultValueText("");
      onCreated(flag);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create flag");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="New flag">
      <form onSubmit={(event) => void submit(event)} className="space-y-4">
        <Field label="Name">
          <input
            className={inputClass}
            value={name}
            required
            autoFocus
            onChange={(event) => {
              setName(event.target.value);
              if (!keyTouched) setKey(slugifyFlagKey(event.target.value));
            }}
            placeholder="New checkout flow"
          />
        </Field>
        <Field label="Key" hint="What your code evaluates. Immutable once created.">
          <input
            className={`${inputClass} font-mono`}
            value={key}
            required
            onChange={(event) => {
              setKeyTouched(true);
              setKey(slugifyFlagKey(event.target.value));
            }}
            placeholder="new-checkout-flow"
          />
        </Field>
        <Field label="Kind">
          <select
            className={inputClass}
            value={kind}
            onChange={(event) => setKind(event.target.value as ApiFlag["kind"])}
          >
            <option value="boolean">boolean, on/off</option>
            <option value="string">string, variant names, copy</option>
            <option value="number">number, limits, percentages</option>
            <option value="json">json, structured config</option>
          </select>
        </Field>
        {kind !== "boolean" ? (
          <Field
            label="Default value"
            hint={kind === "string" ? "Plain text." : "Valid JSON."}
          >
            <input
              className={`${inputClass} font-mono`}
              value={defaultValueText}
              onChange={(event) => setDefaultValueText(event.target.value)}
              placeholder={kind === "string" ? "control" : kind === "number" ? "0" : "{}"}
            />
          </Field>
        ) : null}
        <Field label="Description">
          <textarea
            className={`${textareaClass} !font-sans`}
            rows={2}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="What does this flag gate?"
          />
        </Field>
        <ErrorNote message={error} />
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy || !name || !(key || slugifyFlagKey(name))}>
            {busy ? "Creating…" : "Create flag"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
