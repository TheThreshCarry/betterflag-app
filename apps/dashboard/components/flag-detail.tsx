"use client";

import {
  targetingRulesSchema,
  type JsonValue,
  type RuleOperator,
  type TargetingRule,
} from "@shipos/core";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { useApp } from "@/components/app-shell";
import { KIND_COLORS } from "@/components/flags-view";
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
import { Skeleton } from "@/components/ui/skeleton";
import { CountryTable } from "@/components/analytics-view";
import type {
  AnalyticsPeriod,
  ApiFlag,
  ApiFlagConfigWithEnv,
  ApiStats,
  StatsPoint,
} from "@/lib/api-types";
import { api, ApiClientError } from "@/lib/client-api";

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

function rulesToEditable(rules: JsonValue): EditableRule[] {
  const parsed = targetingRulesSchema.safeParse(rules);
  if (!parsed.success) return [];
  return parsed.data.map((rule) => ({
    id: rule.id,
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

export function FlagDetail({ flagId }: { flagId: string }) {
  const router = useRouter();
  const [data, setData] = useState<FlagDetailResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const { activeEnv } = useApp();

  const load = useCallback(async () => {
    try {
      const response = await api<FlagDetailResponse>(`/api/v1/flags/${flagId}`);
      setData(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load flag");
    }
  }, [flagId]);

  useEffect(() => {
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
    <div className="data-in">
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
          <Button variant="ghost" size="sm" onClick={() => setArchiveOpen(true)}>
            Archive
          </Button>
        </div>
      </div>

      <div className="space-y-6">
        {shownConfigs.map((config) => (
          <EnvConfigCard key={config.id} flag={flag} config={config} onRefresh={load} />
        ))}
      </div>

      {shownConfigs[0]?.environment ? (
        <FlagAnalytics flagId={flag.id} envSlug={shownConfigs[0].environment.slug} />
      ) : null}

      <EditFlagDialog
        open={editOpen}
        onClose={() => setEditOpen(false)}
        flag={flag}
        onSaved={() => {
          setEditOpen(false);
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
              void api(`/api/v1/flags/${flag.id}`, { method: "DELETE" }).then(() =>
                router.push("/flags"),
              );
            }}
          >
            Archive flag
          </Button>
        </div>
      </Dialog>
    </div>
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

  useEffect(() => {
    setEnabled(config.enabled);
    setRolloutPct(config.rolloutPct);
    setRules(rulesToEditable(config.rules));
    setValueOnText(valueToText(flag.kind, config.valueOn));
    setValueOffText(valueToText(flag.kind, config.valueOff));
    setDirty(false);
    setConflict(false);
    setError(null);
  }, [config, flag.kind]);

  function touch() {
    setDirty(true);
  }

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        enabled,
        rolloutPct,
        rules: editableToRules(rules),
        expectedVersion: config.version,
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
    } catch (err) {
      if (err instanceof ApiClientError && err.status === 409) {
        setConflict(true);
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
        body: JSON.stringify({ clearKill: true, expectedVersion: config.version }),
      });
      await onRefresh();
    } catch (err) {
      if (err instanceof ApiClientError && err.status === 409) {
        setConflict(true);
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
          <span className="font-mono text-[11px] text-ink-muted">v{config.version}</span>
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
          <div className="flex items-center justify-between rounded-2xl border border-line bg-white px-4 py-3">
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

          <div className="rounded-2xl border border-line bg-white px-4 py-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[14px] font-medium">Rollout</p>
              <span className="font-mono text-[13px] font-semibold">{rolloutPct}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={rolloutPct}
              className="shipos-range w-full"
              onChange={(event) => {
                setRolloutPct(Number(event.target.value));
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

function RulesEditor({
  rules,
  onChange,
}: {
  rules: EditableRule[];
  onChange: (rules: EditableRule[]) => void;
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
    <div className="rounded-2xl border border-line bg-white p-4">
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
              { id: newRuleId(), description: "", conditions: [], serve: "on", rolloutPctText: "" },
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
              <div className="mb-2 flex items-center justify-between">
                <span className="font-mono text-[11px] text-ink-muted">
                  #{index + 1} · {rule.id}
                </span>
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
                      className="h-8 rounded-lg border border-line bg-white px-1.5 text-[12px] outline-none"
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
                    className="h-7 rounded-lg border border-line bg-white px-1.5 text-[12px] font-medium text-ink outline-none"
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
                    className="h-7 w-16 rounded-lg border border-line bg-white px-2 text-right font-mono text-[12px] text-ink outline-none"
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

  const { path, total } = useMemo(() => {
    if (!series || series.length === 0) return { path: "", total: 0 };
    const byHour = new Map<string, number>();
    for (const point of series) {
      byHour.set(point.hour, (byHour.get(point.hour) ?? 0) + point.evaluations);
    }
    const hours = [...byHour.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    const sum = hours.reduce((acc, [, count]) => acc + count, 0);
    const max = Math.max(...hours.map(([, count]) => count), 1);
    const width = 96;
    const height = 24;
    const step = hours.length > 1 ? width / (hours.length - 1) : width;
    const points = hours
      .map(([, count], i) => `${(i * step).toFixed(1)},${(height - (count / max) * height + 2).toFixed(1)}`)
      .join(" ");
    return { path: points, total: sum };
  }, [series]);

  if (series === null) return <Skeleton className="h-6 w-28" />;
  if (series.length === 0) {
    return <span className="text-[11px] text-ink-muted/70">no evals · 24h</span>;
  }

  return (
    <span className="data-in flex items-center gap-2" title={`${total.toLocaleString()} evaluations in the last 24h`}>
      <svg width="96" height="28" viewBox="0 0 96 28" fill="none" aria-hidden>
        <polyline points={path} stroke="#0067F4" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="font-mono text-[11px]">{total.toLocaleString()}</span>
    </span>
  );
}

// ── Per-flag analytics (series per variation + country breakdown) ───────────

const VARIATION_COLORS: Record<string, string> = {
  on: "#0067F4",
  off: "#B7B2AA",
  default: "#FF5A1A",
};

const FLAG_PERIODS: { value: AnalyticsPeriod; label: string; days: number }[] = [
  { value: "24h", label: "24h", days: 1 },
  { value: "7d", label: "7d", days: 7 },
  { value: "30d", label: "30d", days: 30 },
  { value: "90d", label: "90d", days: 90 },
];

function FlagAnalytics({ flagId, envSlug }: { flagId: string; envSlug: string }) {
  const [period, setPeriod] = useState<AnalyticsPeriod>("7d");
  const [stats, setStats] = useState<ApiStats | null>(null);
  const [statsError, setStatsError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setStats(null);
    setStatsError(null);
    void api<ApiStats>(`/api/v1/flags/${flagId}/environments/${envSlug}/stats?period=${period}`)
      .then((result) => {
        if (!cancelled) setStats(result);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setStatsError(err instanceof Error ? err.message : "Failed to load analytics");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [flagId, envSlug, period]);

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
    const max = Math.max(...hours.map(([, counts]) => [...counts.values()].reduce((a, b) => a + b, 0)), 1);
    const total = stats.series.reduce((sum, point) => sum + point.evaluations, 0);
    return { variations, hours, max, total };
  }, [stats]);

  const retentionDays = stats?.retentionDays ?? 365;

  return (
    <div className="mt-8 rounded-3xl border border-line bg-surface p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-baseline gap-2">
          <h2 className="text-[16px] font-semibold">Analytics</h2>
          <span className="font-mono text-[12px] text-ink-muted">{envSlug}</span>
          {chart ? (
            <span className="text-[12px] text-ink-muted">
              {chart.total.toLocaleString()} evaluations
            </span>
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
                onClick={() => setPeriod(value)}
                className={`h-7 rounded-lg border px-2.5 text-[12px] font-medium transition-colors ${
                  period === value
                    ? "border-ink bg-ink text-white"
                    : beyondRetention
                      ? "cursor-not-allowed border-line text-ink-muted/50"
                      : "border-line bg-white text-ink hover:bg-surface"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {statsError ? <ErrorNote message={statsError} /> : null}
      {!statsError && !stats ? <Skeleton className="h-40 w-full" /> : null}
      {!statsError && stats && chart ? (
        chart.total === 0 ? (
          <p className="data-in py-8 text-center text-[13px] text-ink-muted">
            No evaluations for this flag in the selected period.
          </p>
        ) : (
          <div className="data-in grid gap-6 lg:grid-cols-2">
            <div>
              <svg
                viewBox="0 0 100 40"
                className="h-40 w-full"
                preserveAspectRatio="none"
                role="img"
                aria-label="Evaluations per variation over time"
              >
                {chart.hours.map(([hour, counts], i) => {
                  const barWidth = 100 / chart.hours.length;
                  let yOffset = 40;
                  return chart.variations.map((variation) => {
                    const count = counts.get(variation) ?? 0;
                    const height = (count / chart.max) * 36;
                    yOffset -= height;
                    return (
                      <rect
                        key={`${hour}:${variation}`}
                        x={i * barWidth + barWidth * 0.15}
                        y={yOffset}
                        width={barWidth * 0.7}
                        height={height}
                        fill={VARIATION_COLORS[variation] ?? "#0067F4"}
                        opacity={0.9}
                      >
                        <title>
                          {hour} · {variation}: {count.toLocaleString()}
                        </title>
                      </rect>
                    );
                  });
                })}
                <line x1="0" y1="40" x2="100" y2="40" stroke="#e8e4de" strokeWidth="0.4" />
              </svg>
              <div className="mt-2 flex items-center gap-4">
                {chart.variations.map((variation) => (
                  <span key={variation} className="flex items-center gap-1.5 text-[12px] text-ink-muted">
                    <span
                      aria-hidden
                      className="inline-block h-2 w-2 rounded-full"
                      style={{ backgroundColor: VARIATION_COLORS[variation] ?? "#0067F4" }}
                    />
                    {variation}
                  </span>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-3 text-[13px] font-medium">By country</p>
              <CountryTable countries={stats.countries} total={chart.total} />
            </div>
          </div>
        )
      ) : null}
    </div>
  );
}
