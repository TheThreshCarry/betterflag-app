import {
  formatRelease,
  readObservability,
  type Fields,
} from "@betterflag/observability";

const SERVICE = "betterflag-admin";

function environment(): string {
  return process.env.BETTERFLAG_ENV ?? process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "development";
}

function obs() {
  return readObservability(process.env, SERVICE, {
    environment: environment(),
    release: formatRelease({
      version: "0.1.0",
      gitSha: process.env.BETTERFLAG_GIT_SHA ?? process.env.VERCEL_GIT_COMMIT_SHA,
      override: process.env.BETTERFLAG_RELEASE,
    }),
    runtime: "node",
  });
}

export async function logAdminAction(
  action: string,
  fields: Fields & { outcome: "ok" | "error" },
): Promise<void> {
  const telemetry = obs();
  const payload = {
    ...fields,
    "event.name": `admin.${action}`,
    "event.outcome": fields.outcome,
  };
  if (fields.outcome === "error") telemetry.logger.error(`admin ${action}`, payload);
  else telemetry.logger.info(`admin ${action}`, payload);
  await telemetry.flush();
}
