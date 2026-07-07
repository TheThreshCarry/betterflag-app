/** OAuth / magic-link code exchange (@supabase/ssr). */

import { NextResponse, type NextRequest } from "next/server";

import { createSessionClient } from "@/lib/supabase/server";
import { reportServerError } from "@/lib/observability";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/";

  if (code) {
    const supabase = await createSessionClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${safeNext}`);
    }
    console.error("[auth] code exchange failed:", error.message);
    reportServerError("auth code exchange failed", { detail: error.message });
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}
