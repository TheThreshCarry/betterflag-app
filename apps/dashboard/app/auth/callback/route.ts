/** OAuth / magic-link code exchange (@supabase/ssr). */

import { NextResponse, type NextRequest } from "next/server";

import { createSessionClient } from "@/lib/supabase/server";
import { createRequestObservability } from "@/lib/observability";
import { reportServerError } from "@/lib/observability";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const obs = createRequestObservability();
  const span = obs.tracer.startSpan("auth.callback", { kind: "server" });
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/";

  try {
    if (code) {
      const supabase = await createSessionClient();
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) {
        span.setAttribute("event.outcome", "ok").end();
        obs.logger.info("auth callback ok", {
          "event.name": "auth.callback",
          "event.outcome": "ok",
        });
        await obs.flush();
        return NextResponse.redirect(`${origin}${safeNext}`);
      }
      span.setStatus("error");
      obs.logger.error("auth code exchange failed", {
        "event.name": "auth.callback",
        "event.outcome": "error",
        detail: error.message,
      });
      reportServerError("auth code exchange failed", { detail: error.message });
    }
    span.setAttribute("event.outcome", "client_error").end();
    await obs.flush();
    return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
  } catch (error) {
    span.recordException(error).end();
    await obs.flush();
    throw error;
  }
}
