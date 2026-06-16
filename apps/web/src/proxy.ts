import { NextResponse, type NextRequest } from "next/server"
import { getToken } from "next-auth/jwt"
import { buildLoginRedirect, getSafeNext, isProtectedAppPath, isPublicWebPath } from "@/lib/auth-routing"

const DEFAULT_NEXTAUTH_SECRET = "dev-super-secret-key-nextauth"

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl

  if (isPublicWebPath(pathname)) {
    if (pathname === "/login") {
      const token = await getToken({
        req: request,
        secret: process.env.NEXTAUTH_SECRET || DEFAULT_NEXTAUTH_SECRET,
      })

      if (token) {
        const safeNext = getSafeNext(request.nextUrl.searchParams.get("next"))
        return NextResponse.redirect(new URL(safeNext, request.url))
      }
    }

    return NextResponse.next()
  }

  if (!isProtectedAppPath(pathname)) {
    return NextResponse.next()
  }

  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET || DEFAULT_NEXTAUTH_SECRET,
  })

  if (!token) {
    return NextResponse.redirect(new URL(buildLoginRedirect(pathname, search), request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
}
