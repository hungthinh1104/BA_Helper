'use client';

import { useSession, signOut } from 'next-auth/react';
import type { UserRole } from '@ba-helper/contracts';

type SessionUser = {
  id?: string;
  name?: string | null;
  email?: string | null;
  role?: UserRole;
};

export function useAuth() {
  const { data: session, status } = useSession();
  const sessionUser = session?.user as SessionUser | undefined;

  const user = sessionUser ? {
    id: sessionUser.id,
    name: sessionUser.name ?? null,
    email: sessionUser.email ?? null,
    role: sessionUser.role,
  } : null;

  return {
    user,
    role: user?.role ?? null,
    isAuthenticated: status === 'authenticated',
    isLoading: status === 'loading',
    logout: () => signOut({ callbackUrl: '/login' }),
  };
}
