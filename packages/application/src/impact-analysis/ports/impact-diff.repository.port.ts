import type { DiffArtifact, DiffInsight } from '@ba-helper/contracts';

/**
 * Data-access port for {@link GetImpactDiff}. The pure diff computation lives in
 * `packages/application`; concrete data fetching (Prisma) is supplied by an
 * adapter in `backend-runtime`, keeping the use case free of persistence and
 * framework dependencies (ADR-0010).
 */
export interface ImpactDiffAnalysisRecord {
  id: string;
  derivedFromAnalysisId: string | null;
  status: string;
  requirementRevisionId: string;
  snapshotId: string;
  sourceClarificationId: string | null;
  reviewClarificationRequestId: string | null;
  snapshot: { commitSha: string } | null;
}

export interface ImpactDiffArtifactLink {
  reviewStatus: DiffArtifact['reviewStatus'];
  artifact: {
    artifactKey: string;
    name: string;
    artifactType: string;
    universalKind: DiffArtifact['universalKind'];
    filePath: string;
  };
}

export interface ImpactDiffInsightRecord {
  id: string;
  insightKey: string;
  insightType: DiffInsight['category'];
  title: string;
  description: string;
  reviewStatus: DiffInsight['reviewStatus'];
}

export interface ImpactDiffRepositoryPort {
  /** Analysis with its snapshot, or null when the analysis id does not exist. */
  getAnalysis(analysisId: string): Promise<ImpactDiffAnalysisRecord | null>;
  /** AFFECTED, non-rejected traceability links with their artifacts. */
  getAffectedArtifactLinks(analysisId: string): Promise<ImpactDiffArtifactLink[]>;
  /** UNKNOWN and QA_SCENARIO insights for the analysis. */
  getDiffInsights(analysisId: string): Promise<ImpactDiffInsightRecord[]>;
  /** Source insight id of a clarification, or null when absent/not found. */
  getClarificationSourceInsightId(clarificationId: string): Promise<string | null>;
}
