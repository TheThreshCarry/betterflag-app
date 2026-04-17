import posthog from "posthog-js"
import * as Sentry from "@sentry/nextjs"

posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
  api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
  ui_host: "https://eu.posthog.com",
  defaults: "2026-01-30",
  capture_pageview: false,
  capture_pageleave: true,
  person_profiles: "always",
});

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.2,
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0,
})
