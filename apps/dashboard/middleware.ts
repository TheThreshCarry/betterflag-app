/**
 * Session refresh + auth gate for dashboard pages.
 *
 * The matcher EXCLUDES /api (the API does its own auth via resolveActor),
 * /auth (code exchange), Next internals and static assets.
 */

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isLogin = pathname === "/login";

  if (!user && !isLogin) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    // Preserve the destination (e.g. the MCP OAuth consent screen) so the
    // user lands back after signing in.
    const dest = pathname + request.nextUrl.search;
    if (dest !== "/") url.searchParams.set("next", dest);
    return NextResponse.redirect(url);
  }

  if (user && isLogin) {
    const next = request.nextUrl.searchParams.get("next");
    const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
    return NextResponse.redirect(new URL(safeNext, request.url));
  }

  return response;
}

export const config = {
  // Everything except: /api/*, /auth/*, Next internals, and files with an
  // extension (static assets).
  matcher: ["/((?!api/|auth/|_next/|favicon\\.ico|.*\\.[a-zA-Z0-9]+$).*)"],
};
