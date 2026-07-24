import { AppError } from '@ba-helper/shared';
import { AiOutputError } from '../ai/ai.errors';
import type { ImpactAnalysisRepositoryPort } from '../ports/impact-analysis.repository.port';
import type { InsightRepositoryPort, InsightRecord } from '../ports/insight.repository.port';
import type { DomainPackSelectionPort } from '../ports/domain-pack-selection.port';
import type { EventLogPort } from '../ports/event-log.port';
import { buildCompletedAnalysisMetadata } from './analysis-run-metadata';
import type { ImpactEvidenceCollectionStep } from './steps/impact-evidence-collection.step';
import type { ImpactDiagnosticPropagationStep } from './steps/impact-diagnostic-propagation.step';
import type { ImpactAiReasoningStep } from './steps/impact-ai-reasoning.step';
import { readResolvedDomainPackSelection } from '../domain/domain-pack-selection-normalizer';

export class RunImpactAnalysisUseCase {
  constructor(
    private readonly impactRepo: ImpactAnalysisRepositoryPort,
    private readonly insightRepo: InsightRepositoryPort,
    private readonly domainPackSelection: DomainPackSelectionPort,
    private readonly evidenceStep: ImpactEvidenceCollectionStep,
    private readonly diagnosticStep: ImpactDiagnosticPropagationStep,
    private readonly aiReasoningStep: ImpactAiReasoningStep,
    private readonly eventLog: EventLogPort,
  ) {}

  async execute(params: { analysisId: string; expandGraph?: boolean; domain?: string }) {
    const analysis = await this.impactRepo.findById(params.analysisId);

    if (!analysis) {
      throw new AppError('IMPACT_ANALYSIS_NOT_FOUND', 'Impact analysis not found.');
    }

    if (analysis.status !== 'QUEUED' && analysis.status !== 'RUNNING') {
      throw new AppError(
        'IMPACT_ANALYSIS_NOT_RUNNABLE',
        'Impact analysis cannot be run in its current state.',
      );
    }

    await this.impactRepo.updateStatus({
      id: analysis.id,
      status: 'RUNNING',
      stage: 'RETRIEVING_EVIDENCE',
      progress: 10,
    });

    const triggeredByUserId = analysis.multiRepoRun?.createdByUserId ?? null;
    const projectId =
      analysis.requirementRevision.requirement?.projectId ??
      analysis.snapshot.repository?.projectId;

    if (!projectId) {
      throw new AppError(
        'SNAPSHOT_MISSING',
        'Impact analysis snapshot is missing repository project scope.',
      );
    }

    await this.eventLog.recordEvent({
      eventType: 'ANALYSIS_STARTED',
      idempotencyKey: `analysis:${analysis.id}:started`,
      actorUserId: 'system',
      payload: {
        actorType: 'SYSTEM',
        actorId: 'system',
        actorName: 'BA Helper Worker',
        triggeredByUserId,
        analysisId: analysis.id,
        repositoryId: analysis.snapshot.repositoryId,
        projectId,
        previousStatus: analysis.status,
        nextStatus: 'RUNNING',
        phase: 'RETRIEVING_EVIDENCE',
      },
    });

    try {
      const snapshotDomain = analysis.snapshot.profile?.domain;
      const persistedDomainPack = readResolvedDomainPackSelection(analysis, {
        ignoreUnresolvedDefaultFallback: true,
      });
      const domainPackResult = persistedDomainPack
        ? this.domainPackSelection.selectResolvedPack(persistedDomainPack)
        : this.domainPackSelection.selectPack({
          manualPackId: params.domain,
          repositoryProfileDomain: snapshotDomain,
        });

      // Step 1: Collect Evidence and Traceability Links
      const evidenceResult = await this.evidenceStep.execute(
        analysis,
        domainPackResult,
        params.expandGraph ?? true,
      );

      await this.impactRepo.updateStatus({
        id: analysis.id,
        status: 'RUNNING',
        stage: 'RUNNING_AI_REASONING',
        progress: 60,
      });

      await this.eventLog.recordEvent({
        eventType: 'ANALYSIS_EVIDENCE_RETRIEVED',
        idempotencyKey: `analysis:${analysis.id}:evidence-retrieved`,
        actorUserId: 'system',
        payload: {
          actorType: 'SYSTEM',
          actorId: 'system',
          actorName: 'BA Helper Worker',
          triggeredByUserId,
          analysisId: analysis.id,
          repositoryId: analysis.snapshot.repositoryId,
          projectId,
          previousStatus: 'RUNNING',
          nextStatus: 'RUNNING',
          phase: 'RUNNING_AI_REASONING',
          evidenceCount: evidenceResult.evidenceByKey.size,
          traceabilityLinkCount: evidenceResult.traceabilityLinks.length,
        },
      });

      // Step 2: Run AI Reasoning
      const aiResult = await this.aiReasoningStep.execute(
        analysis,
        evidenceResult,
        domainPackResult,
      );

      // Step 3: Diagnostic Risk Propagation
      const diagnosticInsights = this.diagnosticStep.execute(analysis, evidenceResult);

      const insightInputs = [...aiResult.insightInputs, ...diagnosticInsights];

      // Persist all insights
      const insights = (await this.insightRepo.upsertMany(insightInputs)) as InsightRecord[];

      // Link persisted evidence to every AI insight that returned resolvable evidence keys.
      await Promise.all(
        insights
          .filter((insight) =>
            aiResult.insightEvidenceMap.some((item) => item.insightKey === insight.insightKey),
          )
          .map((insight) => {
            const mapping = aiResult.insightEvidenceMap.find(
              (item) => item.insightKey === insight.insightKey,
            );

            if (!mapping || mapping.artifactKeys.length === 0) {
              return Promise.resolve([]);
            }

            const evidenceIds = mapping.artifactKeys
              .map((key) => evidenceResult.evidenceByKey.get(key)?.id)
              .filter((id): id is string => Boolean(id));

            if (evidenceIds.length === 0) {
              return Promise.resolve([]);
            }

            return this.insightRepo.linkEvidence({
              insightId: insight.id,
              evidenceIds,
            });
          }),
      );

      await this.eventLog.recordEvent({
        eventType: 'ANALYSIS_AI_REASONING_COMPLETED',
        idempotencyKey: `analysis:${analysis.id}:ai-reasoning-completed`,
        actorUserId: 'system',
        payload: {
          actorType: 'SYSTEM',
          actorId: 'system',
          actorName: 'BA Helper Worker',
          triggeredByUserId,
          analysisId: analysis.id,
          repositoryId: analysis.snapshot.repositoryId,
          projectId,
          previousStatus: 'RUNNING',
          nextStatus: 'RUNNING',
          phase: 'DONE',
          insightCount: insights.length,
          provider: aiResult.llmMetadata?.provider || 'unknown',
          tokenUsage: (aiResult.llmMetadata?.inputTokens || 0) + (aiResult.llmMetadata?.outputTokens || 0),
        },
      });

      const result = await this.impactRepo.updateStatus({
        id: analysis.id,
        status: 'WAITING_FOR_REVIEW',
        stage: 'DONE',
        progress: 100,
        metadata: buildCompletedAnalysisMetadata({
          evidenceResult,
          aiResult,
          domainPackResult,
        }),
      });

      await this.eventLog.recordEvent({
        eventType: 'ANALYSIS_WAITING_FOR_REVIEW',
        idempotencyKey: `analysis:${analysis.id}:waiting-for-review`,
        actorUserId: 'system',
        payload: {
          actorType: 'SYSTEM',
          actorId: 'system',
          actorName: 'BA Helper Worker',
          triggeredByUserId,
          analysisId: analysis.id,
          repositoryId: analysis.snapshot.repositoryId,
          projectId,
          previousStatus: 'RUNNING',
          nextStatus: 'WAITING_FOR_REVIEW',
          phase: 'DONE',
        },
      });

      return result;
    } catch (e: any) {
      const errorCode =
        e instanceof AppError
          ? e.code
          : e instanceof AiOutputError
            ? e.code
            : (e instanceof Error && 'code' in e)
              ? String((e as any).code)
              : 'UNKNOWN_ANALYSIS_ERROR';
      const errorMessage = e instanceof Error ? e.message : String(e);
      const errorDetails =
        e instanceof AiOutputError
          ? e.details
          : e instanceof AppError && 'details' in e
            ? (e as any).details
            : undefined;

      await this.impactRepo.updateStatus({
        id: analysis.id,
        status: 'FAILED',
        stage: analysis.stage,
        progress: analysis.progress,
        error: {
          code: errorCode,
          message: errorMessage,
          stage: analysis.stage,
          retryable: true,
          ...(errorDetails ? { details: errorDetails } : {}),
        },
      });

      await this.eventLog.recordEvent({
        eventType: 'ANALYSIS_FAILED',
        idempotencyKey: `analysis:${analysis.id}:failed`,
        actorUserId: 'system',
        payload: {
          actorType: 'SYSTEM',
          actorId: 'system',
          actorName: 'BA Helper Worker',
          triggeredByUserId,
          analysisId: analysis.id,
          repositoryId: analysis.snapshot.repositoryId,
          projectId,
          previousStatus: analysis.status,
          nextStatus: 'FAILED',
          errorCode,
          errorMessage,
        },
      });

      throw e;
    }
  }
}
