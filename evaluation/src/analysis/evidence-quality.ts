const CODE_TOKENS = [
  'function',
  'class',
  'async',
  'await',
  'return',
  'if',
  'throw',
  'const',
  'let',
  '=>',
  '{',
  '}',
  '@Controller',
  '@Injectable',
  'describe(',
  'it(',
  'expect(',
] as const;

const LOCATION_ONLY_PATTERNS = [
  /^[\w./-]+\.(ts|tsx|js|jsx|java|go|py|cs|php|rb):\d+(?:-\d+)?(?:\s+\([^)]+\))?$/i,
  /^[\w./-]+\.(ts|tsx|js|jsx|java|go|py|cs|php|rb):\d+(?::\d+)?$/i,
  /^[\w./-]+\.(ts|tsx|js|jsx|java|go|py|cs|php|rb)\s+\([^)]+\)$/i,
] as const;

function normalizeWhitespace(input: string): string {
  return input.replace(/\s+/g, ' ').trim();
}

export function isLocationOnlyEvidence(excerpt: string): boolean {
  const normalized = normalizeWhitespace(excerpt);

  if (normalized.length === 0) {
    return false;
  }

  if (LOCATION_ONLY_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return true;
  }

  const hasFilePath = /\b[\w./-]+\.(ts|tsx|js|jsx|java|go|py|cs|php|rb)\b/i.test(
    normalized,
  );
  const hasLineRange = /:\d+(?:-\d+)?/.test(normalized);
  const hasSymbolHint = /\([A-Za-z_$][\w$.#]*\)/.test(normalized);
  const hasCodeMarkers = CODE_TOKENS.some((token) => normalized.includes(token));

  return (
    normalized.length <= 120 &&
    hasFilePath &&
    (hasLineRange || hasSymbolHint) &&
    !hasCodeMarkers
  );
}

export function isCodeLikeEvidence(excerpt: string): boolean {
  const normalized = excerpt.trim();

  if (normalized.length === 0 || isLocationOnlyEvidence(normalized)) {
    return false;
  }

  return CODE_TOKENS.some((token) => normalized.includes(token));
}

export function summarizeEvidenceQuality(excerpt?: string): {
  hasEvidence: boolean;
  excerptLength: number;
  excerptPreview: string;
  isLocationOnly: boolean;
  isCodeLike: boolean;
} {
  const trimmed = excerpt?.trim() ?? '';
  const hasEvidence = trimmed.length > 0;
  const excerptPreview =
    trimmed.length <= 180 ? trimmed : `${trimmed.slice(0, 177)}...`;
  const isLocationOnly = hasEvidence ? isLocationOnlyEvidence(trimmed) : false;
  const isCodeLike = hasEvidence ? isCodeLikeEvidence(trimmed) : false;

  return {
    hasEvidence,
    excerptLength: trimmed.length,
    excerptPreview,
    isLocationOnly,
    isCodeLike,
  };
}
