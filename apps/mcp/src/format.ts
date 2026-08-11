/**
 * Human/agent-readable rendering of control-plane resources.
 * Compact, deterministic text, no markdown tables, no giant JSON dumps.
 */
import type { TargetingRule } from "@betterflag/core";
import { configsOf, isKilled, rolloutPctOf } from "./api";
import type { AuditEntry, Flag, FlagConfig, StatsRow } from "./types";

export function envStateBadge(cfg: FlagConfig): string {
  if (isKilled(cfg)) return "🔴 KILLED";
  const pct = rolloutPctOf(cfg);
  if (cfg.enabled === true) {
    return pct !== undefined && pct < 100 ? `✅ on (${pct}%)` : "✅ on";
  }
  return "⬜ off";
}

export function flagSummaryLine(flag: Flag): string {
  const name = flag.name && flag.name !== flag.key ? `, ${flag.name}` : "";
  const kind = flag.kind ? ` [${flag.kind}]` : "";
  const header = `• ${flag.key}${name}${kind}`;
  const envs = configsOf(flag)
    .map(({ env, cfg }) => `${env}: ${envStateBadge(cfg)}`)
    .join(" | ");
  return envs ? `${header}\n    ${envs}` : header;
}

export function renderRule(rule: TargetingRule, index: number): string {
  const conds =
    rule.conditions.length === 0
      ? "matches everyone"
      : rule.conditions.map((c) => `${c.attribute} ${c.op} ${JSON.stringify(c.value)}`).join(" AND ");
  const pct = rule.rolloutPct !== undefined ? ` to ${rule.rolloutPct}% of matches` : "";
  const desc = rule.description ? `, ${rule.description}` : "";
  return `    ${index + 1}. [${rule.id}] ${conds} → serve ${rule.serve}${pct}${desc}`;
}

export function flagDetail(flag: Flag, projectSlug: string | undefined): string {
  const lines: string[] = [];
  const name = flag.name && flag.name !== flag.key ? `, ${flag.name}` : "";
  lines.push(`🚩 ${flag.key}${name}`);

  const meta: string[] = [];
  if (flag.kind) meta.push(`kind: ${flag.kind}`);
  if (projectSlug) meta.push(`project: ${projectSlug}`);
  const defaultValue = flag.defaultValue ?? flag.default_value;
  if (defaultValue !== undefined) meta.push(`default: ${JSON.stringify(defaultValue)}`);
  const archivedAt = flag.archivedAt ?? flag.archived_at;
  if (archivedAt) meta.push(`ARCHIVED ${archivedAt}`);
  if (meta.length > 0) lines.push(meta.join(" · "));
  if (flag.description) lines.push(`description: ${flag.description}`);

  for (const { env, cfg } of configsOf(flag)) {
    lines.push("");
    lines.push(`${env}:`);
    const state: string[] = [`state: ${envStateBadge(cfg)}`];
    const pct = rolloutPctOf(cfg);
    if (pct !== undefined) state.push(`rollout: ${pct}%`);
    if (cfg.version !== undefined) state.push(`version: ${cfg.version}`);
    lines.push(`  ${state.join(" · ")}`);
    const valueOn = cfg.valueOn ?? cfg.value_on;
    const valueOff = cfg.valueOff ?? cfg.value_off;
    if (valueOn !== undefined || valueOff !== undefined) {
      lines.push(`  serves: on=${JSON.stringify(valueOn)} off=${JSON.stringify(valueOff)}`);
    }
    const rules = cfg.rules ?? [];
    if (rules.length > 0) {
      lines.push("  rules (first match wins):");
      rules.forEach((rule, i) => lines.push(renderRule(rule, i)));
    } else {
      lines.push("  rules: none");
    }
  }

  if (flag.versions !== undefined) {
    lines.push("");
    lines.push(`versions: ${JSON.stringify(flag.versions)}`);
  }
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------

function statsLabel(row: StatsRow): string {
  return row.hour ?? row.day ?? row.ts ?? row.t ?? row.date ?? row.time ?? row.bucket ?? "?";
}

function num(...candidates: Array<number | undefined>): number | undefined {
  for (const c of candidates) if (typeof c === "number") return c;
  return undefined;
}

export function statsTable(rows: StatsRow[]): string {
  const rendered = rows.map((row) => {
    const on = num(row.on, row.onCount, row.on_count);
    const off = num(row.off, row.offCount, row.off_count);
    const total = num(row.total, row.totalCount, row.total_count) ?? (on !== undefined && off !== undefined ? on + off : undefined);
    return {
      label: statsLabel(row),
      on: on?.toLocaleString("en-US") ?? "-",
      off: off?.toLocaleString("en-US") ?? "-",
      total: total?.toLocaleString("en-US") ?? "-",
    };
  });
  const w = (key: "label" | "on" | "off" | "total", header: string): number =>
    Math.max(header.length, ...rendered.map((r) => r[key].length));
  const cols = {
    label: w("label", "time"),
    on: w("on", "on"),
    off: w("off", "off"),
    total: w("total", "total"),
  };
  const line = (label: string, on: string, off: string, total: string): string =>
    `${label.padEnd(cols.label)}  ${on.padStart(cols.on)}  ${off.padStart(cols.off)}  ${total.padStart(cols.total)}`;
  return [
    line("time", "on", "off", "total"),
    ...rendered.map((r) => line(r.label, r.on, r.off, r.total)),
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Audit
// ---------------------------------------------------------------------------

export function auditLine(entry: AuditEntry): string {
  const when = entry.createdAt ?? entry.created_at ?? entry.at ?? entry.ts ?? "?";
  const actorType = entry.actorType ?? entry.actor_type ?? "?";
  const keyPrefix = entry.actorKeyPrefix ?? entry.actor_key_prefix;
  const who =
    actorType === "agent"
      ? (keyPrefix ?? entry.actorId ?? entry.actor_id ?? "agent")
      : (entry.actorEmail ?? entry.actor_email ?? entry.actorId ?? entry.actor_id ?? "user");
  const action = entry.action ?? "?";
  const subject =
    entry.flagKey ?? entry.flag_key ?? entry.subjectKey ?? entry.subject_key ?? entry.subject ?? entry.subjectType ?? entry.subject_type ?? "";
  const env = entry.environment ?? entry.env ?? entry.envSlug;
  const target = subject ? ` ${subject}${env ? ` (${env})` : ""}` : env ? ` (${env})` : "";
  return `${when}  [${actorType}] ${who} → ${action}${target}`;
}
