import type { DomainPack } from '@ba-helper/contracts';
import { buildDomainPackTerms } from '../../domain-pack/application/domain-pack-terminology';
import type { RetrievalTuning } from '../domain/retrieval.types';
import { DEFAULT_RETRIEVAL_TUNING } from '../domain/retrieval.types';

export const MAX_RETRIEVAL_RESULTS = 100;

export function normalizeRetrievalLimit(value: number): number {
  if (!Number.isFinite(value)) return 20;
  return Math.max(1, Math.min(Math.trunc(value), MAX_RETRIEVAL_RESULTS));
}

export function resolveRetrievalTuning(override?: Partial<RetrievalTuning>): RetrievalTuning {
  return {
    ...DEFAULT_RETRIEVAL_TUNING,
    ...override,
    weights: { ...DEFAULT_RETRIEVAL_TUNING.weights, ...override?.weights },
  };
}

export function extractRetrievalKeywords(text: string, domainPack: DomainPack): {
  glossaryMatches: string[];
  symbolMatches: string[];
} {
  const glossary = buildDomainPackTerms(domainPack);
  const lowerText = text.toLowerCase();
  const glossaryMatches = glossary.filter(term => lowerText.includes(term.toLowerCase()));
  const symbolPattern = /\b([a-zA-Z][a-z]+(?:[A-Z][a-z]+)+|[a-z]+(?:_[a-z]+)+)\b/g;
  const symbolMatches: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = symbolPattern.exec(text)) !== null) symbolMatches.push(match[1]);

  return {
    glossaryMatches: glossaryMatches.slice(0, 15),
    symbolMatches: Array.from(new Set(symbolMatches)).slice(0, 15),
  };
}
