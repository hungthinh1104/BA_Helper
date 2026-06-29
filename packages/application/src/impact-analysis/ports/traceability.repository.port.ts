export type TraceabilityUpsertInput = {
  impactAnalysisId: string;
  artifactId: string;
  linkType: 'AFFECTED' | 'RELATED';
  linkBasis: 'EVIDENCED' | 'INFERRED';
  reviewStatus: 'NEEDS_REVIEW' | 'CONFIRMED' | 'REJECTED';
  confidence: number;
  retrievalMetadata: {
    method: string;
    signals: string[];
    reason: string;
    strategyVersion?: string;
    score: {
      final: number;
      lexical?: number;
      graph?: number;
      vector?: number;
      domain?: number;
    };
    diagnostics?: unknown;
    suggestion?: unknown;
  };
};

export type TraceabilityRecord = {
  id: string;
  artifactId: string;
};

export interface TraceabilityRepositoryPort {
  upsertMany(inputs: TraceabilityUpsertInput[]): Promise<TraceabilityRecord[]>;
  linkEvidence(params: { linkId: string; evidenceIds: string[] }): Promise<unknown>;
}
