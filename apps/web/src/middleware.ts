import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(req: NextRequest) {
  // Only apply Basic Auth if explicitly enabled in the environment
  if (process.env.PREVIEW_AUTH_ENABLED !== 'true') {
    return NextResponse.next();
  }

  const basicAuth = req.headers.get('authorization');
  const expectedUser = process.env.PREVIEW_USERNAME || 'demo';
  const expectedPwd = process.env.PREVIEW_PASSWORD;

  if (!expectedPwd) {
    console.error('PREVIEW_AUTH_ENABLED is true, but PREVIEW_PASSWORD is not set.');
    // Let it pass or fail? Fail safe: return 500 or require auth anyway (which will fail).
    return new NextResponse('Configuration Error: Password not set', { status: 500 });
  }

  if (basicAuth) {
    const authValue = basicAuth.split(' ')[1];
    if (authValue) {
      const [user, pwd] = atob(authValue).split(':');

      if (user === expectedUser && pwd === expectedPwd) {
        return NextResponse.next();
      }
    }
  }

  return new NextResponse('Authentication Required', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="Secure BA Helper Preview Area"',
    },
  });
}

export const config = {
  // Apply middleware to all routes except Next.js static assets and favicon
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
