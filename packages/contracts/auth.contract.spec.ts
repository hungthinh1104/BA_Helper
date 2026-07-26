import {
  accountPasswordResetRequestSchema,
  accountProvisionRequestSchema,
  devLoginRequestSchema,
  loginRequestSchema,
} from './src/auth.contract';

describe('auth contracts', () => {
  it('accepts the documented demo credentials', () => {
    expect(
      loginRequestSchema.parse({
        email: 'demo@ba-helper.local',
        password: 'demo-password-2026',
      }),
    ).toEqual({
      email: 'demo@ba-helper.local',
      password: 'demo-password-2026',
    });
  });

  it('requires email and password for production login', () => {
    expect(
      loginRequestSchema.parse({
        email: 'analyst@ba-helper.local',
        password: 'correct-password-123',
      }),
    ).toEqual({
      email: 'analyst@ba-helper.local',
      password: 'correct-password-123',
    });

    expect(() =>
      loginRequestSchema.parse({
        email: 'analyst@ba-helper.local',
        role: 'ADMIN',
      }),
    ).toThrow();
  });

  it('keeps dev-login role selection in a separate schema', () => {
    expect(
      devLoginRequestSchema.parse({
        email: 'analyst@ba-helper.local',
        role: 'REVIEWER',
      }),
    ).toEqual({
      email: 'analyst@ba-helper.local',
      role: 'REVIEWER',
    });

    expect(() =>
      devLoginRequestSchema.parse({
        email: 'analyst@ba-helper.local',
        role: 'OWNER',
      }),
    ).toThrow();
  });

  it('normalizes email to trimmed lowercase across login, dev-login, and provision', () => {
    expect(
      loginRequestSchema.parse({
        email: '  Analyst@BA-Helper.LOCAL ',
        password: 'correct-password-123',
      }).email,
    ).toBe('analyst@ba-helper.local');

    expect(
      devLoginRequestSchema.parse({
        email: 'Mixed.Case@Example.COM',
        role: 'REVIEWER',
      }).email,
    ).toBe('mixed.case@example.com');

    expect(
      accountProvisionRequestSchema.parse({
        email: 'OPERATOR@Example.com',
        password: 'initial-password-123',
      }).email,
    ).toBe('operator@example.com');
  });

  it('requires strong explicit credentials for account operations', () => {
    expect(
      accountProvisionRequestSchema.parse({
        email: 'operator@example.com',
        password: 'initial-password-123',
      }),
    ).toMatchObject({
      email: 'operator@example.com',
      role: 'REVIEWER',
    });
    expect(() =>
      accountPasswordResetRequestSchema.parse({ password: 'short' }),
    ).toThrow();
  });
});
