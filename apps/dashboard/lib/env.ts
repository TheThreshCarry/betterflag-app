/** Server-only environment access with a clear failure mode. */
export function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function optionalEnv(name: string): string | undefined {
  const value = process.env[name];
  return value && value.length > 0 ? value : undefined;
}

/** Env the dashboard cannot boot without (ITR-190). */
export const REQUIRED_DASHBOARD_ENV = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "POLAR_ACCESS_TOKEN",
  "POLAR_SERVER",
  "MCP_OAUTH_SHARED_SECRET",
] as const;

type EnvBag = Record<string, string | undefined>;

export function shouldAssertDashboardEnv(env: EnvBag = process.env): boolean {
  if (env.VITEST) return false;
  if (env.NODE_ENV === "test") return false;
  if (env.NEXT_RUNTIME === "edge") return false;
  const phase = env.NEXT_PHASE;
  if (phase === "phase-production-build" || phase === "phase-development-build") return false;
  return true;
}

export function assertRequiredDashboardEnv(env: EnvBag = process.env): void {
  const missing = REQUIRED_DASHBOARD_ENV.filter((name) => !env[name]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variable: ${missing.join(", ")}`);
  }
  const server = env.POLAR_SERVER;
  if (server !== "production" && server !== "sandbox") {
    throw new Error(
      'POLAR_SERVER must be "production" or "sandbox". Unset used to default to Polar sandbox, which has no Betterflag products.',
    );
  }
}
