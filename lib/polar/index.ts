import { Polar } from "@polar-sh/sdk";
import { createLogger } from "@/lib/logger";

const log = createLogger("polar");

const globalForPolar = globalThis as unknown as { polar?: Polar };

function createPolarClient() {
  const server = "sandbox";
  log.info({ server }, "initializing Polar client");
  return new Polar({
    accessToken: process.env.POLAR_ACCESS_TOKEN!,
    server,
  });
}

export const polarClient = globalForPolar.polar ?? createPolarClient();

if (process.env.NODE_ENV !== "production") {
  globalForPolar.polar = polarClient;
}
