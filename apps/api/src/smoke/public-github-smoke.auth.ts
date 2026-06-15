export interface ResolveSmokeAuthTokenParams {
  suppliedToken?: string | null;
  enableDevLogin: boolean;
  allowDevLoginFallback: boolean;
  devLoginEmail: string;
  devLoginRole: string;
  validateToken: (token: string) => Promise<{ email?: string | null }>;
  devLogin: (input: {
    email: string;
    role: string;
  }) => Promise<{ accessToken: string; user: { email: string } }>;
  onLog?: (message: string) => void;
}

export async function resolveSmokeAuthTokenWithPolicy(
  params: ResolveSmokeAuthTokenParams,
): Promise<{
  mode: 'supplied-token' | 'dev-login';
  token: string;
  email: string | null;
}> {
  const suppliedToken = params.suppliedToken?.trim();

  if (suppliedToken) {
    try {
      const me = await params.validateToken(suppliedToken);
      params.onLog?.('Smoke auth: using supplied bearer token.');
      return {
        mode: 'supplied-token',
        token: suppliedToken,
        email: me.email ?? null,
      };
    } catch (error) {
      if (!params.allowDevLoginFallback || !params.enableDevLogin) {
        throw new Error(
          `AUTH_SUPPLIED_TOKEN_FAILED: ${error instanceof Error ? error.message : String(error)}`,
        );
      }

      params.onLog?.(
        'Smoke auth: supplied bearer token failed, falling back to dev-login because SMOKE_ALLOW_DEV_LOGIN_FALLBACK=true.',
      );
    }
  }

  if (!params.enableDevLogin) {
    throw new Error(
      'AUTH_BOOTSTRAP_FAILED: no valid SMOKE_BEARER_TOKEN supplied and ENABLE_DEV_LOGIN is not true.',
    );
  }

  const login = await params.devLogin({
    email: params.devLoginEmail,
    role: params.devLoginRole,
  });
  params.onLog?.(`Smoke auth: bootstrapped token via dev-login for ${login.user.email}.`);

  return {
    mode: 'dev-login',
    token: login.accessToken,
    email: login.user.email,
  };
}
