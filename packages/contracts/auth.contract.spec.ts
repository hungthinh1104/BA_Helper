import {
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
});
