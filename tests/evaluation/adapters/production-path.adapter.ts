import * as path from 'node:path';
import { ScanJobStatus } from '@prisma/client';
import type { PrismaService } from '@ba-helper/backend-runtime';
import type {
  RunImpactAnalysisUseCase,
  RunScanJobUseCase,
} from '@ba-helper/application';
import type { EvaluationAdapter } from '../evaluation-runner';
import type { EvaluationCase, NormalizedEvaluationResult } from '../evaluation-types';

/**
 * Production-path evaluation adapter.
 *
 * It does NOT reimplement any analyzer logic. It drives the exact runtime use
 * cases the API/worker use — `RunScanJobUseCase` then `RunImpactAnalysisUseCase`
 * — against the deterministic fake AI/embedding providers wired through the real
 * DI graph, and reads the persisted result back from the database.
 *
 * Two layers are surfaced:
 *  - Layer 1 (`foundImpactedArtifactKeys`): the retrieval/traceability recall net
 *    (`TraceabilityLink` rows). Graded for recall, critical recall, evidence.
 *  - Layer 2 (`committedArtifactKeys`): the AI-adjudicated EVIDENCED-claim set
 *    (`BaInsight[certainty=EVIDENCED] → InsightEvidence → Evidence → artifact`).
 *    Graded for precision, negative control, and orphan claims.
 */
export class ProductionPathEvaluationAdapter implements EvaluationAdapter {
  private readonly fixtureRoot = path.join(process.cwd(), 'tests/fixtures');
  private readonly scanCache = new Map<
    string,
    { projectId: string; snapshotId: string; sourceTargetId: string }
  >();

  constructor(
    private readonly prisma: PrismaService,
    private readonly runScanJob: RunScanJobUseCase,
    private readonly runImpactAnalysis: RunImpactAnalysisUseCase,
  ) {}

  async evaluateCase(evalCase: EvaluationCase): Promise<NormalizedEvaluationResult> {
    const scan = await this.ensureScan(evalCase.targetFixture);

    const requirementText = `${evalCase.requirementTitle}. ${evalCase.requirementText}`;
    const requirement = await this.prisma.requirement.create({
      data: { projectId: scan.projectId },
    });
    const revision = await this.prisma.requirementRevision.create({
      data: {
        requirementId: requirement.id,
        rawText: requirementText,
        title: evalCase.requirementTitle,
        normalizedText: requirementText,
        readinessStatus: 'READY_FOR_ANALYSIS',
      },
    });
    const analysis = await this.prisma.impactAnalysis.create({
      data: {
        requirementRevisionId: revision.id,
        snapshotId: scan.snapshotId,
        sourceTargetId: scan.sourceTargetId,
        status: 'QUEUED',
        stage: 'WAITING',
        progress: 0,
        requestKey: `eval-${evalCase.id}`,
      },
    });

    await this.runImpactAnalysis.execute({
      analysisId: analysis.id,
      domain: evalCase.domain?.packId,
    });

    return this.readResult(analysis.id);
  }

  private async ensureScan(targetFixture: string): Promise<{
    projectId: string;
    snapshotId: string;
    sourceTargetId: string;
  }> {
    const cached = this.scanCache.get(targetFixture);
    if (cached) return cached;

    const fixturePath = path.join(this.fixtureRoot, targetFixture);
    const project = await this.prisma.project.create({
      data: { name: `Eval ${targetFixture}` },
    });
    const repository = await this.prisma.repository.create({
      data: { projectId: project.id, canonicalUrl: fixturePath },
    });
    const scanJob = await this.prisma.scanJob.create({
      data: {
        repositoryId: repository.id,
        requestedRef: 'main',
        status: ScanJobStatus.QUEUED,
        stage: 'WAITING',
        progress: 0,
        requestKey: `eval-scan-${targetFixture}`,
      },
    });

    await this.runScanJob.execute({ jobId: scanJob.id });

    const completed = await this.prisma.scanJob.findUniqueOrThrow({
      where: { id: scanJob.id },
    });
    if (completed.status !== 'COMPLETED' || !completed.snapshotId || !completed.sourceTargetId) {
      throw new Error(
        `Fixture scan did not complete for ${targetFixture}: status=${completed.status}`,
      );
    }

    const value = {
      projectId: project.id,
      snapshotId: completed.snapshotId,
      sourceTargetId: completed.sourceTargetId,
    };
    this.scanCache.set(targetFixture, value);
    return value;
  }

  private async readResult(analysisId: string): Promise<NormalizedEvaluationResult> {
    const evidenceByArtifactKey: Record<string, string[]> = {};
    const addEvidence = (key: string, excerpt: string | null | undefined) => {
      if (!excerpt) return;
      const bucket = (evidenceByArtifactKey[key] ??= []);
      if (!bucket.includes(excerpt)) bucket.push(excerpt.substring(0, 500));
    };

    // Layer 1 — retrieval / traceability recall net.
    const links = await this.prisma.traceabilityLink.findMany({
      where: { impactAnalysisId: analysisId },
      include: {
        artifact: true,
        evidenceLinks: { include: { evidence: true } },
      },
    });
    const foundImpactedArtifactKeys: string[] = [];
    for (const link of links) {
      const key = link.artifact.artifactKey;
      foundImpactedArtifactKeys.push(key);
      for (const el of link.evidenceLinks) {
        addEvidence(key, el.evidence.excerpt);
      }
    }

    // Layer 2 — AI-adjudicated EVIDENCED-claim set.
    const evidencedInsights = await this.prisma.baInsight.findMany({
      where: { impactAnalysisId: analysisId, certainty: 'EVIDENCED' },
      include: {
        evidenceLinks: { include: { evidence: { include: { artifact: true } } } },
      },
    });
    const committed = new Set<string>();
    for (const insight of evidencedInsights) {
      for (const el of insight.evidenceLinks) {
        const key = el.evidence.artifact?.artifactKey;
        if (!key) continue;
        committed.add(key);
        addEvidence(key, el.evidence.excerpt);
      }
    }

    // Insight taxonomy (unknowns / questions / risks / qa) for completeness.
    const allInsights = await this.prisma.baInsight.findMany({
      where: { impactAnalysisId: analysisId },
    });
    const unknownsOrQuestions: string[] = [];
    const risks: string[] = [];
    const qaScenarios: string[] = [];
    for (const insight of allInsights) {
      const kind = (insight.metadata as { kind?: string } | null)?.kind;
      if (insight.insightType === 'UNKNOWN' || insight.insightType === 'QUESTION') {
        unknownsOrQuestions.push(insight.description);
      } else if (insight.insightType === 'QA_SCENARIO') {
        qaScenarios.push(insight.description);
      } else if (kind === 'risk') {
        risks.push(insight.description);
      }
    }

    return {
      foundImpactedArtifactKeys: Array.from(new Set(foundImpactedArtifactKeys)),
      committedArtifactKeys: Array.from(committed),
      evidenceByArtifactKey,
      unknownsOrQuestions,
      risks,
      qaScenarios,
    };
  }
}
