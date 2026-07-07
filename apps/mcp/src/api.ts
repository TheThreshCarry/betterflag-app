/**
 * Thin client over the ShipOS control-plane REST API (docs/CONTRACTS.md).
 *
 * Every call authenticates with the session's agent/admin key. A valid key
 * executes mutations directly. HTTP errors are mapped to agent-actionable
 * ToolError messages.
 */
import { ToolError } from "./errors";
import type { ApiCtx, Flag, FlagConfig, Project } from "./types";

type Method = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

/** Human-readable one-liner for an unknown thrown value. */
function errText(error: unknown): string {
  return error instanceof Error ? `${error.name}: ${error.message}` : String(error);
}

interface ApiRequest {
  method: Method;
  /** Path under the control-plane origin, starting with /api/v1. */
  path: string;
  body?: unknown;
  /** Extra context to sharpen error messages. */
  flagKey?: string;
  projectSlug?: string;
}

interface ApiErrorBody {
  error?: { code?: string; message?: string };
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

async function readBody(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    return undefined;
  }
}

export async function apiFetch<T = unknown>(ctx: ApiCtx, req: ApiRequest): Promise<T> {
  const headers: Record<string, string> = {
    authorization: `Bearer ${ctx.apiKey}`,
    accept: "application/json",
  };
  if (req.body !== undefined) headers["content-type"] = "application/json";

  // The bearer key is NEVER logged, only the method/path and non-sensitive
  // request context. Telemetry is best-effort and never changes tool behavior.
  const log = ctx.obs?.logger.child({
    api_method: req.method,
    api_path: req.path,
    ...(req.flagKey ? { flag_key: req.flagKey } : {}),
    ...(req.projectSlug ? { project_slug: req.projectSlug } : {}),
  });
  const span = ctx.obs?.tracer.startSpan(`ShipOS API ${req.method} ${req.path}`, {
    kind: "client",
    attributes: {
      "http.request.method": req.method,
      "url.path": req.path,
      ...(req.flagKey ? { "shipos.flag_key": req.flagKey } : {}),
      ...(req.projectSlug ? { "shipos.project_slug": req.projectSlug } : {}),
    },
  });

  let res: Response;
  try {
    res = await fetch(`${ctx.baseUrl}${req.path}`, {
      method: req.method,
      headers,
      body: req.body !== undefined ? JSON.stringify(req.body) : undefined,
    });
  } catch (e) {
    span?.recordException(e).end();
    log?.error("ShipOS API request could not connect", { error: errText(e) });
    void ctx.obs?.flush();
    throw new ToolError(
      `Could not reach the ShipOS API at ${ctx.baseUrl}: ${e instanceof Error ? e.message : String(e)}. Try again in a moment.`,
    );
  }
  span?.setAttribute("http.response.status_code", res.status);

  const payload = await readBody(res);

  if (!res.ok) {
    span?.setStatus("error").end();
    log?.warn("ShipOS API returned an error status", { status: res.status });
    void ctx.obs?.flush();
    throw mapError(res.status, payload, req);
  }

  span?.end();
  void ctx.obs?.flush();
  return payload as T;
}

function mapError(status: number, payload: unknown, req: ApiRequest): ToolError {
  const err = isRecord(payload) ? (payload as ApiErrorBody).error : undefined;
  const code = err?.code ?? "unknown";
  const message = err?.message ?? `HTTP ${status}`;

  switch (status) {
    case 401:
      return new ToolError(
        "ShipOS rejected this agent key, it is invalid or has been revoked. " +
          "Create a new agent key in the ShipOS dashboard under Keys and reconnect the MCP server with it.",
      );
    case 403:
      if (code.includes("plan_limit") || /plan/i.test(message)) {
        return new ToolError(
          `Plan limit reached: ${message} ` +
            "Upgrade your ShipOS plan in the dashboard (Settings → Billing) to raise this limit.",
        );
      }
      return new ToolError(`Forbidden (${code}): ${message}`);
    case 404:
      if (code === "flag_not_found" || req.flagKey) {
        const key = req.flagKey ? `"${req.flagKey}"` : "that key";
        const scope = req.projectSlug ? ` in project "${req.projectSlug}"` : "";
        return new ToolError(
          `Flag ${key} was not found${scope}. Run list_flags to see the flags that exist, or create_flag to create it.`,
        );
      }
      return new ToolError(`Not found (${code}): ${message}`);
    case 409:
      return new ToolError(
        `Version conflict: ${message} ` +
          "Someone (or something) changed this flag config since it was last read. " +
          "Re-read the current state with get_flag and retry.",
      );
    default:
      return new ToolError(`ShipOS API error ${status} (${code}): ${message}`);
  }
}

// ---------------------------------------------------------------------------
// Response normalization helpers (shapes are tolerant; see types.ts)
// ---------------------------------------------------------------------------

/** Accepts either a bare array or an object wrapping the array under `keys`. */
export function pluckArray<T>(payload: unknown, keys: readonly string[]): T[] | undefined {
  if (Array.isArray(payload)) return payload as T[];
  if (isRecord(payload)) {
    for (const k of keys) {
      const v = payload[k];
      if (Array.isArray(v)) return v as T[];
    }
  }
  return undefined;
}

/** GET /flags/lookup may return the flag bare or as { flag, configs }. */
export function normalizeFlag(payload: unknown): Flag | undefined {
  if (!isRecord(payload)) return undefined;
  const inner = isRecord(payload.flag) ? payload.flag : payload;
  if (typeof inner.id !== "string" || typeof inner.key !== "string") return undefined;
  const flag = inner as unknown as Flag;
  if (!flag.configs && Array.isArray(payload.configs)) {
    return { ...flag, configs: payload.configs as FlagConfig[] };
  }
  return flag;
}

/** Flatten flag configs (array or env-keyed record) to [envSlug, config]. */
export function configsOf(flag: Flag): Array<{ env: string; cfg: FlagConfig }> {
  const out: Array<{ env: string; cfg: FlagConfig }> = [];
  if (Array.isArray(flag.configs)) {
    for (const cfg of flag.configs) {
      out.push({ env: envSlugOf(cfg) ?? "?", cfg });
    }
  } else if (isRecord(flag.configs)) {
    for (const [env, cfg] of Object.entries(flag.configs)) {
      out.push({ env, cfg });
    }
  }
  const order = ["dev", "development", "stage", "staging", "prod", "production"];
  out.sort((a, b) => {
    const ai = order.indexOf(a.env);
    const bi = order.indexOf(b.env);
    return (ai === -1 ? order.length : ai) - (bi === -1 ? order.length : bi) || a.env.localeCompare(b.env);
  });
  return out;
}

export function envSlugOf(cfg: FlagConfig): string | undefined {
  if (typeof cfg.environment === "string") return cfg.environment;
  if (isRecord(cfg.environment) && typeof cfg.environment.slug === "string") return cfg.environment.slug;
  return cfg.env ?? cfg.envSlug ?? cfg.environment_slug;
}

export function rolloutPctOf(cfg: FlagConfig): number | undefined {
  return cfg.rolloutPct ?? cfg.rollout_pct;
}

export function isKilled(cfg: FlagConfig): boolean {
  return cfg.killed === true || cfg.killedAt != null || cfg.killed_at != null;
}

// ---------------------------------------------------------------------------
// Project / flag resolution
// ---------------------------------------------------------------------------

const PROJECT_KEYS = ["projects", "data", "items"] as const;

export async function listProjects(ctx: ApiCtx): Promise<Project[]> {
  const payload = await apiFetch(ctx, { method: "GET", path: "/api/v1/projects" });
  const projects = pluckArray<Project>(payload, PROJECT_KEYS);
  if (!projects) {
    throw new ToolError("Unexpected response from GET /api/v1/projects, could not find a project list.");
  }
  return projects;
}

function projectLabel(p: Project): string {
  const envs = (p.environments ?? [])
    .map((e) => e.slug ?? e.name)
    .filter((s): s is string => typeof s === "string");
  const envNote = envs.length > 0 ? `, envs: ${envs.join(", ")}` : "";
  return `  • ${p.slug ?? p.id}${p.name && p.name !== p.slug ? ` (${p.name})` : ""}${envNote}`;
}

/**
 * Resolve which project to operate on. When `projectSlug` is omitted and the
 * org has exactly one project, default to it; if several exist, come back
 * with the list (as a non-error result) so the agent can retry with a slug.
 */
export async function resolveProject(ctx: ApiCtx, projectSlug: string | undefined): Promise<Project> {
  const projects = await listProjects(ctx);

  if (projects.length === 0) {
    throw new ToolError(
      "This organization has no projects yet. Create one in the ShipOS dashboard (or via the API) first.",
    );
  }

  if (projectSlug !== undefined) {
    const match = projects.find((p) => p.slug === projectSlug || p.id === projectSlug);
    if (!match) {
      throw new ToolError(
        `No project with slug "${projectSlug}". Available projects:\n${projects.map(projectLabel).join("\n")}`,
      );
    }
    return match;
  }

  const only = projects[0];
  if (projects.length === 1 && only) return only;

  throw new ToolError(
    `This organization has ${projects.length} projects, pass projectSlug to pick one:\n` +
      projects.map(projectLabel).join("\n"),
    { isError: false },
  );
}

export interface ResolvedFlag {
  project: Project;
  flag: Flag;
}

/**
 * Resolve a flag by business key via GET /api/v1/flags/lookup.
 * Needs a project slug; defaults like resolveProject when omitted.
 */
export async function resolveFlag(
  ctx: ApiCtx,
  projectSlug: string | undefined,
  key: string,
): Promise<ResolvedFlag> {
  const project = await resolveProject(ctx, projectSlug);
  const slug = project.slug ?? projectSlug;
  if (!slug) {
    throw new ToolError(`Project ${project.id} has no slug in the API response, cannot use /flags/lookup.`);
  }
  const payload = await apiFetch(ctx, {
    method: "GET",
    path: `/api/v1/flags/lookup?projectSlug=${encodeURIComponent(slug)}&key=${encodeURIComponent(key)}`,
    flagKey: key,
    projectSlug: slug,
  });
  const flag = normalizeFlag(payload);
  if (!flag) {
    throw new ToolError(`Unexpected response from GET /api/v1/flags/lookup for "${key}", no flag in payload.`);
  }
  return { project, flag };
}
