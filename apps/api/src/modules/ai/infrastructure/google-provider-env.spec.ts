import { resolveGoogleProviderApiKey } from './google-provider-env';

describe('resolveGoogleProviderApiKey', () => {
  it('skips blank GOOGLE_API_KEY and falls back to GEMINI_API_KEY', () => {
    expect(
      resolveGoogleProviderApiKey({
        GOOGLE_API_KEY: '   ',
        GEMINI_API_KEY: 'gemini-secret',
        GOOGLE_AI_API_KEY: 'google-ai-secret',
      } as NodeJS.ProcessEnv),
    ).toBe('gemini-secret');
  });

  it('returns null when all configured keys are blank', () => {
    expect(
      resolveGoogleProviderApiKey({
        GOOGLE_API_KEY: '',
        GEMINI_API_KEY: '   ',
        GOOGLE_AI_API_KEY: '\n',
      } as NodeJS.ProcessEnv),
    ).toBeNull();
  });
});
