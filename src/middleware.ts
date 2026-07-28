import { NextResponse, type NextRequest } from "next/server"

import { hasSessionCookie } from "@/auth/cookies"

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const hasSession = hasSessionCookie(request)

  if (pathname.startsWith("/dashboard") && !hasSession) {
    return NextResponse.redirect(new URL("/", request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/dashboard/:path*"],
}
