import { PrismaService } from '../../../src/modules/prisma/prisma.service';
import * as crypto from 'crypto';

export async function seedScanJobCompletion(
  prisma: PrismaService,
  scanJobId: string,
) {
  const scanJob = await prisma.scanJob.findUniqueOrThrow({
    where: { id: scanJobId },
  });

  const snapshot = await prisma.repositorySnapshot.create({
    data: {
      repositoryId: scanJob.repositoryId,
      commitSha: 'mock-commit-sha',
      analyzerVersion: 'test-v1',
      coverageStatus: 'READY',
      indexStatus: 'VECTOR_READY',
    },
  });

  const target = await prisma.repositoryTarget.create({
    data: {
      repositoryId: scanJob.repositoryId,
      targetKey: scanJob.requestedRef || 'main',
      requestedRef: scanJob.requestedRef || 'main',
      resolvedRefType: 'BRANCH',
      latestObservedCommitSha: 'mock-commit-sha',
      lastObservedAt: new Date(),
    },
  });

  await prisma.scanJob.update({
    where: { id: scanJobId },
    data: {
      status: 'COMPLETED',
      stage: 'DONE',
      progress: 100,
      snapshotId: snapshot.id,
      sourceTargetId: target.id,
    },
  });

  // Seed artifacts and an edge
  const artifactId = crypto.randomUUID();
  const artifact2Id = crypto.randomUUID();

  await prisma.codeArtifact.createMany({
    data: [
      {
        id: artifactId,
        snapshotId: snapshot.id,
        artifactKey: 'src/mock.ts:MockClass',
        name: 'MockClass',
        artifactType: 'CLASS',
        filePath: 'src/mock.ts',
        startLine: 1,
        endLine: 10,
      },
      {
        id: artifact2Id,
        snapshotId: snapshot.id,
        artifactKey: 'src/mock2.ts:MockHelper',
        name: 'MockHelper',
        artifactType: 'CLASS',
        filePath: 'src/mock2.ts',
        startLine: 1,
        endLine: 5,
      },
    ],
  });

  await prisma.dependencyEdge.create({
    data: {
      snapshotId: snapshot.id,
      fromArtifactId: artifactId,
      toArtifactId: artifact2Id,
      type: 'CALLS',
    },
  });

  // Return the snapshot and target so the test can use them
  return { snapshot, target, artifactId };
}

export async function seedImpactAnalysisCompletion(
  prisma: PrismaService,
  analysisId: string,
) {
  await prisma.impactAnalysis.update({
    where: { id: analysisId },
    data: {
      status: 'WAITING_FOR_REVIEW',
      stage: 'DONE',
      progress: 100,
    },
  });

  const insightId = crypto.randomUUID();
  await prisma.baInsight.create({
    data: {
      id: insightId,
      impactAnalysisId: analysisId,
      insightKey: 'mock-insight',
      insightType: 'CLAIM',
      certainty: 'EVIDENCED',
      reviewStatus: 'NEEDS_REVIEW',
      title: 'Mock Insight',
      description: 'This is a mocked insight.',
    },
  });

  const evidenceId = crypto.randomUUID();
  await prisma.evidence.create({
    data: {
      id: evidenceId,
      provenanceKey: 'mock-evidence-provenance',
      sourceType: 'CODE',
      excerpt: 'mock code',
      contentHash: 'mock-hash-1234',
      sourcePath: 'src/mock.ts',
    },
  });

  await prisma.insightEvidence.create({
    data: {
      insightId,
      evidenceId,
    },
  });

  await prisma.generatedDocument.create({
    data: {
      impactAnalysisId: analysisId,
      type: 'IMPACT_REPORT',
      status: 'DRAFT',
      content: 'Mock Draft Content',
    },
  });

  return { insightId };
}
