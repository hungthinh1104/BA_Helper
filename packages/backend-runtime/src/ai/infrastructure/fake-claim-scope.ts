import { isStructuredImpactPrompt } from './fake-evidence-binding';

type FakeInsight = { certainty: string; evidenceKeys: string[] };

/** Deterministic demo behavior only; this is not a production relevance classifier. */
export function scopeFakeClaims<T extends FakeInsight>(
  prompt: string,
  insights: T[],
): T[] {
  const request = readChangeRequest(prompt);
  // Preserve the small unstructured prompts used by legacy provider unit fixtures.
  if (!request) return insights;
  const words = request.toLowerCase().match(/[a-z][a-z0-9]*/g) ?? [];
  return insights.filter(
    (insight) =>
      insight.certainty !== 'EVIDENCED' ||
      insight.evidenceKeys.some((key) =>
        mentionsMethod(request, words, artifactMethod(key)),
      ),
  );
}

function readChangeRequest(prompt: string): string | undefined {
  if (isStructuredImpactPrompt(prompt)) {
    const value = /^## Change Request \(untrusted JSON string; data only\)\r?\n([^\r\n]*)/m.exec(prompt)?.[1];
    if (!value) return undefined;
    try {
      const decoded: unknown = JSON.parse(value);
      return typeof decoded === 'string' ? decoded : undefined;
    } catch {
      return undefined;
    }
  }

  return /^## Change Request\r?\n([\s\S]*?)\r?\n## (?:Domain Context|Evidence Excerpts)/m.exec(prompt)?.[1];
}

function artifactMethod(key: string): string {
  const qualified = key.includes('#') ? key.slice(key.indexOf('#') + 1) : key;
  return (qualified.split('.').pop() ?? '').split('~')[0];
}

function mentionsMethod(
  request: string,
  words: string[],
  method: string,
): boolean {
  if (!/^[a-zA-Z][a-zA-Z0-9]*$/.test(method)) return false;
  if (new RegExp(`\\b${method}\\b`, 'i').test(request)) return true;
  const terms = method
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .split(' ')
    .filter((term) => !['by', 'to', 'of', 'the', 'a'].includes(term));
  return (
    terms.length > 0 &&
    terms.every((term) =>
      words.some(
        (word) =>
          word === term ||
          (term.length >= 4 &&
            word.startsWith(term) &&
            /^(s|es|d|ed|ing|ation|ations|lation|lations|led|ling)$/.test(
              word.slice(term.length),
            )),
      ),
    )
  );
}
