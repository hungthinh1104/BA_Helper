import { resolveSmokeAuthTokenWithPolicy } from './public-github-smoke.auth';

describe('resolveSmokeAuthTokenWithPolicy', () => {
  it('keeps supplied token authoritative when validation succeeds', async () => {
    const result = await resolveSmokeAuthTokenWithPolicy({
      suppliedToken: 'token-1',
      enableDevLogin: true,
      allowDevLoginFallback: true,
      devLoginEmail: 'smoke@example.com',
      devLoginRole: 'ADMIN',
      validateToken: jest.fn().mockResolvedValue({ email: 'supplied@example.com' }),
      devLogin: jest.fn(),
    });

    expect(result).toEqual({
      mode: 'supplied-token',
      token: 'token-1',
      email: 'supplied@example.com',
    });
  });

  it('fails with AUTH_SUPPLIED_TOKEN_FAILED when supplied token is invalid and fallback is disabled', async () => {
    await expect(
      resolveSmokeAuthTokenWithPolicy({
        suppliedToken: 'bad-token',
        enableDevLogin: true,
        allowDevLoginFallback: false,
        devLoginEmail: 'smoke@example.com',
        devLoginRole: 'ADMIN',
        validateToken: jest.fn().mockRejectedValue(new Error('401 unauthorized')),
        devLogin: jest.fn(),
      }),
    ).rejects.toThrow('AUTH_SUPPLIED_TOKEN_FAILED');
  });

  it('uses dev-login when no token is supplied and dev-login is enabled', async () => {
    const result = await resolveSmokeAuthTokenWithPolicy({
      suppliedToken: '',
      enableDevLogin: true,
      allowDevLoginFallback: false,
      devLoginEmail: 'smoke@example.com',
      devLoginRole: 'ADMIN',
      validateToken: jest.fn(),
      devLogin: jest.fn().mockResolvedValue({
        accessToken: 'dev-token',
        user: { email: 'smoke@example.com' },
      }),
    });

    expect(result).toEqual({
      mode: 'dev-login',
      token: 'dev-token',
      email: 'smoke@example.com',
    });
  });
});
