import { parseAsString, parseAsStringLiteral } from "nuqs";

import type { AnalyticsPeriod } from "@/lib/api-types";

export const ANALYTICS_PERIODS = [
  "24h",
  "7d",
  "30d",
  "90d",
] as const satisfies readonly AnalyticsPeriod[];

/** Shared by Analytics page + flag detail analytics panel. */
export const analyticsSearchParams = {
  period: parseAsStringLiteral(ANALYTICS_PERIODS).withDefault("7d"),
  country: parseAsString,
  region: parseAsString,
};

export const auditActorValues = ["all", "user", "agent"] as const;

export const auditSearchParams = {
  actor: parseAsStringLiteral(auditActorValues).withDefault("all"),
  subject: parseAsString,
};

export type AuditActorFilter = (typeof auditActorValues)[number];
