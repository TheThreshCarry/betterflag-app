"use client";

import {
  RULE_NAME_MAX,
  targetingRulesSchema,
  type JsonValue,
  type RuleOperator,
  type TargetingRule,
} from "@betterflag/core";
import { useDebounce } from "@uidotdev/usehooks";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQueryStates } from "nuqs";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useApp } from "@/components/app-shell";
import {
  AnalyticsMapPanel,
  SoftRefresh,
  formatCount,
} from "@/components/analytics-view";
import { SparklineArea, StackedAreaChart } from "@/components/charts";
import { FlagEvaluateCard } from "@/components/evaluate-snippet";
import { KIND_COLORS } from "@/components/flags-view";
import { VersionHistoryBadge } from "@/components/version-history-badge";
import { Slider } from "@appica/ui-react/slider";

import {
  Button,
  Chip,
  Dialog,
  ErrorNote,
  Field,
  RelativeTime,
  Toggle,
  inputClass,
  textareaClass,
} from "@/components/ui";
import { FlagDetailSkeleton } from "@/components/skeletons";
import { Stagger } from "@/components/stagger";
import { Skeleton } from "@/components/ui/skeleton";
import type {
  AnalyticsPeriod,
  ApiAnalytics,
  ApiFlag,
  ApiFlagConfig,
  ApiFlagConfigWithEnv,
  ApiStats,
  StatsPoint,
} from "@/lib/api-types";
import { api, ApiClientError } from "@/lib/client-api";
import { analyticsSearchParams } from "@/lib/search-params";
import { flagEnvDescription, toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

interface FlagDetailResponse {
  flag: ApiFlag;
  project: { id: string; name: string; slug: string };
  configs: ApiFlagConfigWithEnv[];
}

const ENV_ORDER = ["dev", "staging", "prod"];

const OPERATORS: { value: RuleOperator; label: string }[] = [
  { value: "eq", label: "equals" },
  { value: "neq", label: "not equals" },
  { value: "in", label: "in list" },
  { value: "not_in", label: "not in list" },
  { value: "contains", label: "contains" },
  { value: "gt", label: ">" },
  { value: "gte", label: ">=" },
  { value: "lt", label: "<" },
  { value: "lte", label: "<=" },
  { value: "semver_eq", label: "semver =" },
  { value: "semver_gt", label: "semver >" },
  { value: "semver_lt", label: "semver <" },
];

interface EditableCondition {
  attribute: string;
  op: RuleOperator;
  valueText: string;
}

interface EditableRule {
  id: string;
  name: string;
  description: string;
  conditions: EditableCondition[];
  serve: "on" | "off";
  rolloutPctText: string;
}

function conditionValueToText(value: JsonValue): string {
  return typeof value === "string" ? value : JSON.stringify(value);
}

function textToConditionValue(text: string): JsonValue {
  const trimmed = text.trim();
  if (trimmed.length === 0) return "";
  try {
    return JSON.parse(trimmed) as JsonValue;
  } catch {
    return text;
  }
}

function parseRules(rules: JsonValue): TargetingRule[] {
  const parsed = targetingRulesSchema.safeParse(rules);
  return parsed.success ? parsed.data : [];
}

function namesEqual(a: string | undefined, b: string | undefined): boolean {
  return (a ?? "").trim() === (b ?? "").trim();
}

function overlayRuleNames(saved: TargetingRule[], local: EditableRule[]): TargetingRule[] {
  const names = new Map(local.map((rule) => [rule.id, rule.name.trim().slice(0, RULE_NAME_MAX)]));
  return saved.map((rule) => {
    const next: TargetingRule = { ...rule };
    const name = names.get(rule.id) ?? "";
    if (name.length > 0) next.name = name;
    else delete next.name;
    return next;
  });
}

function namesFromRules(rules: TargetingRule[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const rule of rules) out[rule.id] = rule.name ?? "";
  return out;
}

function rulesToEditable(rules: JsonValue): EditableRule[] {
  return parseRules(rules).map((rule) => ({
    id: rule.id,
    name: rule.name ?? "",
    description: rule.description ?? "",
    conditions: rule.conditions.map((condition) => ({
      attribute: condition.attribute,
      op: condition.op,
      valueText: conditionValueToText(condition.value),
    })),
    serve: rule.serve,
    rolloutPctText: rule.rolloutPct === undefined ? "" : String(rule.rolloutPct),
  }));
}

function editableToRules(editable: EditableRule[]): TargetingRule[] {
  return editable.map((rule, index) => {
    const out: TargetingRule = {
      id: rule.id,
      conditions: rule.conditions
        .filter((condition) => condition.attribute.trim().length > 0)
        .map((condition) => ({
          attribute: condition.attribute.trim(),
          op: condition.op,
          value: textToConditionValue(condition.valueText),
        })),
      serve: rule.serve,
    };
    const name = rule.name.trim().slice(0, RULE_NAME_MAX);
    if (name.length > 0) out.name = name;
    if (rule.description.trim().length > 0) out.description = rule.description.trim();
    if (rule.rolloutPctText.trim().length > 0) {
      const pct = Number(rule.rolloutPctText);
      if (!Number.isInteger(pct) || pct < 0 || pct > 100) {
        throw new Error(`Rule ${index + 1}: rollout must be an integer between 0 and 100`);
      }
      out.rolloutPct = pct;
    }
    return out;
  });
}

function newRuleId(): string {
  return `r_${Math.random().toString(36).slice(2, 10)}`;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function FlagDetail({ flagKey }: { flagKey: string }) {
  const router = useRouter();
  const [data, setData] = useState<FlagDetailResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const { activeEnv, activeProject } = useApp();

  const load = useCallback(async () => {
    // Legacy UUID bookmarks: load by id, then rewrite URL to the key slug.
    if (UUID_RE.test(flagKey)) {
      try {
        const response = await api<FlagDetailResponse>(`/api/v1/flags/${flagKey}`);
        setData(response);
        setError(null);
        router.replace(`/flags/${encodeURIComponent(response.flag.key)}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load flag");
      }
      return;
    }

    if (!activeProject) return;

    try {
      const response = await api<FlagDetailResponse>(
        `/api/v1/flags/lookup?projectSlug=${encodeURIComponent(activeProject.slug)}&key=${encodeURIComponent(flagKey)}`,
      );
      setData(response);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load flag");
    }
  }, [flagKey, activeProject, router]);

  useEffect(() => {
    setData(null);
    setError(null);
    void load();
  }, [load]);

  if (error) return <ErrorNote message={error} />;
  if (!data) return <FlagDetailSkeleton />;

  const { flag, project } = data;
  const configs = [...data.configs].sort(
    (a, b) =>
      ENV_ORDER.indexOf(a.environment?.slug ?? "") - ENV_ORDER.indexOf(b.environment?.slug ?? ""),
  );
  // Scope to the environment chosen in the sidebar; fall back to all envs if
  // the active env has no config row for this flag.
  const scoped = activeEnv
    ? configs.filter((c) => c.environment?.slug === activeEnv.slug)
    : configs;
  const shownConfigs = scoped.length > 0 ? scoped : configs;

  return (
    <>
      <Stagger>
        <div className="mb-2 text-[13px] text-ink-muted">
          <Link href="/flags" className="hover:text-ink">
            Flags
          </Link>{" "}
          / <span className="font-mono text-[12px]">{flag.key}</span>
        </div>

        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="font-mono text-[24px] font-semibold">{flag.key}</h1>
              <Chip color={KIND_COLORS[flag.kind]} className="!px-2.5 !py-0.5 text-[12px]">
                {flag.kind}
              </Chip>
              {flag.archivedAt ? (
                <Chip color="gray" className="!px-2.5 !py-0.5 text-[12px]">
                  archived
                </Chip>
              ) : null}
            </div>
            <p className="mt-1 text-[15px] font-medium">{flag.name}</p>
            {flag.description ? (
              <p className="mt-1 max-w-2xl text-[14px] text-ink-muted">{flag.description}</p>
            ) : null}
          </div>
          <div className="flex shrink-0 gap-2">
            <Button variant="secondary" size="sm" onClick={() => setEditOpen(true)}>
              Edit
            </Button>
            <Button variant="primary" size="sm" onClick={() => setArchiveOpen(true)}>
              Archive
            </Button>
          </div>
        </div>

        {shownConfigs.map((config) => (
          <EnvConfigCard key={config.id} flag={flag} config={config} onRefresh={load} />
        ))}

        {shownConfigs[0]?.environment ? (
          <>
            <FlagEvaluateCard
              flagKey={flag.key}
              envSlug={shownConfigs[0].environment.slug}
              envName={shownConfigs[0].environment.name}
            />
            <FlagAnalytics
              flagId={flag.id}
              flagKey={flag.key}
              projectId={project.id}
              envSlug={shownConfigs[0].environment.slug}
            />
          </>
        ) : null}
      </Stagger>

      <EditFlagDialog
        open={editOpen}
        onClose={() => setEditOpen(false)}
        flag={flag}
        onSaved={() => {
          setEditOpen(false);
          toast.success({ title: "Flag saved" });
          void load();
        }}
      />

      <Dialog open={archiveOpen} onClose={() => setArchiveOpen(false)} title="Archive flag?">
        <p className="text-[14px] text-ink-muted">
          <span className="font-mono text-[13px] text-ink">{flag.key}</span> will be removed from
          every environment snapshot in <span className="font-medium text-ink">{project.name}</span>.
          SDKs will fall back to code-level defaults. This is a soft archive, the audit history
          stays.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setArchiveOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={() => {
              void api(`/api/v1/flags/${flag.id}`, { method: "DELETE" }).then(() => {
                toast.success({ title: "Flag archived", description: flag.key });
                router.push("/flags");
              });
            }}
          >
            Archive flag
          </Button>
        </div>
      </Dialog>
    </>
  );
}

function EditFlagDialog({
  open,
  onClose,
  flag,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  flag: ApiFlag;
  onSaved: () => void;
}) {
  const [name, setName] = useState(flag.name);
  const [description, setDescription] = useState(flag.description);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName(flag.name);
      setDescription(flag.description);
      setError(null);
    }
  }, [open, flag]);

  return (
    <Dialog open={open} onClose={onClose} title="Edit flag">
      <div className="space-y-4">
        <Field label="Name">
          <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Description">
          <textarea
            className={`${textareaClass} !font-sans`}
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </Field>
        <ErrorNote message={error} />
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            loading={busy}
            disabled={name.trim().length === 0}
            onClick={() => {
              setBusy(true);
              setError(null);
              void api(`/api/v1/flags/${flag.id}`, {
                method: "PATCH",
                body: JSON.stringify({ name, description }),
              })
                .then(onSaved)
                .catch((err: unknown) =>
                  setError(err instanceof Error ? err.message : "Failed to save"),
                )
                .finally(() => setBusy(false));
            }}
          >
            {busy ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

function EnvConfigCard({
  flag,
  config,
  onRefresh,
}: {
  flag: ApiFlag;
  config: ApiFlagConfigWithEnv;
  onRefresh: () => Promise<void>;
}) {
  const envSlug = config.environment?.slug ?? "?";
  const envName = config.environment?.name ?? envSlug;

  const [enabled, setEnabled] = useState(config.enabled);
  const [rolloutPct, setRolloutPct] = useState(config.rolloutPct);
  const [rules, setRules] = useState<EditableRule[]>(() => rulesToEditable(config.rules));
  const [valueOnText, setValueOnText] = useState(() => valueToText(flag.kind, config.valueOn));
  const [valueOffText, setValueOffText] = useState(() => valueToText(flag.kind, config.valueOff));
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [killOpen, setKillOpen] = useState(false);
  const [savedNames, setSavedNames] = useState<Record<string, string>>(() =>
    namesFromRules(parseRules(config.rules)),
  );

  const versionRef = useRef(config.version);
  const savedRulesRef = useRef<TargetingRule[]>(parseRules(config.rules));
  const rulesRef = useRef(rules);
  rulesRef.current = rules;
  const conflictRef = useRef(false);
  const nameSaveChain = useRef(Promise.resolve());

  useEffect(() => {
    setEnabled(config.enabled);
    setRolloutPct(config.rolloutPct);
    setRules(rulesToEditable(config.rules));
    setValueOnText(valueToText(flag.kind, config.valueOn));
    setValueOffText(valueToText(flag.kind, config.valueOff));
    setDirty(false);
    setConflict(false);
    setError(null);
    versionRef.current = config.version;
    savedRulesRef.current = parseRules(config.rules);
    conflictRef.current = false;
    setSavedNames(namesFromRules(savedRulesRef.current));
  }, [config, flag.kind]);

  function touch() {
    setDirty(true);
  }

  function markConflict() {
    conflictRef.current = true;
    setConflict(true);
  }

  function persistRuleNames() {
    nameSaveChain.current = nameSaveChain.current
      .catch(() => undefined)
      .then(async () => {
        if (conflictRef.current) return;
        const saved = savedRulesRef.current;
        const nextRules = overlayRuleNames(saved, rulesRef.current);
        const unchanged = saved.every(
          (rule, index) =>
            rule.id === nextRules[index]?.id && namesEqual(rule.name, nextRules[index]?.name),
        );
        if (unchanged) return;

        try {
          const result = await api<{ config: ApiFlagConfig }>(
            `/api/v1/flags/${flag.id}/environments/${envSlug}/config`,
            {
              method: "PUT",
              body: JSON.stringify({
                rules: nextRules,
                expectedVersion: versionRef.current,
              }),
            },
          );
          versionRef.current = result.config.version;
          savedRulesRef.current = parseRules(result.config.rules);
          setSavedNames(namesFromRules(savedRulesRef.current));
        } catch (err) {
          if (err instanceof ApiClientError && err.status === 409) {
            markConflict();
          } else {
            toast.error({
              title: "Couldn't save rule name",
              description: err instanceof Error ? err.message : "Failed to save",
            });
          }
          throw err;
        }
      });
    return nameSaveChain.current;
  }

  async function save() {
    setBusy(true);
    setError(null);
    try {
      await nameSaveChain.current.catch(() => undefined);
      const body: Record<string, unknown> = {
        enabled,
        rolloutPct,
        rules: editableToRules(rules),
        expectedVersion: versionRef.current,
      };
      if (flag.kind !== "boolean") {
        const on = textToValue(flag.kind, valueOnText);
        const off = textToValue(flag.kind, valueOffText);
        if (on !== undefined) body.valueOn = on;
        if (off !== undefined) body.valueOff = off;
      }
      await api(`/api/v1/flags/${flag.id}/environments/${envSlug}/config`, {
        method: "PUT",
        body: JSON.stringify(body),
      });
      await onRefresh();
      toast.success({ title: "Changes saved", description: flagEnvDescription(flag.key, envSlug) });
    } catch (err) {
      if (err instanceof ApiClientError && err.status === 409) {
        markConflict();
      } else {
        setError(err instanceof Error ? err.message : "Failed to save");
      }
    } finally {
      setBusy(false);
    }
  }

  async function clearKill() {
    setBusy(true);
    setError(null);
    try {
      await api(`/api/v1/flags/${flag.id}/environments/${envSlug}/config`, {
        method: "PUT",
        body: JSON.stringify({ clearKill: true, expectedVersion: versionRef.current }),
      });
      await onRefresh();
      toast.success({
        title: "Kill switch cleared",
        description: flagEnvDescription(flag.key, envSlug),
      });
    } catch (err) {
      if (err instanceof ApiClientError && err.status === 409) {
        markConflict();
      } else {
        setError(err instanceof Error ? err.message : "Failed to clear kill");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-3xl border border-line bg-surface p-6">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Chip
            color={envSlug === "prod" ? "orange" : envSlug === "staging" ? "blue" : "gray"}
            className="!px-2.5 !py-0.5 text-[12px]"
          >
            {envSlug}
          </Chip>
          <span className="text-[15px] font-semibold">{envName}</span>
          <VersionHistoryBadge
            flagId={flag.id}
            flagKey={flag.key}
            envSlug={envSlug}
            version={config.version}
          />
        </div>
        <div className="flex items-center gap-3 text-[12px] text-ink-muted">
          <span>
            updated <RelativeTime iso={config.updatedAt} />
            {config.updatedByKeyPrefix ? (
              <>
                {" "}
                by{" "}
                <Chip color="green" className="!px-1.5 !py-0 font-mono text-[11px]">
                  {config.updatedByKeyPrefix}
                </Chip>
              </>
            ) : null}
          </span>
          {/* 24h eval sparkline + total count */}
          <EnvSparkline flagId={flag.id} envSlug={envSlug} />
        </div>
      </div>

      {config.killed ? (
        <div className="mb-4 flex items-center justify-between rounded-2xl bg-chip-pink/10 px-4 py-3">
          <p className="text-[13px] font-medium text-chip-pink">
            Kill switch active, serving OFF to everyone in {envSlug}, regardless of the config
            below.
          </p>
          <Button variant="secondary" size="sm" disabled={busy} onClick={() => void clearKill()}>
            Clear kill
          </Button>
        </div>
      ) : !config.enabled ? (
        <div className="mb-4 rounded-2xl bg-chip-gray/10 px-4 py-3">
          <p className="text-[13px] font-medium text-ink-muted">
            Disabled, everyone gets the OFF value in {envSlug}.
          </p>
        </div>
      ) : null}

      {conflict ? (
        <div className="mb-4 flex items-center justify-between rounded-2xl bg-chip-orange/10 px-4 py-3">
          <p className="text-[13px] font-medium text-chip-orange">
            This config changed elsewhere while you were editing (version conflict). Reload to get
            the latest, your unsaved edits here will be discarded.
          </p>
          <Button variant="secondary" size="sm" onClick={() => void onRefresh()}>
            Reload
          </Button>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-5">
          <div className="flex items-center justify-between rounded-2xl border border-line bg-canvas px-4 py-3">
            <div>
              <p className="text-[14px] font-medium">Enabled</p>
              <p className="text-[12px] text-ink-muted">Serve rules + rollout instead of OFF.</p>
            </div>
            <Toggle
              checked={enabled}
              label={`Enabled in ${envSlug}`}
              onChange={(next) => {
                setEnabled(next);
                touch();
              }}
            />
          </div>

          <div className="rounded-2xl border border-line bg-canvas px-4 py-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[14px] font-medium">Rollout</p>
              <span className="font-mono text-[13px] font-semibold">{rolloutPct}%</span>
            </div>
            <Slider
              min={0}
              max={100}
              step={1}
              value={[rolloutPct]}
              className="w-full"
              thumbAriaLabel="Rollout percentage"
              tooltipVisibility="never"
              onValueChange={(value) => {
                const next = Array.isArray(value) ? value[0] : value;
                setRolloutPct(Number(next ?? 0));
                touch();
              }}
            />
            <p className="mt-1.5 text-[12px] text-ink-muted">
              Percentage of users bucketed into the ON variation (after rules).
            </p>
          </div>

          {flag.kind !== "boolean" ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Value when ON" hint={valueHint(flag.kind)}>
                <textarea
                  className={textareaClass}
                  rows={3}
                  value={valueOnText}
                  onChange={(event) => {
                    setValueOnText(event.target.value);
                    touch();
                  }}
                />
              </Field>
              <Field label="Value when OFF" hint={valueHint(flag.kind)}>
                <textarea
                  className={textareaClass}
                  rows={3}
                  value={valueOffText}
                  onChange={(event) => {
                    setValueOffText(event.target.value);
                    touch();
                  }}
                />
              </Field>
            </div>
          ) : null}
        </div>

        <RulesEditor
          rules={rules}
          onChange={(next) => {
            setRules(next);
            touch();
          }}
          onNameChange={(index, name) => {
            setRules((current) =>
              current.map((rule, i) => (i === index ? { ...rule, name } : rule)),
            );
          }}
          onNamePersist={() => persistRuleNames()}
          persistedNames={savedNames}
          nameDisabled={conflict}
        />
      </div>

      <ErrorNote message={error} />

      <div className="mt-5 flex items-center justify-between border-t border-line pt-4">
        <Button variant="danger" size="sm" onClick={() => setKillOpen(true)} disabled={config.killed}>
          Kill switch
        </Button>
        <div className="flex items-center gap-3">
          {dirty ? <span className="text-[12px] text-ink-muted">Unsaved changes</span> : null}
          <Button size="sm" loading={busy} disabled={!dirty || conflict} onClick={() => void save()}>
            {busy ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </div>

      <Dialog open={killOpen} onClose={() => setKillOpen(false)} title={`Kill ${flag.key} in ${envSlug}?`}>
        <p className="text-[14px] text-ink-muted">
          The kill switch serves <span className="font-medium text-ink">OFF to everyone</span> in{" "}
          {envSlug} within seconds via the edge fast path. It survives config edits and stays on
          until someone explicitly clears it.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setKillOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="danger"
            disabled={busy}
            onClick={() => {
              setBusy(true);
              setError(null);
              void api(`/api/v1/flags/${flag.id}/environments/${envSlug}/kill`, { method: "POST" })
                .then(async () => {
                  setKillOpen(false);
                  await onRefresh();
                  toast.success({
                    title: "Kill switch activated",
                    description: flagEnvDescription(flag.key, envSlug),
                  });
                })
                .catch((err: unknown) =>
                  setError(err instanceof Error ? err.message : "Failed to kill"),
                )
                .finally(() => setBusy(false));
            }}
          >
            Kill it
          </Button>
        </div>
      </Dialog>
    </div>
  );
}

function valueToText(kind: ApiFlag["kind"], value: JsonValue | null): string {
  if (value === null) return "";
  if (kind === "string") return typeof value === "string" ? value : JSON.stringify(value);
  if (kind === "number") return typeof value === "number" ? String(value) : JSON.stringify(value);
  return JSON.stringify(value, null, 2);
}

/** undefined = leave untouched (empty input). Throws on invalid input. */
function textToValue(kind: ApiFlag["kind"], text: string): JsonValue | undefined {
  const trimmed = text.trim();
  if (trimmed.length === 0) return undefined;
  if (kind === "string") return text;
  if (kind === "number") {
    const num = Number(trimmed);
    if (Number.isNaN(num)) throw new Error(`"${trimmed}" is not a number`);
    return num;
  }
  try {
    return JSON.parse(trimmed) as JsonValue;
  } catch {
    throw new Error("Value must be valid JSON");
  }
}

function valueHint(kind: ApiFlag["kind"]): string {
  if (kind === "string") return "Plain text.";
  if (kind === "number") return "A number.";
  return "Valid JSON.";
}

function RuleNameInput({
  name,
  fallbackId,
  persistedName,
  disabled,
  onLocalChange,
  onPersist,
}: {
  name: string;
  fallbackId: string;
  persistedName: string;
  disabled?: boolean;
  onLocalChange: (name: string) => void;
  onPersist: () => Promise<unknown>;
}) {
  const debouncedName = useDebounce(name, 500);
  const lastSubmittedRef = useRef(persistedName.trim());
  const persistRef = useRef(onPersist);
  persistRef.current = onPersist;

  useEffect(() => {
    lastSubmittedRef.current = persistedName.trim();
  }, [persistedName]);

  const flush = useCallback(() => {
    const trimmed = name.trim().slice(0, RULE_NAME_MAX);
    if (trimmed === lastSubmittedRef.current) return Promise.resolve();
    lastSubmittedRef.current = trimmed;
    return persistRef.current().catch(() => {
      lastSubmittedRef.current = persistedName.trim();
    });
  }, [name, persistedName]);

  useEffect(() => {
    const trimmed = debouncedName.trim().slice(0, RULE_NAME_MAX);
    if (trimmed === lastSubmittedRef.current) return;
    lastSubmittedRef.current = trimmed;
    void persistRef.current().catch(() => {
      lastSubmittedRef.current = persistedName.trim();
    });
  }, [debouncedName, persistedName]);

  return (
    <input
      className={cn(inputClass, "!h-7 min-w-0 flex-1 !px-2 !text-[12px]")}
      value={name}
      placeholder={fallbackId}
      maxLength={RULE_NAME_MAX}
      aria-label="Rule name"
      disabled={disabled}
      onChange={(event) => onLocalChange(event.target.value.slice(0, RULE_NAME_MAX))}
      onBlur={() => {
        void flush();
      }}
    />
  );
}

function RulesEditor({
  rules,
  onChange,
  onNameChange,
  onNamePersist,
  persistedNames,
  nameDisabled,
}: {
  rules: EditableRule[];
  onChange: (rules: EditableRule[]) => void;
  onNameChange: (index: number, name: string) => void;
  onNamePersist: () => Promise<unknown>;
  persistedNames: Record<string, string>;
  nameDisabled: boolean;
}) {
  function updateRule(index: number, patch: Partial<EditableRule>) {
    onChange(rules.map((rule, i) => (i === index ? { ...rule, ...patch } : rule)));
  }

  function move(index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= rules.length) return;
    const next = [...rules];
    const [item] = next.splice(index, 1);
    if (!item) return;
    next.splice(target, 0, item);
    onChange(next);
  }

  return (
    <div className="rounded-2xl border border-line bg-canvas p-4">
      <div className="mb-3 flex items-start justify-between gap-4">
        <div>
          <p className="text-[14px] font-medium">Targeting rules</p>
          <p className="text-[12px] text-ink-muted">
            Evaluated top to bottom before the rollout. All conditions in a rule must match.
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          className="shrink-0 whitespace-nowrap"
          onClick={() =>
            onChange([
              ...rules,
              { id: newRuleId(), name: "", description: "", conditions: [], serve: "on", rolloutPctText: "" },
            ])
          }
        >
          Add rule
        </Button>
      </div>

      {rules.length === 0 ? (
        <p className="rounded-xl bg-surface px-3 py-4 text-center text-[13px] text-ink-muted">
          No rules, everyone goes through the rollout percentage.
        </p>
      ) : (
        <div className="space-y-3">
          {rules.map((rule, index) => (
            <div key={rule.id} className="rounded-xl border border-line p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <span className="shrink-0 font-mono text-[11px] text-ink-muted">#{index + 1}</span>
                  <span className="shrink-0 text-[11px] text-ink-muted">·</span>
                  <RuleNameInput
                    name={rule.name}
                    fallbackId={rule.id}
                    persistedName={persistedNames[rule.id] ?? ""}
                    disabled={nameDisabled}
                    onLocalChange={(next) => onNameChange(index, next)}
                    onPersist={onNamePersist}
                  />
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    aria-label="Move rule up"
                    className="rounded p-1 text-ink-muted hover:bg-surface disabled:opacity-30"
                    disabled={index === 0}
                    onClick={() => move(index, -1)}
                  >
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
                      <path d="M6 9V3M3 6l3-3 3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    aria-label="Move rule down"
                    className="rounded p-1 text-ink-muted hover:bg-surface disabled:opacity-30"
                    disabled={index === rules.length - 1}
                    onClick={() => move(index, 1)}
                  >
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
                      <path d="M6 3v6M3 6l3 3 3-3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    aria-label="Remove rule"
                    className="rounded p-1 text-chip-pink hover:bg-chip-pink/10"
                    onClick={() => onChange(rules.filter((_, i) => i !== index))}
                  >
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
                      <path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                    </svg>
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                {rule.conditions.map((condition, conditionIndex) => (
                  <div key={conditionIndex} className="flex items-center gap-2">
                    <input
                      className={`${inputClass} !h-8 flex-1 font-mono !text-[12px]`}
                      placeholder="attribute (e.g. userId, plan)"
                      value={condition.attribute}
                      onChange={(event) =>
                        updateRule(index, {
                          conditions: rule.conditions.map((c, i) =>
                            i === conditionIndex ? { ...c, attribute: event.target.value } : c,
                          ),
                        })
                      }
                    />
                    <select
                      className="h-8 rounded-lg border border-line bg-canvas px-1.5 text-[12px] outline-none"
                      value={condition.op}
                      onChange={(event) =>
                        updateRule(index, {
                          conditions: rule.conditions.map((c, i) =>
                            i === conditionIndex
                              ? { ...c, op: event.target.value as RuleOperator }
                              : c,
                          ),
                        })
                      }
                    >
                      {OPERATORS.map((op) => (
                        <option key={op.value} value={op.value}>
                          {op.label}
                        </option>
                      ))}
                    </select>
                    <input
                      className={`${inputClass} !h-8 flex-1 font-mono !text-[12px]`}
                      placeholder='value ("pro", ["a","b"], 42)'
                      value={condition.valueText}
                      onChange={(event) =>
                        updateRule(index, {
                          conditions: rule.conditions.map((c, i) =>
                            i === conditionIndex ? { ...c, valueText: event.target.value } : c,
                          ),
                        })
                      }
                    />
                    <button
                      type="button"
                      aria-label="Remove condition"
                      className="rounded p-1 text-ink-muted hover:text-chip-pink"
                      onClick={() =>
                        updateRule(index, {
                          conditions: rule.conditions.filter((_, i) => i !== conditionIndex),
                        })
                      }
                    >
                      <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden>
                        <path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                      </svg>
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  className="text-[12px] font-medium text-ink-muted underline underline-offset-2 hover:text-ink"
                  onClick={() =>
                    updateRule(index, {
                      conditions: [...rule.conditions, { attribute: "", op: "eq", valueText: "" }],
                    })
                  }
                >
                  Add condition
                </button>
                {rule.conditions.length === 0 ? (
                  <p className="text-[11px] text-ink-muted">No conditions, matches everyone.</p>
                ) : null}
              </div>

              <div className="mt-3 flex items-center gap-3 border-t border-line pt-3">
                <label className="flex items-center gap-1.5 text-[12px] text-ink-muted">
                  serve
                  <select
                    className="h-7 rounded-lg border border-line bg-canvas px-1.5 text-[12px] font-medium text-ink outline-none"
                    value={rule.serve}
                    onChange={(event) =>
                      updateRule(index, { serve: event.target.value as "on" | "off" })
                    }
                  >
                    <option value="on">ON</option>
                    <option value="off">OFF</option>
                  </select>
                </label>
                <label className="flex items-center gap-1.5 text-[12px] text-ink-muted">
                  to
                  <input
                    className="h-7 w-16 rounded-lg border border-line bg-canvas px-2 text-right font-mono text-[12px] text-ink outline-none"
                    placeholder="100"
                    value={rule.rolloutPctText}
                    onChange={(event) => updateRule(index, { rolloutPctText: event.target.value })}
                  />
                  % of matches
                </label>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function EnvSparkline({ flagId, envSlug }: { flagId: string; envSlug: string }) {
  const [series, setSeries] = useState<StatsPoint[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    void api<{ period: string; series: StatsPoint[] }>(
      `/api/v1/flags/${flagId}/environments/${envSlug}/stats?period=24h`,
    )
      .then(({ series: points }) => {
        if (!cancelled) setSeries(points);
      })
      .catch(() => {
        if (!cancelled) setSeries([]);
      });
    return () => {
      cancelled = true;
    };
  }, [flagId, envSlug]);

  const { points, total } = useMemo(() => {
    if (!series || series.length === 0) return { points: [] as { value: number }[], total: 0 };
    const byHour = new Map<string, number>();
    for (const point of series) {
      byHour.set(point.hour, (byHour.get(point.hour) ?? 0) + point.evaluations);
    }
    const hours = [...byHour.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    const sum = hours.reduce((acc, [, count]) => acc + count, 0);
    return {
      points: hours.map(([, count]) => ({ value: count })),
      total: sum,
    };
  }, [series]);

  if (series === null) return <Skeleton className="h-6 w-28" />;
  if (series.length === 0) {
    return <span className="text-[11px] text-ink-muted/70">no evals · 24h</span>;
  }

  return (
    <span className="data-in flex items-center gap-2" title={`${total.toLocaleString()} evaluations in the last 24h`}>
      <SparklineArea data={points} className="aspect-auto h-7 w-24" />
      <span className="font-mono text-[11px]">{total.toLocaleString()}</span>
    </span>
  );
}

// ── Per-flag analytics (series per variation + country breakdown) ───────────

const VARIATION_COLORS: Record<string, string> = {
  on: "var(--chart-1)",
  off: "var(--chart-5)",
  default: "var(--chart-3)",
};

const FLAG_PERIODS: { value: AnalyticsPeriod; label: string; days: number }[] = [
  { value: "24h", label: "24h", days: 1 },
  { value: "7d", label: "7d", days: 7 },
  { value: "30d", label: "30d", days: 30 },
  { value: "90d", label: "90d", days: 90 },
];

function FlagAnalytics({
  flagId,
  flagKey,
  projectId,
  envSlug,
}: {
  flagId: string;
  flagKey: string;
  projectId: string;
  envSlug: string;
}) {
  const [{ period, country: selectedCountry, region: selectedRegion }, setFilters] =
    useQueryStates(analyticsSearchParams, { history: "push" });
  const [stats, setStats] = useState<ApiStats | null>(null);
  const [geo, setGeo] = useState<ApiAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [countryDetail, setCountryDetail] = useState<ApiAnalytics | null>(null);
  const [countryLoading, setCountryLoading] = useState(false);
  const [countryError, setCountryError] = useState<string | null>(null);
  const [regionDetail, setRegionDetail] = useState<ApiAnalytics | null>(null);
  const [regionLoading, setRegionLoading] = useState(false);
  const [regionError, setRegionError] = useState<string | null>(null);

  const scopeKey = `${flagId}:${projectId}:${envSlug}`;
  const prevScopeKey = useRef(scopeKey);

  const selectCountry = (code: string | null) => {
    void setFilters({ country: code, region: null });
  };

  const selectRegion = (region: string | null) => {
    void setFilters({ region });
  };

  // Drop geo drill-down when flag/project/env changes (stale URL filters).
  useEffect(() => {
    if (prevScopeKey.current === scopeKey) return;
    prevScopeKey.current = scopeKey;
    void setFilters({ country: null, region: null });
  }, [scopeKey, setFilters]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setStatsError(null);

    const geoQuery = new URLSearchParams({
      period,
      projectId,
      env: envSlug,
      flag: flagKey,
    });

    void Promise.all([
      api<ApiStats>(`/api/v1/flags/${flagId}/environments/${envSlug}/stats?period=${period}`),
      api<ApiAnalytics>(`/api/v1/analytics?${geoQuery.toString()}`),
    ])
      .then(([statsResult, geoResult]) => {
        if (!cancelled) {
          setStats(statsResult);
          setGeo(geoResult);
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setStatsError(err instanceof Error ? err.message : "Failed to load analytics");
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [flagId, flagKey, projectId, envSlug, period]);

  useEffect(() => {
    if (!selectedCountry) {
      setCountryDetail(null);
      setCountryError(null);
      setCountryLoading(false);
      return;
    }
    let cancelled = false;
    setCountryLoading(true);
    setCountryDetail(null);
    setCountryError(null);
    const query = new URLSearchParams({
      period,
      projectId,
      env: envSlug,
      flag: flagKey,
      country: selectedCountry,
    });
    void api<ApiAnalytics>(`/api/v1/analytics?${query.toString()}`)
      .then((result) => {
        if (!cancelled) {
          setCountryDetail(result);
          setCountryLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setCountryError(
            err instanceof Error ? err.message : "Failed to load country analytics",
          );
          setCountryLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [flagKey, projectId, envSlug, period, selectedCountry]);

  useEffect(() => {
    if (!selectedCountry || !selectedRegion) {
      setRegionDetail(null);
      setRegionError(null);
      setRegionLoading(false);
      return;
    }
    let cancelled = false;
    setRegionLoading(true);
    setRegionDetail(null);
    setRegionError(null);
    const query = new URLSearchParams({
      period,
      projectId,
      env: envSlug,
      flag: flagKey,
      country: selectedCountry,
      region: selectedRegion,
    });
    void api<ApiAnalytics>(`/api/v1/analytics?${query.toString()}`)
      .then((result) => {
        if (!cancelled) {
          setRegionDetail(result);
          setRegionLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setRegionError(
            err instanceof Error ? err.message : "Failed to load region analytics",
          );
          setRegionLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [flagKey, projectId, envSlug, period, selectedCountry, selectedRegion]);

  const chart = useMemo(() => {
    if (!stats) return null;
    const variations = [...new Set(stats.series.map((point) => point.variation))].sort();
    const byHour = new Map<string, Map<string, number>>();
    for (const point of stats.series) {
      const hour = byHour.get(point.hour) ?? new Map<string, number>();
      hour.set(point.variation, (hour.get(point.variation) ?? 0) + point.evaluations);
      byHour.set(point.hour, hour);
    }
    const hours = [...byHour.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    const data = hours.map(([hour, counts]) => {
      const row: Record<string, string | number> = {
        label: hour.slice(5, 16).replace("T", " "),
      };
      for (const variation of variations) {
        row[variation] = counts.get(variation) ?? 0;
      }
      return row;
    });
    const total = stats.series.reduce((sum, point) => sum + point.evaluations, 0);
    return {
      variations,
      data,
      total,
      series: variations.map((key) => ({
        key,
        label: key,
        color: VARIATION_COLORS[key] ?? "var(--chart-1)",
      })),
    };
  }, [stats]);

  const retentionDays = stats?.retentionDays ?? geo?.retentionDays ?? 365;
  const refreshing = loading && (stats !== null || geo !== null);
  const initialLoad = loading && stats === null && geo === null;
  const total = geo?.total ?? chart?.total ?? 0;
  const countries = geo?.countries ?? stats?.countries ?? [];
  const showEmpty = !loading && !statsError && geo !== null && total === 0;

  return (
    <div className="mt-8 space-y-6 rounded-3xl border border-line bg-surface p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-baseline gap-2">
          <h2 className="text-[16px] font-semibold">Analytics</h2>
          <span className="font-mono text-[12px] text-ink-muted">{envSlug}</span>
          {!initialLoad ? (
            <SoftRefresh active={refreshing}>
              <span className="text-[12px] text-ink-muted">
                {formatCount(total)} evaluations
              </span>
            </SoftRefresh>
          ) : null}
        </div>
        <div className="flex items-center gap-1.5" role="group" aria-label="Timeframe">
          {FLAG_PERIODS.map(({ value, label, days }) => {
            const beyondRetention = days > retentionDays;
            return (
              <button
                key={value}
                type="button"
                disabled={beyondRetention}
                title={
                  beyondRetention
                    ? `Beyond your plan's ${retentionDays}-day analytics retention`
                    : undefined
                }
                onClick={() => void setFilters({ period: value })}
                className={cn(
                  "h-7 rounded-lg border px-2.5 text-[12px] font-medium transition-colors",
                  period === value
                    ? "border-ink bg-ink text-canvas"
                    : beyondRetention
                      ? "cursor-not-allowed border-line text-ink-muted/50"
                      : "border-line bg-canvas text-ink hover:bg-surface",
                )}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {statsError ? <ErrorNote message={statsError} /> : null}
      {showEmpty ? (
        <p className="py-8 text-center text-[13px] text-ink-muted">
          No evaluations for this flag in the selected period.
        </p>
      ) : null}
      {!statsError && !showEmpty ? (
        <>
          <AnalyticsMapPanel
            countries={countries}
            total={total}
            period={period}
            initialLoad={initialLoad}
            refreshing={refreshing}
            hasData={geo !== null || stats !== null}
            selectedCountry={selectedCountry}
            onSelectCountry={selectCountry}
            selectedRegion={selectedRegion}
            onSelectRegion={selectRegion}
            countryDetail={countryDetail}
            countryLoading={countryLoading}
            countryError={countryError}
            regionDetail={regionDetail}
            regionLoading={regionLoading}
            regionError={regionError}
            hideTopFlags
          />

          <div>
            <div className="mb-3 flex items-baseline justify-between">
              <h3 className="text-[14px] font-semibold">By variation</h3>
              <span className="text-[12px] text-ink-muted">
                {period === "24h" ? "hourly" : "daily"}
              </span>
            </div>
            {initialLoad || !chart ? (
              <Skeleton className="h-40 w-full" />
            ) : (
              <SoftRefresh active={refreshing}>
                <StackedAreaChart
                  data={chart.data}
                  series={chart.series}
                  className="aspect-auto h-40 w-full"
                />
              </SoftRefresh>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}
