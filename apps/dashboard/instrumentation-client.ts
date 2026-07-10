import posthog from "posthog-js";

// Events go through the first-party /dock proxy (see next.config.ts
// rewrites) so ad-blockers don't eat them; ui_host points toolbar/links at
// the real PostHog EU app. "/dock" is intentionally bland: "/ingest" is
// PostHog's documented default and is on ad-blocker filter lists.
// NOTE: this file must live at the app root (not app/); Next.js only
// loads instrumentation-client.ts from the root or src/.
posthog.init(process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN!, {
  api_host: "/dock",
  ui_host: "https://eu.posthog.com",
  defaults: "2026-01-30",
});
