import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@shipos/core", "@shipos/db"],
  typedRoutes: false,
  // PostHog reverse proxy (EU cloud): first-party path so analytics survive
  // ad-blockers. Deliberately NOT "/ingest", which is PostHog's documented
  // default and is matched by ad-blocker filter lists. Same prefix as
  // shipos-landing; keep it bland (no analytics/telemetry/track/ingest).
  async rewrites() {
    return [
      {
        source: "/dock/static/:path*",
        destination: "https://eu-assets.i.posthog.com/static/:path*",
      },
      {
        source: "/dock/:path*",
        destination: "https://eu.i.posthog.com/:path*",
      },
    ];
  },
  // PostHog rewrites need trailing-slash passthrough.
  skipTrailingSlashRedirect: true,
};

export default nextConfig;
