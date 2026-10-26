import { hasRequiredBrowserProofSamples, isPinnedBrowserProofRequired,
  resolvePinnedBrowserRunStatus } from './pinned-comprehension-browser-status';

describe('pinned comprehension browser proof status', () => {
  it('runs the pinned browser journey only when explicitly requested', () => {
    expect(isPinnedBrowserProofRequired(undefined)).toBe(false);
    expect(isPinnedBrowserProofRequired('0')).toBe(false);
    expect(isPinnedBrowserProofRequired('1')).toBe(true);
  });

  it('does not consider a partial repeat run complete', () => {
    expect(hasRequiredBrowserProofSamples(0)).toBe(false);
    expect(hasRequiredBrowserProofSamples(4)).toBe(false);
  });

  it('considers the proof complete after all required browser samples exist', () => {
    expect(hasRequiredBrowserProofSamples(5)).toBe(true);
    expect(hasRequiredBrowserProofSamples(6)).toBe(true);
  });

  it('requires a clean Playwright process exit before reporting browser proof passed', () => {
    expect(resolvePinnedBrowserRunStatus(0, 5)).toBe('PASSED');
    expect(resolvePinnedBrowserRunStatus(1, 5)).toBe('FAILED');
    expect(resolvePinnedBrowserRunStatus(0, 4)).toBe('INCOMPLETE');
    expect(resolvePinnedBrowserRunStatus(0, 5, false)).toBe('FAILED');
  });
});
