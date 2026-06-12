import { createHash } from 'node:crypto';

/**
 * Computes a deterministic SHA-256 hash for artifact content.
 * 
 * Rules:
 * - normalizes line endings to \n
 * - trims trailing whitespace per line
 * - removes leading/trailing blank lines from the block
 * - uses sha256:<hex> format
 * 
 * @param canonicalContent The canonical extracted artifact block, not the display excerpt
 * @returns Formatted hash string e.g. "sha256:<hex>" or null if input is empty
 */
export function computeArtifactContentHash(canonicalContent: string | null | undefined): string | null {
  if (!canonicalContent) {
    return null;
  }

  // 1. Split into lines (handling both \r\n and \n)
  const lines = canonicalContent.split(/\r?\n/);

  // 2. Trim trailing whitespace per line
  const trimmedLines = lines.map(line => line.replace(/[ \t]+$/, ''));

  // 3. Remove leading/trailing blank lines
  let startIdx = 0;
  while (startIdx < trimmedLines.length && trimmedLines[startIdx] === '') {
    startIdx++;
  }

  let endIdx = trimmedLines.length - 1;
  while (endIdx >= startIdx && trimmedLines[endIdx] === '') {
    endIdx--;
  }

  if (startIdx > endIdx) {
    return null; // Content was entirely blank
  }

  const activeLines = trimmedLines.slice(startIdx, endIdx + 1);

  // 4. Re-join with exact '\n'
  const normalizedContent = activeLines.join('\n');

  // 5. Compute SHA-256
  const digest = createHash('sha256').update(normalizedContent).digest('hex');

  return `sha256:${digest}`;
}
