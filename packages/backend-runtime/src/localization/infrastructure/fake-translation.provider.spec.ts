import { FakeTranslationProvider } from './fake-translation.provider';
import type { TranslationRequest } from '../application/translation-provider.port';

describe('FakeTranslationProvider', () => {
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    if (originalNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = originalNodeEnv;
    }
  });

  it('refuses to return placeholder translations in production', async () => {
    process.env.NODE_ENV = 'production';
    const provider = new FakeTranslationProvider();

    await expect(provider.translate({} as TranslationRequest)).rejects.toThrow(
      'FakeTranslationProvider is forbidden in production',
    );
  });
});
