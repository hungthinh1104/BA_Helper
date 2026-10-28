import { randomUUID } from 'crypto';
import type { PrismaService } from '@ba-helper/backend-runtime';
import { grantProjectMembership } from './grant-project-membership';

export async function createReviewAuditFixture(
  prisma: PrismaService,
  userId: string,
) {
  const projectId = randomUUID();
  const repositoryId = randomUUID();
  const targetId = randomUUID();
  const snapshotId = randomUUID();
  const requirementId = randomUUID();
  const revisionId = randomUUID();
  const analysisId = randomUUID();
  const artifactId = randomUUID();
  const traceabilityLinkId = randomUUID();
  const insightId = randomUUID();

  await prisma.project.create({ data: { id: projectId, name: 'Review audit' } });
  await grantProjectMembership(prisma, { projectId, userId, role: 'OWNER' });
  await prisma.repository.create({
    data: { id: repositoryId, projectId, canonicalUrl: 'https://github.com/a/b' },
  });
  await prisma.repositoryTarget.create({
    data: {
      id: targetId,
      repositoryId,
      targetKey: 'main',
      requestedRef: 'main',
      resolvedRefType: 'BRANCH',
      latestObservedCommitSha: 'review-audit-sha',
      lastObservedAt: new Date(),
    },
  });
  await prisma.repositorySnapshot.create({
    data: {
      id: snapshotId,
      repositoryId,
      commitSha: 'review-audit-sha',
      analyzerVersion: '1.0',
      coverageStatus: 'READY',
    },
  });
  await prisma.requirement.create({ data: { id: requirementId, projectId } });
  await prisma.requirementRevision.create({
    data: {
      id: revisionId,
      requirementId,
      title: 'Review audit fixture',
      rawText: 'Review audit fixture',
      normalizedText: 'Review audit fixture',
      readinessStatus: 'READY_FOR_ANALYSIS',
    },
  });
  await prisma.impactAnalysis.create({
    data: {
      id: analysisId,
      requirementRevisionId: revisionId,
      snapshotId,
      sourceTargetId: targetId,
      requestKey: randomUUID(),
      status: 'WAITING_FOR_REVIEW',
      stage: 'DONE',
    },
  });
  await prisma.codeArtifact.create({
    data: {
      id: artifactId,
      snapshotId,
      artifactKey: 'src/review.ts',
      name: 'review.ts',
      artifactType: 'FILE',
      filePath: 'src/review.ts',
      language: 'typescript',
    },
  });
  await prisma.traceabilityLink.create({
    data: {
      id: traceabilityLinkId,
      impactAnalysisId: analysisId,
      artifactId,
      linkType: 'AFFECTED',
      linkBasis: 'INFERRED',
      reviewStatus: 'NEEDS_REVIEW',
      confidence: 0.5,
    },
  });
  await prisma.baInsight.create({
    data: {
      id: insightId,
      impactAnalysisId: analysisId,
      insightKey: 'review-audit-question',
      insightType: 'QUESTION',
      certainty: 'UNKNOWN',
      reviewStatus: 'NEEDS_REVIEW',
      title: 'Confirm refund timing',
      description: 'The source does not establish the refund timing.',
      metadata: { reason: 'not specified', retrievalScope: 'payment flow' },
    },
  });

  return { analysisId, traceabilityLinkId, insightId, targetId };
}
