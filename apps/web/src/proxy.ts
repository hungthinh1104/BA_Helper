import { NextResponse, type NextRequest } from "next/server"
import { getToken } from "next-auth/jwt"
import { buildLoginRedirect, getSafeNext, isProtectedAppPath, isPublicWebPath } from "@/lib/auth-routing"

import { resolveNextAuthSecret } from "@/lib/auth-secret"
export async function proxy(request: NextRequest) {
  // --- PREVIEW BASIC AUTH GUARD ---
  if (process.env.PREVIEW_AUTH_ENABLED === 'true') {
    const basicAuth = request.headers.get('authorization');
    const expectedUser = process.env.PREVIEW_USERNAME || 'demo';
    const expectedPwd = process.env.PREVIEW_PASSWORD;

    if (!expectedPwd) {
      console.error('PREVIEW_AUTH_ENABLED is true, but PREVIEW_PASSWORD is not set.');
      return new NextResponse('Configuration Error: Password not set', { status: 500 });
    }

    let isAuthenticated = false;
    if (basicAuth) {
      const authValue = basicAuth.split(' ')[1];
      if (authValue) {
        const [user, pwd] = atob(authValue).split(':');
        if (user === expectedUser && pwd === expectedPwd) {
          isAuthenticated = true;
        }
      }
    }

    if (!isAuthenticated) {
      return new NextResponse('Authentication Required', {
        status: 401,
        headers: {
          'WWW-Authenticate': 'Basic realm="Secure BA Helper Preview Area"',
        },
      });
    }
  }
  // --- END PREVIEW BASIC AUTH GUARD ---

  const { pathname, search } = request.nextUrl

  if (isPublicWebPath(pathname)) {
    if (pathname === "/login") {
      const token = await getToken({
        req: request,
        secret: resolveNextAuthSecret(),
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
    secret: resolveNextAuthSecret(),
  })

  if (!token) {
    return NextResponse.redirect(new URL(buildLoginRedirect(pathname, search), request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
}
