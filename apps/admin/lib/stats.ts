/**
 * Aggregation layer for the admin console. Relational facts come from
 * Supabase via the service client; evaluation volume comes from ClickHouse
 * (see clickhouse.ts). Day bucketing happens here in JS: at current scale
 * (alpha, thousands of rows) fetching created_at columns and folding them
 * is simpler than maintaining SQL functions, and PostgREST's 1k row page
 * cap is handled by fetchAllRows. Revisit if row counts grow past ~100k.
 * All days are UTC, matching the ClickHouse meter and the project timezone.
 */

import type {
  ApiKeyRow,
  AuditLogRow,
  EnvironmentRow,
  OrgPlan,
  OrgRow,
  ProjectRow,
} from "@betterflag/db";
import type { SupabaseClient, User } from "@supabase/supabase-js";

import { evalsPerDayAll, evalsPerDayOrg, type EvalsDayRow } from "./clickhouse";

const PAGE_SIZE = 1000;

/** Drain a PostgREST query page by page (the API caps a request at 1k rows). */
export async function fetchAllRows<T>(
  page: (from: number, to: number) => PromiseLike<{ data: unknown; error: unknown }>,
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await page(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    const batch = (data ?? []) as T[];
    rows.push(...batch);
    if (batch.length < PAGE_SIZE) break;
  }
  return rows;
}

/** Supabase auth user plus the admin-only ban field the SDK type omits. */
export type AdminUser = User & { banned_until?: string | null };

export function isBanned(user: AdminUser): boolean {
  return Boolean(user.banned_until && new Date(user.banned_until).getTime() > Date.now());
}

/** Every auth user, drained through the paginated admin API. */
export async function listAllUsers(service: SupabaseClient): Promise<AdminUser[]> {
  const users: AdminUser[] = [];
  for (let page = 1; ; page += 1) {
    const { data, error } = await service.auth.admin.listUsers({ page, perPage: PAGE_SIZE });
    if (error) throw error;
    users.push(...(data.users as AdminUser[]));
    if (data.users.length < PAGE_SIZE) break;
  }
  return users;
}

// ---------------------------------------------------------------------------
// Day bucketing

export interface DayPoint {
  day: string;
  value: number;
}

/** ISO day keys (UTC) for the trailing window, oldest first, today included. */
export function dayKeys(days: number): string[] {
  const keys: string[] = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(now.getTime() - i * 86_400_000);
    keys.push(d.toISOString().slice(0, 10));
  }
  return keys;
}

/** Fold ISO timestamps into zero-filled daily counts for the trailing window. */
export function bucketByDay(timestamps: string[], days: number): DayPoint[] {
  const counts = new Map<string, number>(dayKeys(days).map((key) => [key, 0]));
  for (const ts of timestamps) {
    const key = ts.slice(0, 10);
    const current = counts.get(key);
    if (current !== undefined) counts.set(key, current + 1);
  }
  return [...counts.entries()].map(([day, value]) => ({ day, value }));
}

/** Align ClickHouse day rows onto a zero-filled trailing window. */
export function fillEvalDays(rows: EvalsDayRow[], days: number): DayPoint[] {
  const counts = new Map<string, number>(dayKeys(days).map((key) => [key, 0]));
  for (const row of rows) {
    if (counts.has(row.day)) counts.set(row.day, row.evaluations);
  }
  return [...counts.entries()].map(([day, value]) => ({ day, value }));
}

function countSince(timestamps: string[], sinceMs: number): number {
  return timestamps.filter((ts) => new Date(ts).getTime() >= sinceMs).length;
}

async function createdAtSince(
  service: SupabaseClient,
  table: "flags" | "orgs",
  days: number,
): Promise<string[]> {
  const cutoff = new Date(Date.now() - days * 86_400_000).toISOString();
  const rows = await fetchAllRows<{ created_at: string }>((from, to) =>
    service.from(table).select("created_at").gte("created_at", cutoff).range(from, to),
  );
  return rows.map((row) => row.created_at);
}

async function countRows(service: SupabaseClient, table: string): Promise<number> {
  const { count, error } = await service.from(table).select("id", {
    count: "exact",
    head: true,
  });
  if (error) throw error;
  return count ?? 0;
}

// ---------------------------------------------------------------------------
// Overview

export interface OverviewStats {
  totals: {
    orgs: number;
    users: number;
    projects: number;
    activeFlags: number;
    evals7d: number;
  };
  flagsCreated: { today: number; past7d: number; past30d: number };
  flagsPerDay: DayPoint[];
  signupsPerDay: DayPoint[];
  evalsPerDay: DayPoint[];
  planMix: { plan: OrgPlan; count: number }[];
}

const PLAN_ORDER: OrgPlan[] = ["trial", "starter", "launch", "scale"];

export async function loadOverviewStats(service: SupabaseClient): Promise<OverviewStats> {
  const [users, orgPlans, flagTimestamps, evalRows, orgCount, projectCount, activeFlags] =
    await Promise.all([
      listAllUsers(service),
      fetchAllRows<{ plan: OrgPlan }>((from, to) =>
        service.from("orgs").select("plan").range(from, to),
      ),
      createdAtSince(service, "flags", 30),
      evalsPerDayAll(30),
      countRows(service, "orgs"),
      countRows(service, "projects"),
      (async () => {
        const { count, error } = await service
          .from("flags")
          .select("id", { count: "exact", head: true })
          .is("archived_at", null);
        if (error) throw error;
        return count ?? 0;
      })(),
    ]);

  const now = Date.now();
  const todayStartMs = new Date(new Date(now).toISOString().slice(0, 10)).getTime();
  const evalsPerDay = fillEvalDays(evalRows, 30);

  return {
    totals: {
      orgs: orgCount,
      users: users.length,
      projects: projectCount,
      activeFlags,
      evals7d: evalsPerDay.slice(-7).reduce((sum, point) => sum + point.value, 0),
    },
    flagsCreated: {
      today: countSince(flagTimestamps, todayStartMs),
      past7d: countSince(flagTimestamps, now - 7 * 86_400_000),
      past30d: flagTimestamps.length,
    },
    flagsPerDay: bucketByDay(flagTimestamps, 30),
    signupsPerDay: bucketByDay(
      users.map((user) => user.created_at),
      30,
    ),
    evalsPerDay,
    planMix: PLAN_ORDER.map((plan) => ({
      plan,
      count: orgPlans.filter((row) => row.plan === plan).length,
    })),
  };
}

// ---------------------------------------------------------------------------
// Orgs

export interface OrgListItem {
  org: OrgRow;
  members: number;
  projects: number;
  flags: number;
}

export async function listOrgsWithCounts(service: SupabaseClient): Promise<OrgListItem[]> {
  const [orgs, memberRows, projectRows, flagRows] = await Promise.all([
    fetchAllRows<OrgRow>((from, to) =>
      service.from("orgs").select("*").order("created_at", { ascending: false }).range(from, to),
    ),
    fetchAllRows<{ org_id: string }>((from, to) =>
      service.from("org_members").select("org_id").range(from, to),
    ),
    fetchAllRows<{ id: string; org_id: string }>((from, to) =>
      service.from("projects").select("id, org_id").range(from, to),
    ),
    fetchAllRows<{ project_id: string }>((from, to) =>
      service.from("flags").select("project_id").range(from, to),
    ),
  ]);

  const membersByOrg = new Map<string, number>();
  for (const row of memberRows) {
    membersByOrg.set(row.org_id, (membersByOrg.get(row.org_id) ?? 0) + 1);
  }

  const orgByProject = new Map(projectRows.map((row) => [row.id, row.org_id]));
  const projectsByOrg = new Map<string, number>();
  for (const row of projectRows) {
    projectsByOrg.set(row.org_id, (projectsByOrg.get(row.org_id) ?? 0) + 1);
  }
  const flagsByOrg = new Map<string, number>();
  for (const row of flagRows) {
    const orgId = orgByProject.get(row.project_id);
    if (orgId) flagsByOrg.set(orgId, (flagsByOrg.get(orgId) ?? 0) + 1);
  }

  return orgs.map((org) => ({
    org,
    members: membersByOrg.get(org.id) ?? 0,
    projects: projectsByOrg.get(org.id) ?? 0,
    flags: flagsByOrg.get(org.id) ?? 0,
  }));
}

export interface OrgMemberDetail {
  userId: string;
  email: string | null;
  role: string;
  joinedAt: string;
}

export interface OrgProjectDetail {
  project: ProjectRow;
  environments: EnvironmentRow[];
  flags: number;
}

export interface OrgDetail {
  org: OrgRow;
  members: OrgMemberDetail[];
  projects: OrgProjectDetail[];
  apiKeys: Pick<ApiKeyRow, "id" | "kind" | "name" | "prefix" | "last_used_at" | "revoked_at">[];
  audit: AuditLogRow[];
  evalsPerDay: DayPoint[];
}

export async function loadOrgDetail(
  service: SupabaseClient,
  orgId: string,
): Promise<OrgDetail | null> {
  const { data: org, error: orgError } = await service
    .from("orgs")
    .select("*")
    .eq("id", orgId)
    .maybeSingle();
  if (orgError) throw orgError;
  if (!org) return null;

  const [memberRows, projectRows, apiKeys, auditResult, evalRows] = await Promise.all([
    fetchAllRows<{ user_id: string; role: string; created_at: string }>((from, to) =>
      service.from("org_members").select("user_id, role, created_at").eq("org_id", orgId).range(from, to),
    ),
    fetchAllRows<ProjectRow & { environments: EnvironmentRow[]; flags: { count: number }[] }>(
      (from, to) =>
        service
          .from("projects")
          .select("*, environments(*), flags(count)")
          .eq("org_id", orgId)
          .range(from, to),
    ),
    fetchAllRows<OrgDetail["apiKeys"][number]>((from, to) =>
      service
        .from("api_keys")
        .select("id, kind, name, prefix, last_used_at, revoked_at")
        .eq("org_id", orgId)
        .order("created_at", { ascending: false })
        .range(from, to),
    ),
    service
      .from("audit_log")
      .select("*")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false })
      .limit(15),
    evalsPerDayOrg(orgId, 30),
  ]);

  if (auditResult.error) throw auditResult.error;

  const members: OrgMemberDetail[] = await Promise.all(
    memberRows.map(async (member) => {
      const { data } = await service.auth.admin.getUserById(member.user_id);
      return {
        userId: member.user_id,
        email: data.user?.email ?? null,
        role: member.role,
        joinedAt: member.created_at,
      };
    }),
  );

  return {
    org: org as OrgRow,
    members,
    projects: projectRows.map(({ environments, flags, ...project }) => ({
      project: project as ProjectRow,
      environments,
      flags: flags[0]?.count ?? 0,
    })),
    apiKeys,
    audit: (auditResult.data ?? []) as AuditLogRow[],
    evalsPerDay: fillEvalDays(evalRows, 30),
  };
}

// ---------------------------------------------------------------------------
// Users

export interface UserListItem {
  user: AdminUser;
  orgs: { id: string; name: string; role: string }[];
  banned: boolean;
}

export async function listUsersWithOrgs(service: SupabaseClient): Promise<UserListItem[]> {
  const [users, memberRows, orgRows] = await Promise.all([
    listAllUsers(service),
    fetchAllRows<{ org_id: string; user_id: string; role: string }>((from, to) =>
      service.from("org_members").select("org_id, user_id, role").range(from, to),
    ),
    fetchAllRows<{ id: string; name: string }>((from, to) =>
      service.from("orgs").select("id, name").range(from, to),
    ),
  ]);

  const orgNames = new Map(orgRows.map((org) => [org.id, org.name]));
  const orgsByUser = new Map<string, UserListItem["orgs"]>();
  for (const row of memberRows) {
    const list = orgsByUser.get(row.user_id) ?? [];
    list.push({ id: row.org_id, name: orgNames.get(row.org_id) ?? "Unknown", role: row.role });
    orgsByUser.set(row.user_id, list);
  }

  return users
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
    .map((user) => ({
      user,
      orgs: orgsByUser.get(user.id) ?? [],
      banned: isBanned(user),
    }));
}
