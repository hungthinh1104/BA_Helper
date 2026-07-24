'use client';

import { useSession, signIn, signOut } from 'next-auth/react';
import type { LoginRequest, UserRole } from '@ba-helper/contracts';
import { normalizeAuthErrorCode, type AuthErrorCode } from '@/lib/auth-errors';

type SessionUser = {
  id?: string;
  name?: string | null;
  email?: string | null;
  role?: UserRole;
};

type LoginResult =
  | { ok: true }
  | { ok: false; errorCode: AuthErrorCode }

export function useAuth() {
  const { data: session, status } = useSession();
  const sessionUser = session?.user as SessionUser | undefined;

  const user = sessionUser ? {
    id: sessionUser.id,
    name: sessionUser.name ?? null,
    email: sessionUser.email ?? null,
    role: sessionUser.role,
  } : null;

  const login = async (credentials: LoginRequest, next = "/"): Promise<LoginResult> => {
    const result = await signIn("credentials", {
      email: credentials.email,
      password: credentials.password,
      redirect: false,
      callbackUrl: next,
    })

    if (!result || result.error) {
      return {
        ok: false,
        errorCode: normalizeAuthErrorCode(result?.error),
      }
    }

    if (result.url) {
      window.location.assign(result.url)
      return { ok: true }
    }

    window.location.assign(next)
    return { ok: true }
  }

  return {
    user,
    role: user?.role ?? null,
    isAuthenticated: status === 'authenticated',
    isLoading: status === 'loading',
    login,
    logout: () => signOut({ callbackUrl: '/login' }),
  };
}
