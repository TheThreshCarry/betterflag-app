import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@betterflag/core", "@betterflag/db", "@betterflag/observability"],
  // MapLibre 6's dynamic worker `new URL(…, import.meta.url)` breaks Turbopack
  // analysis. Keep the package external to the bundler where possible.
  serverExternalPackages: ["maplibre-gl"],
  typedRoutes: false,
  // PostHog reverse proxy (EU cloud): first-party path so analytics survive
  // ad-blockers. Deliberately NOT "/ingest", which is PostHog's documented
  // default and is matched by ad-blocker filter lists. Same prefix as
  // betterflag-landing; keep it bland (no analytics/telemetry/track/ingest).
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
  // Retire dashboard.betterflag.app if that host still points at this deployment.
  async redirects() {
    return [
      {
        source: "/",
        has: [{ type: "host", value: "dashboard.betterflag.app" }],
        destination: "https://dashboard.betterflag.app/",
        permanent: true,
      },
      {
        source: "/:path*",
        has: [{ type: "host", value: "dashboard.betterflag.app" }],
        destination: "https://dashboard.betterflag.app/:path*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
