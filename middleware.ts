import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

const PROTECTED_PREFIXES = ["/dashboard", "/account", "/organization"]
const SIGN_IN_PATH = "/auth/sign-in"

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  const isProtected = PROTECTED_PREFIXES.some((prefix) =>
    pathname.startsWith(prefix)
  )

  if (!isProtected) {
    return NextResponse.next()
  }

  const sessionToken =
    request.cookies.get("better-auth.session_token")?.value ||
    request.cookies.get("__Secure-better-auth.session_token")?.value

  if (!sessionToken) {
    const signInUrl = new URL(SIGN_IN_PATH, request.url)
    signInUrl.searchParams.set("callbackURL", pathname)
    return NextResponse.redirect(signInUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/dashboard/:path*", "/account/:path*", "/organization/:path*"],
}
