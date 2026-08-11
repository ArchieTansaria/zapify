import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { DEFAULT_SESSION_KEY } from "@nhost/nhost-js/session"

export function middleware(request: NextRequest) {
  const isAppRoute = request.nextUrl.pathname.startsWith("/app")
  const isAuthRoute = request.nextUrl.pathname.startsWith("/signin") || request.nextUrl.pathname.startsWith("/signup")
  
  const sessionCookie = request.cookies.get(DEFAULT_SESSION_KEY)
  
  // We do a simple presence check. Deep token validation happens when data is fetched.
  const isAuthenticated = !!sessionCookie?.value

  if (isAppRoute && !isAuthenticated) {
    const url = request.nextUrl.clone()
    url.pathname = "/signin"
    url.searchParams.set("redirect", request.nextUrl.pathname)
    return NextResponse.redirect(url)
  }

  if (isAuthRoute && isAuthenticated) {
    const url = request.nextUrl.clone()
    url.pathname = "/app"
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/app/:path*", "/signin", "/signup"],
}
