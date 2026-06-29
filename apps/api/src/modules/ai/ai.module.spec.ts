import { resolveAiProvider } from '@ba-helper/shared';

describe('resolveAiProvider', () => {
  it('normalizes whitespace and casing', () => {
    expect(resolveAiProvider('  Google  ')).toBe('google');
  });

  it('fails fast on unsupported provider names', () => {
    expect(() => resolveAiProvider('gemeni')).toThrow(
      'Unsupported AI_PROVIDER "gemeni"',
    );
  });
});
