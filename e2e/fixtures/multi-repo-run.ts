import { randomUUID } from 'node:crypto'
import { PrismaService } from '../../packages/backend-runtime/src/prisma/prisma.service'
import type { DemoSeed } from './seed'

export async function seedReviewableMultiRepoRun(seed: DemoSeed): Promise<string> {
  const prisma = new PrismaService()
  await prisma.$connect()

  try {
    const [user, requirement, revision, existingRepository] = await Promise.all([
      prisma.user.findUnique({ where: { email: seed.email } }),
      prisma.requirement.findUnique({ where: { id: seed.requirementId } }),
      prisma.requirementRevision.findFirst({
        where: { requirementId: seed.requirementId },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.repository.findUnique({ where: { id: seed.repositoryId } }),
    ])

    if (!user || !requirement || !revision || !existingRepository) {
      throw new Error('The demo project is missing a user, requirement revision, or repository.')
    }

    const commitSha = randomUUID().replace(/-/g, '').slice(0, 12)
    const paymentRepository = await prisma.repository.create({
      data: {
        projectId: seed.projectId,
        canonicalUrl: 'https://github.com/example/payment-service',
      },
    })
    const paymentTarget = await prisma.repositoryTarget.create({
      data: {
        repositoryId: paymentRepository.id,
        targetKey: 'main',
        requestedRef: 'main',
        resolvedRefType: 'BRANCH',
        latestObservedCommitSha: commitSha,
        lastObservedAt: new Date(),
      },
    })
    const paymentSnapshot = await prisma.repositorySnapshot.create({
      data: {
        repositoryId: paymentRepository.id,
        commitSha,
        analyzerVersion: 'e2e-multi-repo-v1',
        coverageStatus: 'READY',
      },
    })

    const run = await prisma.multiRepoAnalysisRun.create({
      data: {
        projectId: seed.projectId,
        requirementId: requirement.id,
        requirementRevisionId: revision.id,
        createdByUserId: user.id,
        requestKey: randomUUID(),
      },
    })

    const repositoryInputs = [
      {
        repository: existingRepository,
        snapshotId: seed.snapshotId,
        sourceTargetId: (await prisma.repositoryTarget.findFirstOrThrow({
          where: { repositoryId: existingRepository.id },
          orderBy: { lastObservedAt: 'desc' },
        })).id,
      },
      {
        repository: paymentRepository,
        snapshotId: paymentSnapshot.id,
        sourceTargetId: paymentTarget.id,
      },
    ]

    for (const input of repositoryInputs) {
      const analysis = await prisma.impactAnalysis.create({
        data: {
          requirementRevisionId: revision.id,
          requirementId: requirement.id,
          projectId: seed.projectId,
          repositoryId: input.repository.id,
          snapshotId: input.snapshotId,
          sourceTargetId: input.sourceTargetId,
          multiRepoRunId: run.id,
          requestKey: randomUUID(),
          status: 'COMPLETED',
          stage: 'DONE',
          progress: 100,
        },
      })
      await prisma.analysisReviewDecision.create({
        data: {
          analysisId: analysis.id,
          decision: 'ACCEPTED',
          reviewedByUserId: user.id,
        },
      })

      const evidence = await prisma.evidence.create({
        data: {
          provenanceKey: `e2e:multi-repo:${run.id}:${analysis.id}`,
          sourceType: 'CODE',
          snapshotId: input.snapshotId,
          sourcePath: `src/${input.repository.canonicalUrl.split('/').pop()}.ts`,
          startLine: 12,
          endLine: 18,
          excerpt: 'A persisted source excerpt supporting this reviewed impact.',
          contentHash: randomUUID().replace(/-/g, ''),
        },
      })
      const insight = await prisma.baInsight.create({
        data: {
          impactAnalysisId: analysis.id,
          insightKey: `reviewed-impact-${input.repository.id.slice(0, 8)}`,
          insightType: 'CLAIM',
          certainty: 'EVIDENCED',
          reviewStatus: 'CONFIRMED',
          confidence: 0.9,
          title: `Refund impact in ${input.repository.canonicalUrl.split('/').pop()}`,
          description: 'Cancellation and refund behavior must remain consistent across services.',
        },
      })
      await prisma.insightEvidence.create({ data: { insightId: insight.id, evidenceId: evidence.id } })
    }

    return run.id
  } finally {
    await prisma.onModuleDestroy()
  }
}
