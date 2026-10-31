import type { Prisma } from '@prisma/client';
import { AppError } from '@ba-helper/shared';

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

export async function assertEvidenceLinksScopedToAnalyses(
  client: Pick<Prisma.TransactionClient, 'evidence'>,
  scopesByOwnerId: Map<string, { snapshotId: string; requirementRevisionId: string }>,
  links: Array<{ ownerId: string; evidenceId: string }>,
): Promise<void> {
  if (links.length === 0) return;

  const evidenceRows = await client.evidence.findMany({
    where: { id: { in: [...new Set(links.map((link) => link.evidenceId))] } },
    select: {
      id: true,
      snapshotId: true,
      artifactId: true,
      requirementRevisionId: true,
      artifact: { select: { snapshotId: true } },
    },
  });
  const evidenceById = new Map(evidenceRows.map((evidence) => [evidence.id, evidence]));

  for (const link of links) {
    const analysis = scopesByOwnerId.get(link.ownerId);
    const evidence = evidenceById.get(link.evidenceId);
    if (analysis && evidence && !isEvidenceScopedToAnalysis(evidence, analysis)) {
      throw new AppError(
        'INVALID_EVIDENCE_ORIGIN',
        'Evidence must belong to the owning analysis snapshot or requirement revision.',
      );
    }
  }
}
