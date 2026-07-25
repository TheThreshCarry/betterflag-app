"use client";

import { useDebounce } from "@uidotdev/usehooks";
import { Check, ChevronDown, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useState,
  type FormEvent,
  type MouseEvent,
} from "react";

import { useApp } from "@/components/app-shell";
import {
  Button,
  Chip,
  Dialog,
  EmptyState,
  ErrorNote,
  Field,
  RelativeTime,
  Spinner,
  Toggle,
  inputClass,
  textareaClass,
  type ChipColor,
} from "@/components/ui";
import {
  DataTable,
  TableCell,
  TableRow,
  type Column,
} from "@/components/data-table";
import { Stagger } from "@/components/stagger";
import { VersionHistoryBadge } from "@/components/version-history-badge";
import type { ApiEnvironment, ApiFlag, ApiFlagConfig } from "@/lib/api-types";
import { api, ApiClientError } from "@/lib/client-api";
import { staggerStyle } from "@/lib/stagger";
import { flagEnvDescription, toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

const FLAG_EXPAND_MS = 400;

type FlagWithConfigs = ApiFlag & { configs: ApiFlagConfig[] };

const FLAG_COLUMNS: readonly Column[] = [
  { key: "key", label: "Key", colWidth: "w-[20%]", skeletonWidth: "w-24" },
  { key: "name", label: "Name", colWidth: "w-[28%]", skeletonWidth: "w-32" },
  { key: "kind", label: "Kind", colWidth: "w-[12%]", skeletonWidth: "w-14" },
  { key: "enabled", label: "Enabled", colWidth: "w-[14%]", skeletonWidth: "w-12" },
  { key: "updated", label: "Updated", colWidth: "w-[18%]", skeletonWidth: "w-16" },
  { key: "expand", label: "", colWidth: "w-[8%]", skeletonWidth: "w-6" },
];

export const KIND_COLORS: Record<ApiFlag["kind"], ChipColor> = {
  boolean: "blue",
  string: "orange",
  number: "green",
  json: "pink",
};

/** Flag keys: lowercase letters + digits only (no hyphens or other specials). */
export function slugifyFlagKey(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "")
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
  const { activeProject, activeEnv } = useApp();
  const router = useRouter();
  const [flags, setFlags] = useState<FlagWithConfigs[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

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
    setExpandedId(null);
    void load();
  }, [load]);

  // Close expand when env changes — config context shifts.
  useEffect(() => {
    setExpandedId(null);
  }, [activeEnv?.id]);

  // Every flag exists in every environment (configs are created for all of
  // them, disabled by default), so the list is project-wide. Env state is
  // scoped via the global env switcher, not a per-row env column.
  const visibleFlags = flags;

  function patchFlagConfig(flagId: string, next: ApiFlagConfig) {
    setFlags((current) => {
      if (!current) return current;
      return current.map((flag) => {
        if (flag.id !== flagId) return flag;
        return {
          ...flag,
          configs: flag.configs.map((config) =>
            config.id === next.id ? next : config,
          ),
        };
      });
    });
  }

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
    <>
      <Stagger>
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-[28px] font-semibold tracking-[-0.01em]">Flags</h1>
            <p className="mt-0.5 text-[14px] text-ink-muted">
              {activeProject.name}
              {activeEnv ? ` · ${activeEnv.name}` : null}
              {visibleFlags
                ? `, ${visibleFlags.length} flag${visibleFlags.length === 1 ? "" : "s"}`
                : null}
              {!visibleFlags ? (
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

        <DataTable
          columns={FLAG_COLUMNS}
          hoverableRows
          stagger={false}
          staggerSelf
          loading={!flags || !visibleFlags}
          empty={
            flags && flags.length === 0 ? (
              <EmptyState
                title="Ship your first flag"
                body="Flags are created with configs in every environment, disabled by default."
                action={<Button onClick={() => setDialogOpen(true)}>New flag</Button>}
              />
            ) : undefined
          }
        >
          {(visibleFlags ?? []).map((flag, index) => (
            <FlagRow
              key={flag.id}
              flag={flag}
              activeEnv={activeEnv}
              expanded={expandedId === flag.id}
              staggerIndex={index}
              onToggleExpand={() =>
                setExpandedId((current) => (current === flag.id ? null : flag.id))
              }
              onConfigPatched={(config) => patchFlagConfig(flag.id, config)}
              onOpen={() => router.push(`/flags/${encodeURIComponent(flag.key)}`)}
              onError={setError}
            />
          ))}
        </DataTable>
      </Stagger>

      <NewFlagDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        projectId={activeProject.id}
        onCreated={(flag) => {
          setDialogOpen(false);
          router.push(`/flags/${encodeURIComponent(flag.key)}`);
        }}
      />
    </>
  );
}

function FlagRow({
  flag,
  activeEnv,
  expanded,
  staggerIndex,
  onToggleExpand,
  onConfigPatched,
  onOpen,
  onError,
}: {
  flag: FlagWithConfigs;
  activeEnv: ApiEnvironment | null;
  expanded: boolean;
  staggerIndex: number;
  onToggleExpand: () => void;
  onConfigPatched: (config: ApiFlagConfig) => void;
  onOpen: () => void;
  onError: (message: string | null) => void;
}) {
  const config = activeEnv
    ? flag.configs.find((c) => c.environmentId === activeEnv.id) ?? null
    : null;
  const [toggling, setToggling] = useState(false);
  /** Keep expand row mounted through close animation. */
  const [expandMounted, setExpandMounted] = useState(false);
  /** Separate from mount so 0fr→1fr can paint and animate. */
  const [expandOpen, setExpandOpen] = useState(false);

  useEffect(() => {
    if (expanded) {
      setExpandMounted(true);
      const frame = window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => setExpandOpen(true));
      });
      return () => window.cancelAnimationFrame(frame);
    }
    setExpandOpen(false);
    const timer = window.setTimeout(() => setExpandMounted(false), FLAG_EXPAND_MS);
    return () => window.clearTimeout(timer);
  }, [expanded]);

  async function setEnabled(next: boolean) {
    if (!activeEnv || !config || toggling) return;
    setToggling(true);
    onError(null);
    try {
      const { config: updated } = await api<{ config: ApiFlagConfig }>(
        `/api/v1/flags/${flag.id}/environments/${activeEnv.slug}/config`,
        {
          method: "PUT",
          body: JSON.stringify({
            enabled: next,
            expectedVersion: config.version,
          }),
        },
      );
      onConfigPatched(updated);
      toast.success({
        title: next ? "Flag enabled" : "Flag disabled",
        description: flagEnvDescription(flag.key, activeEnv.slug),
      });
    } catch (err) {
      if (err instanceof ApiClientError && err.status === 409) {
        onError("Config changed elsewhere — refresh and try again.");
      } else {
        onError(err instanceof Error ? err.message : "Failed to update flag");
      }
    } finally {
      setToggling(false);
    }
  }

  function stopRowNav(event: MouseEvent) {
    event.stopPropagation();
  }

  return (
    <>
      <TableRow
        className="cursor-pointer stagger-in"
        style={staggerStyle(staggerIndex)}
        onClick={onOpen}
      >
        <TableCell className="truncate">
          <Link
            href={`/flags/${encodeURIComponent(flag.key)}`}
            className="font-mono text-[13px] font-medium"
            onClick={stopRowNav}
          >
            {flag.key}
          </Link>
        </TableCell>
        <TableCell className="truncate text-foreground-strong">{flag.name}</TableCell>
        <TableCell className="whitespace-nowrap">
          <Chip color={KIND_COLORS[flag.kind]} className="!px-2.5 !py-0.5 text-[12px]">
            {flag.kind}
          </Chip>
        </TableCell>
        <TableCell onClick={stopRowNav}>
          {!activeEnv || !config ? (
            <span className="text-[12px] text-ink-muted">—</span>
          ) : config.killed ? (
            <Chip color="pink" className="!px-2 !py-0 text-[11px]">
              killed
            </Chip>
          ) : flag.kind === "boolean" ? (
            <Toggle
              checked={config.enabled}
              loading={toggling}
              label={config.enabled ? `Disable ${flag.key}` : `Enable ${flag.key}`}
              onChange={(next) => void setEnabled(next)}
            />
          ) : (
            <span className="text-[12px] text-ink-muted">
              {config.enabled ? `on · ${config.rolloutPct}%` : "off"}
            </span>
          )}
        </TableCell>
        <TableCell className="whitespace-nowrap text-foreground-muted">
          {config?.updatedAt ? <RelativeTime iso={config.updatedAt} /> : "—"}
        </TableCell>
        <TableCell className="text-end" onClick={stopRowNav}>
          <button
            type="button"
            aria-expanded={expanded}
            aria-label={expanded ? "Collapse flag details" : "Expand flag details"}
            onClick={onToggleExpand}
            className="inline-flex size-8 items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-canvas hover:text-ink"
          >
            <ChevronDown
              className={cn(
                "size-4 transition-transform duration-[400ms] ease-out",
                expandOpen && "rotate-180",
              )}
              aria-hidden
            />
          </button>
        </TableCell>
      </TableRow>
      {expandMounted ? (
        <TableRow className="hover:bg-transparent!">
          <TableCell colSpan={FLAG_COLUMNS.length} className="border-0 bg-transparent p-0!">
            <div className="flag-row-expand" data-open={expandOpen ? "true" : "false"}>
              <div className="flag-row-expand-inner">
                <div className="bg-surface/60 px-4 py-4">
                  <FlagQuickPanel
                    flag={flag}
                    config={config}
                    envSlug={activeEnv?.slug ?? null}
                    toggling={toggling}
                    onSetEnabled={(next) => void setEnabled(next)}
                    onOpen={onOpen}
                  />
                </div>
              </div>
            </div>
          </TableCell>
        </TableRow>
      ) : null}
    </>
  );
}

function FlagQuickPanel({
  flag,
  config,
  envSlug,
  toggling,
  onSetEnabled,
  onOpen,
}: {
  flag: FlagWithConfigs;
  config: ApiFlagConfig | null;
  envSlug: string | null;
  toggling: boolean;
  onSetEnabled: (next: boolean) => void;
  onOpen: () => void;
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 space-y-2">
        <div>
          <p className="font-mono text-[13px] font-medium">{flag.key}</p>
          <p className="mt-0.5 text-[14px] text-ink">{flag.name}</p>
          <p className="mt-1 text-[13px] text-ink-muted">
            {flag.description?.trim() || "No description."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-ink-muted">
          <span>
            Kind{" "}
            <span className="text-ink">{flag.kind}</span>
          </span>
          {envSlug ? (
            <span>
              Env{" "}
              <span className="font-mono text-ink">{envSlug}</span>
            </span>
          ) : null}
          {config && envSlug ? (
            <>
              <span className="inline-flex items-center gap-1">
                Version{" "}
                <VersionHistoryBadge
                  flagId={flag.id}
                  flagKey={flag.key}
                  envSlug={envSlug}
                  version={config.version}
                  className="text-ink"
                />
              </span>
              <span>
                Rollout{" "}
                <span className="font-mono text-ink">{config.rolloutPct}%</span>
              </span>
              {config.killed ? (
                <Chip color="pink" className="!px-2 !py-0 text-[11px]">
                  kill switch on
                </Chip>
              ) : null}
            </>
          ) : (
            <span>No config for this environment.</span>
          )}
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        {config && !config.killed ? (
          <div className="flex items-center gap-2 rounded-2xl border border-line bg-canvas px-3 py-2">
            <span className="text-[12px] text-ink-muted">Enabled</span>
            <Toggle
              checked={config.enabled}
              loading={toggling}
              label={config.enabled ? `Disable ${flag.key}` : `Enable ${flag.key}`}
              onChange={onSetEnabled}
            />
          </div>
        ) : null}
        <Button variant="secondary" size="sm" onClick={onOpen}>
          Open flag
        </Button>
      </div>
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
      toast.success({ title: "Project created", description: name });
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
            <Button type="submit" loading={busy} disabled={!name}>
              {busy ? "Creating…" : "Create project"}
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}

type KeyAvailability = "idle" | "checking" | "available" | "taken" | "invalid";

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
  const [keyAvailability, setKeyAvailability] = useState<KeyAvailability>("idle");

  const effectiveKey = key || slugifyFlagKey(name);
  const debouncedKey = useDebounce(effectiveKey, 400);
  const keyPending = effectiveKey.length > 0 && effectiveKey !== debouncedKey;
  const checking = keyPending || keyAvailability === "checking";

  useEffect(() => {
    if (!open) {
      setName("");
      setKey("");
      setKeyTouched(false);
      setKind("boolean");
      setDescription("");
      setDefaultValueText("");
      setBusy(false);
      setError(null);
      setKeyAvailability("idle");
    }
  }, [open]);

  useEffect(() => {
    if (!open || debouncedKey.length === 0) {
      setKeyAvailability("idle");
      return;
    }
    if (!/^[a-z0-9]+$/.test(debouncedKey)) {
      setKeyAvailability("invalid");
      return;
    }

    let cancelled = false;
    setKeyAvailability("checking");
    void api<{ flags: ApiFlag[] }>(
      `/api/v1/projects/${projectId}/flags?key=${encodeURIComponent(debouncedKey)}`,
    )
      .then(({ flags }) => {
        if (cancelled) return;
        setKeyAvailability(flags.length > 0 ? "taken" : "available");
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setKeyAvailability("idle");
        toast.error({
          title: "Couldn't check key",
          description:
            err instanceof Error ? err.message : "Try again in a moment.",
        });
      });

    return () => {
      cancelled = true;
    };
  }, [debouncedKey, open, projectId]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (keyAvailability === "taken" || checking) return;
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
      const flagKey = key || slugifyFlagKey(name);
      const { flag } = await api<{ flag: ApiFlag }>(`/api/v1/projects/${projectId}/flags`, {
        method: "POST",
        body: JSON.stringify({
          key: flagKey,
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
      setKeyAvailability("idle");
      toast.success({ title: "Flag created", description: flag.key });
      onCreated(flag);
    } catch (err) {
      if (err instanceof ApiClientError && err.code === "conflict") {
        setKeyAvailability("taken");
        toast.error({
          title: "Flag key already taken",
          description: `A flag with key “${effectiveKey}” already exists in this project.`,
        });
        return;
      }
      const message = err instanceof Error ? err.message : "Failed to create flag";
      setError(message);
      toast.error({ title: "Couldn't create flag", description: message });
    } finally {
      setBusy(false);
    }
  }

  const nameStatusMessage =
    keyAvailability === "taken"
      ? `Key “${debouncedKey}” is already taken.`
      : keyAvailability === "invalid"
        ? "Key may only contain letters and numbers."
        : null;

  return (
    <Dialog open={open} onClose={onClose} title="New flag">
      <form onSubmit={(event) => void submit(event)} className="space-y-4">
        <Field label="Name">
          <div className="relative">
            <input
              className={cn(inputClass, "pr-9")}
              value={name}
              required
              autoFocus
              onChange={(event) => {
                setName(event.target.value);
                if (!keyTouched) setKey(slugifyFlagKey(event.target.value));
              }}
              placeholder="New checkout flow"
              aria-invalid={keyAvailability === "taken" || keyAvailability === "invalid"}
              aria-describedby={nameStatusMessage ? "flag-name-status" : undefined}
            />
            <span
              className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center"
              aria-hidden
            >
              {effectiveKey.length === 0 ? null : checking ? (
                <Spinner size={14} className="text-ink-muted" />
              ) : keyAvailability === "available" ? (
                <Check className="size-3.5 text-chip-green" strokeWidth={2.5} />
              ) : keyAvailability === "taken" || keyAvailability === "invalid" ? (
                <X className="size-3.5 text-chip-pink" strokeWidth={2.5} />
              ) : null}
            </span>
          </div>
          {nameStatusMessage ? (
            <p id="flag-name-status" className="mt-1 text-[12px] text-chip-pink">
              {nameStatusMessage}
            </p>
          ) : null}
        </Field>
        <Field
          label="Key"
          hint="What your code evaluates. Letters and numbers only. Immutable once created."
        >
          <input
            className={`${inputClass} font-mono`}
            value={key}
            required
            onChange={(event) => {
              setKeyTouched(true);
              setKey(slugifyFlagKey(event.target.value));
            }}
            placeholder="newcheckoutflow"
            pattern="[a-z0-9]+"
            title="Letters and numbers only"
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
          <Button
            type="submit"
            loading={busy}
            disabled={
              !name ||
              !effectiveKey ||
              checking ||
              keyAvailability === "taken" ||
              keyAvailability === "invalid"
            }
          >
            {busy ? "Creating…" : "Create flag"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
