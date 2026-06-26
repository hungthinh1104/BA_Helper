export type InsightInputParams = {
  impactAnalysisId: string;
  insightKey: string;
  insightType: 'CLAIM' | 'UNKNOWN' | 'QUESTION' | 'ACCEPTANCE_CRITERIA' | 'QA_SCENARIO';
  certainty: 'EVIDENCED' | 'INFERRED' | 'UNKNOWN' | 'CONFLICTING';
  reviewStatus: 'NEEDS_REVIEW' | 'CONFIRMED' | 'REJECTED';
  confidence: number | null;
  title: string;
  description: string;
  reasoning?: string | null;
  metadata?: Record<string, unknown>;
};

export type InsightRecord = {
  id: string;
  insightKey: string;
  certainty: 'EVIDENCED' | 'INFERRED' | 'UNKNOWN' | 'CONFLICTING';
};

export interface InsightRepositoryPort {
  upsertMany(inputs: InsightInputParams[]): Promise<InsightRecord[]>;
  linkEvidence(params: { insightId: string; evidenceIds: string[] }): Promise<unknown>;
}
