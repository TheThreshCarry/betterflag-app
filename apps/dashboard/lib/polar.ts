import { Polar } from "@polar-sh/sdk";

import { optionalEnv, requiredEnv } from "@/lib/env";

/**
 * Server-only Polar client. Reads the organization access token and target
 * server (sandbox | production) from the environment.
 *
 * Polar is the single source of truth for pricing: products, prices, the
 * evaluations meter and the included-unit benefits all live there and are
 * mapped into the app + landing page via `lib/pricing.ts`.
 */
export function polarServer(): "sandbox" | "production" {
  const server = optionalEnv("POLAR_SERVER");
  return server === "production" ? "production" : "sandbox";
}

let cached: Polar | null = null;

export function getPolar(): Polar {
  if (cached) return cached;
  cached = new Polar({
    accessToken: requiredEnv("POLAR_ACCESS_TOKEN"),
    server: polarServer(),
  });
  return cached;
}
