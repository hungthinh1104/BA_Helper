import type { RetrievalSuggestion } from './retrieval-suggestion';
import type { DomainPackSelectedBy } from '@ba-helper/contracts';

export interface RetrievalDiagnostics {
  version: 'retrieval-diagnostics@0.1.0';
  lexicalScoreNorm: number;
  vectorScoreNorm: number;
  graphBoostNorm: number;
  kindBoostNorm: number;
  domainBoostNorm: number;
  matchedIntentLabels: Array<'API' | 'SERVICE' | 'DATA' | 'TEST'>;
  universalKind: string | null;
  repositoryProfile: {
    domain?: string | null;
    framework?: string | null;
    language?: string | null;
    /** true when the selected domain pack resolved to the safe fallback. */
    domainPackFallback?: boolean;
  } | null;
  /** Terms from the selected domain pack that appeared in the change request. Max 10. */
  matchedDomainTerms?: string[];
  domainPack?: {
    id: string;
    version: string;
    status: 'STABLE' | 'PARTIAL' | 'EXPERIMENTAL' | 'FALLBACK';
    selectedBy: DomainPackSelectedBy;
  };
  finalScore: number;
}

export interface RetrievedArtifact {
  artifactId: string;
  artifactKey: string;
  filePath: string;
  symbolName: string | null;
  artifactType: string;
  score: number;
  retrievalMethod: 'LEXICAL' | 'VECTOR' | 'GRAPH_EXPANSION' | 'HYBRID';
  retrievalSignals: Array<'LEXICAL' | 'GRAPH' | 'VECTOR' | 'DOMAIN' | 'KIND'>;
  retrievalReason: string;
  strategyVersion?: string;
  lexicalScore?: number;
  graphScore?: number;
  vectorScore?: number;
  domainBoost?: number;
  kindBoost?: number;
  finalScore?: number;
  suggestion?: RetrievalSuggestion;
  retrievalDiagnostics?: RetrievalDiagnostics;
}

/**
 * Tunable retrieval knobs. The defaults preserve the shipped behaviour; callers
 * can override per request — e.g. a benchmark, or a deployment whose embedding
 * model produces a different cosine scale than the default floor assumes.
 */
export interface RetrievalTuning {
  weights: { lexical: number; vector: number; graph: number; kindBoost: number };
  /** Vector-only candidates below this cosine similarity are dropped unless keepWeakVectorOnly. */
  minVectorSimilarity: number;
  /** Vector matches below this are treated as weak and penalised. */
  weakVectorThreshold: number;
  /**
   * Keep vector-only hits below minVectorSimilarity as low-confidence (penalised)
   * candidates instead of dropping them — surfaces cross-vocabulary paraphrase
   * matches that a fixed floor would otherwise silently discard.
   */
  keepWeakVectorOnly: boolean;
  /**
   * Rerank cutoff: after the top-N slice, also retain the next candidates whose
   * score is within this fraction of the last kept score — a high-confidence
   * tail a hard top-N cutoff would otherwise drop. 0 = hard cutoff (default).
   */
  adaptiveTailGap: number;
}

export const DEFAULT_RETRIEVAL_TUNING: RetrievalTuning = {
  weights: { lexical: 0.45, vector: 0.35, graph: 0.15, kindBoost: 0.05 },
  minVectorSimilarity: 0.72,
  weakVectorThreshold: 0.75,
  keepWeakVectorOnly: false,
  adaptiveTailGap: 0,
};

export interface RetrievalRequest {
  /** MVP: tenantId = projectId. Future: organizationId. Used to isolate vector search. */
  tenantId?: string;
  projectId: string;
  repositoryId: string;
  snapshotId: string;
  changeRequest: string;
  /** Domain pack/profile key e.g. 'booking'. Drives terminology-based keyword expansion. */
  domain?: string;
  expandGraph?: boolean;
  maxResults?: number;
  /** Optional per-request tuning override; unset knobs fall back to DEFAULT_RETRIEVAL_TUNING. */
  tuning?: Partial<RetrievalTuning>;
}
