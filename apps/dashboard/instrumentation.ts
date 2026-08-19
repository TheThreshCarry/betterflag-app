/**
 * Better Stack Errors (Sentry-compatible). Tracing stays on OTel — do not
 * enable Sentry performance tracing or we duplicate spans.
 */
export async function register(): Promise<void> {
  const dsn = process.env.BETTER_STACK_ERRORS_DSN ?? process.env.NEXT_PUBLIC_BETTER_STACK_ERRORS_DSN;
  if (!dsn) return;
  const Sentry = await import("@sentry/nextjs");
  Sentry.init({
    dsn,
    environment: process.env.BETTERFLAG_ENV ?? process.env.VERCEL_ENV ?? process.env.NODE_ENV,
    release: process.env.BETTERFLAG_RELEASE ?? process.env.VERCEL_GIT_COMMIT_SHA,
    tracesSampleRate: 0,
    sendDefaultPii: false,
  });
}
