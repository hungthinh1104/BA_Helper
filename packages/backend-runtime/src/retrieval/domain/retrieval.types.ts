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
}
