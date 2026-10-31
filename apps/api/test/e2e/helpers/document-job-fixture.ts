import { randomUUID } from 'node:crypto';
import type { PrismaService } from '@ba-helper/backend-runtime';
import { grantProjectMembership } from './grant-project-membership';

export async function seedCompletedAnalysis(prisma: PrismaService, userId: string) {
  const projectId = randomUUID();
  const repositoryId = randomUUID();
  const targetId = randomUUID();
  const sourceSnapshotId = randomUUID();
  const requirementId = randomUUID();
  const revisionId = randomUUID();
  const analysisId = randomUUID();
  const reviewedSnapshotId = randomUUID();
  const commitSha = randomUUID().replace(/-/g, '').slice(0, 12);

  await prisma.project.create({ data: { id: projectId, name: 'Document Recovery Project' } });
  await grantProjectMembership(prisma, { projectId, userId, role: 'OWNER' });
  await prisma.repository.create({
    data: {
      id: repositoryId,
      projectId,
      canonicalUrl: 'https://github.com/example/document-recovery',
    },
  });
  await prisma.repositoryTarget.create({
    data: {
      id: targetId,
      repositoryId,
      targetKey: 'main',
      requestedRef: 'main',
      resolvedRefType: 'BRANCH',
      latestObservedCommitSha: commitSha,
      lastObservedAt: new Date(),
    },
  });
  await prisma.repositorySnapshot.create({
    data: {
      id: sourceSnapshotId,
      repositoryId,
      commitSha,
      analyzerVersion: 'test-v1',
      coverageStatus: 'READY',
    },
  });
  await prisma.requirement.create({ data: { id: requirementId, projectId } });
  await prisma.requirementRevision.create({
    data: {
      id: revisionId,
      requirementId,
      title: 'Refund paid bookings',
      rawText: 'Allow cancellation and refund for paid bookings.',
      normalizedText: 'Allow cancellation and refund for paid bookings.',
      readinessStatus: 'READY_FOR_ANALYSIS',
    },
  });
  await prisma.impactAnalysis.create({
    data: {
      id: analysisId,
      requirementRevisionId: revisionId,
      requirementId,
      projectId,
      repositoryId,
      snapshotId: sourceSnapshotId,
      sourceTargetId: targetId,
      requestKey: randomUUID(),
      status: 'COMPLETED',
      stage: 'DONE',
    },
  });
  await prisma.reviewedReportSnapshot.create({
    data: {
      id: reviewedSnapshotId,
      analysisId,
      markdown: '# Approved report',
      reviewDecisionsSnapshot: [],
      evidenceQualitySummarySnapshot: {
        missingEvidence: 0,
        reviewRequired: 0,
        evidenced: 0,
        inferred: 0,
        weakEvidence: 0,
      },
      createdByUserId: userId,
    },
  });

  return { analysisId, reviewedSnapshotId };
}
