export const REQUIRED_PINNED_BROWSER_PROOF_SAMPLES = 5;
export type PinnedBrowserRunStatus = 'PASSED' | 'FAILED' | 'INCOMPLETE';

export function hasRequiredBrowserProofSamples(sampleCount: number): boolean {
  return Number.isInteger(sampleCount) && sampleCount >= REQUIRED_PINNED_BROWSER_PROOF_SAMPLES;
}

export function isPinnedBrowserProofRequired(value: string | undefined): boolean {
  return value === '1';
}

export function resolvePinnedBrowserRunStatus(
  exitCode: number | null,
  sampleCount: number,
  cleanupSucceeded = true,
): PinnedBrowserRunStatus {
  if (exitCode !== 0 || !cleanupSucceeded) return 'FAILED';
  return hasRequiredBrowserProofSamples(sampleCount) ? 'PASSED' : 'INCOMPLETE';
}
