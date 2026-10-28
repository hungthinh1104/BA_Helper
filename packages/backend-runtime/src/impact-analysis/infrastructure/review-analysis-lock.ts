import { AppError } from '@ba-helper/shared';
import type { Prisma } from '@prisma/client';

export type ReviewAnalysisLockState =
  | 'MISSING'
  | 'NOT_REVIEWABLE'
  | 'STALE'
  | 'CURRENT';

/**
 * Serializes review/finalization against both lifecycle changes and moving-ref
 * observations. Lock order is ImpactAnalysis, then RepositoryTarget; scanner
 * persistence only writes RepositoryTarget and therefore cannot form a cycle.
 */
export async function lockReviewAnalysisState(
  tx: Prisma.TransactionClient,
  analysisId: string,
): Promise<ReviewAnalysisLockState> {
  const analyses = await tx.$queryRaw<Array<{
    status: string;
    sourceTargetId: string;
    snapshotCommitSha: string;
  }>>`
    SELECT analysis.status,
      analysis."sourceTargetId" AS "sourceTargetId",
      snapshot."commitSha" AS "snapshotCommitSha"
    FROM "ImpactAnalysis" AS analysis
    INNER JOIN "RepositorySnapshot" AS snapshot
      ON snapshot.id = analysis."snapshotId"
    WHERE analysis.id = ${analysisId}
    FOR UPDATE OF analysis
  `;

  const analysis = analyses[0];
  if (!analysis) return 'MISSING';
  if (analysis.status !== 'WAITING_FOR_REVIEW') return 'NOT_REVIEWABLE';

  const targets = await tx.$queryRaw<Array<{
    resolvedRefType: string;
    latestObservedCommitSha: string;
  }>>`
    SELECT "resolvedRefType", "latestObservedCommitSha"
    FROM "RepositoryTarget"
    WHERE id = ${analysis.sourceTargetId}
    FOR SHARE
  `;

  const target = targets[0];
  if (!target) return 'STALE';
  if (
    target.resolvedRefType !== 'COMMIT' &&
    target.latestObservedCommitSha !== analysis.snapshotCommitSha
  ) {
    return 'STALE';
  }
  return 'CURRENT';
}

export async function lockReviewableAnalysisWhileCurrent(
  tx: Prisma.TransactionClient,
  analysisId: string,
): Promise<boolean> {
  const state = await lockReviewAnalysisState(tx, analysisId);
  if (state === 'STALE') {
    throw new AppError(
      'ANALYSIS_STALE',
      'Review is not allowed because the underlying repository state has changed.',
    );
  }
  return state === 'CURRENT';
}
