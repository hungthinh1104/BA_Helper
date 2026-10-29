import type { Prisma } from '@prisma/client';

type AnalysisEvidenceIdentity = {
  snapshotId: string | null;
  artifactId: string | null;
  requirementRevisionId: string | null;
  artifact?: { snapshotId: string } | null;
};

export function isEvidenceScopedToAnalysis(
  evidence: AnalysisEvidenceIdentity,
  analysis: { snapshotId: string; requirementRevisionId: string },
): boolean {
  const artifactMatches = evidence.artifactId === null ||
    evidence.artifact?.snapshotId === analysis.snapshotId;
  const revisionMatches = evidence.requirementRevisionId === null ||
    evidence.requirementRevisionId === analysis.requirementRevisionId;
  const originMatches = evidence.snapshotId === analysis.snapshotId ||
    (evidence.snapshotId === null && evidence.requirementRevisionId === analysis.requirementRevisionId);

  return artifactMatches && revisionMatches && originMatches;
}

export function analysisEvidenceScopeWhere(
  snapshotId: string,
  requirementRevisionId: string,
): Prisma.EvidenceWhereInput {
  const artifactBelongsToSnapshot = {
    OR: [{ artifactId: null }, { artifact: { snapshotId } }],
  };

  return {
    OR: [
      {
        snapshotId,
        AND: [
          artifactBelongsToSnapshot,
          { OR: [{ requirementRevisionId: null }, { requirementRevisionId }] },
        ],
      },
      {
        requirementRevisionId,
        snapshotId: null,
        ...artifactBelongsToSnapshot,
      },
    ],
  };
}
