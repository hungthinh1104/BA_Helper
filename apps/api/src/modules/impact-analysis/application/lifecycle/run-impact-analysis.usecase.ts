import { Injectable, Logger } from '@nestjs/common';
import { AppError } from '@ba-helper/shared';
import { ImpactAnalysisRepository } from '../../infrastructure/impact-analysis.repository';
import { InsightRepository } from '../../../insight/infrastructure/insight.repository';
import { DomainPackRegistry } from '../../../domain-pack/application/domain-pack.registry';
import { AiOutputError } from '../../../ai/domain/ai.errors';
import { ImpactEvidenceCollectionStep } from './steps/impact-evidence-collection.step';
import { ImpactDiagnosticPropagationStep } from './steps/impact-diagnostic-propagation.step';
import { ImpactAiReasoningStep } from './steps/impact-ai-reasoning.step';
import { InsightRecord } from './steps/impact-analysis-step.types';

import { EventLogService } from '../../../event-log/application/event-log.service';

@Injectable()
export class RunImpactAnalysisUseCase {
  private readonly logger = new Logger(RunImpactAnalysisUseCase.name);

  constructor(
    private readonly impactRepo: ImpactAnalysisRepository,
    private readonly insightRepo: InsightRepository,
    private readonly domainPackRegistry: DomainPackRegistry,
    private readonly evidenceStep: ImpactEvidenceCollectionStep,
    private readonly diagnosticStep: ImpactDiagnosticPropagationStep,
    private readonly aiReasoningStep: ImpactAiReasoningStep,
    private readonly eventLogService: EventLogService,
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

    const triggeredByUserId = (analysis as any).multiRepoRun?.createdByUserId || null;

    await this.eventLogService.recordEvent({
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
        projectId: (analysis as any).requirementRevision?.requirement?.projectId,
        previousStatus: analysis.status,
        nextStatus: 'RUNNING',
        phase: 'RETRIEVING_EVIDENCE',
      },
    });

    try {
      const snapshotDomain = (analysis.snapshot as any).profile?.domain;
      const domainPackSelection = this.domainPackRegistry.selectPack({
        manualPackId: params.domain,
        repositoryProfileDomain: snapshotDomain,
      });

      // Step 1: Collect Evidence and Traceability Links
      const evidenceResult = await this.evidenceStep.execute(
        analysis,
        domainPackSelection,
        params.expandGraph ?? true,
      );

      await this.impactRepo.updateStatus({
        id: analysis.id,
        status: 'RUNNING',
        stage: 'RUNNING_AI_REASONING',
        progress: 60,
      });

      await this.eventLogService.recordEvent({
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
          projectId: (analysis as any).requirementRevision?.requirement?.projectId,
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
        domainPackSelection,
      );

      // Step 3: Diagnostic Risk Propagation
      // Keep exact order from E20E-0: Evaluated after LLM call, but persisted together
      const diagnosticInsights = this.diagnosticStep.execute(analysis, evidenceResult);

      const insightInputs = [...aiResult.insightInputs, ...diagnosticInsights];

      // Persist all insights
      const insights = (await this.insightRepo.upsertMany(
        insightInputs,
      )) as InsightRecord[];

      // Link evidence to AI EVIDENCED insights
      await Promise.all(
        insights
          .filter(
            (insight) =>
              insight.certainty === 'EVIDENCED' &&
              aiResult.resolvableEvidencedInsightKeys.has(insight.insightKey),
          )
          .map((insight) => {
            const mapping = aiResult.evidencedInsightMap.find(
              (item) => item.insightKey === insight.insightKey,
            );

            if (!mapping || mapping.artifactKeys.length === 0) {
              return Promise.resolve([]);
            }

            const evidenceIds = mapping.artifactKeys
              .map((key) => evidenceResult.evidenceByKey.get(key)?.id)
              .filter((id): id is string => Boolean(id));

            if (evidenceIds.length === 0) {
              this.logger.warn(
                `Could not resolve any evidence IDs for insight ${insight.insightKey}`,
              );
              return Promise.resolve([]);
            }

            return this.insightRepo.linkEvidence({
              insightId: insight.id,
              evidenceIds,
            });
          }),
      );

      await this.eventLogService.recordEvent({
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
          projectId: (analysis as any).requirementRevision?.requirement?.projectId,
          previousStatus: 'RUNNING',
          nextStatus: 'RUNNING',
          phase: 'DONE',
          insightCount: insights.length,
          provider: aiResult.llmMetadata?.provider || 'unknown',
          tokenUsage: (aiResult.llmMetadata?.inputTokens || 0) + (aiResult.llmMetadata?.outputTokens || 0),
        },
      });

      const domainPack = domainPackSelection.pack;

      const result = await this.impactRepo.updateStatus({
        id: analysis.id,
        status: 'WAITING_FOR_REVIEW',
        stage: 'DONE',
        progress: 100,
        metadata: {
          retrieval: evidenceResult.retrievalMetadata,
          llm: {
            provider: aiResult.llmMetadata?.provider || 'unknown',
            model: aiResult.llmMetadata?.model || 'unknown',
            promptVersion: aiResult.promptVersion,
            parseMode: aiResult.llmMetadata?.parseMode || 'raw',
            inputTokens: aiResult.llmMetadata?.inputTokens || null,
            outputTokens: aiResult.llmMetadata?.outputTokens || null,
            estimatedCostUsd: null,
            evidenceItems: aiResult.evidenceCandidatesLength,
            evidenceChars: aiResult.totalEvidenceChars,
            evidenceTruncated: aiResult.evidenceTruncated,
            domainContextUsed: domainPackSelection.normalizedPackId,
          },
          domainPack: {
            id: domainPack.id,
            version: domainPack.version,
            status: domainPack.status,
            selectedBy: domainPackSelection.selectedBy,
          },
          diagnostics: [
            {
              code: 'DOMAIN_PACK_APPLIED',
              severity: 'INFO',
              message: `Applied domain pack ${domainPack.id}@${domainPack.version}`,
              payload: {
                domainPackId: domainPack.id,
                domainPackVersion: domainPack.version,
                domainPackStatus: domainPack.status,
                selectedBy: domainPackSelection.selectedBy,
                conceptCount: domainPack.concepts.length,
                retrievalHintCount: domainPack.retrievalHints.length,
                riskTemplateCount: domainPack.riskTemplates.length,
                qaTemplateCount: domainPack.qaTemplates.length,
                unknownTemplateCount: domainPack.unknownTemplates.length,
              },
            },
          ],
        },
      });

      await this.eventLogService.recordEvent({
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
          projectId: (analysis as any).requirementRevision?.requirement?.projectId,
          previousStatus: 'RUNNING',
          nextStatus: 'WAITING_FOR_REVIEW',
          phase: 'DONE',
        },
      });

      return result;
    } catch (e: any) {
      const safeError = {
        message: e instanceof Error ? e.message : String(e),
        code: (e as any).code,
        name: e instanceof Error ? e.name : 'UnknownError',
        stack: e instanceof Error ? e.stack : undefined,
      };
      this.logger.error(
        `RunImpactAnalysisUseCase execution failed: ${safeError.message}`,
        safeError.stack,
      );

      const errorCode =
        e instanceof AppError
          ? e.code
          : e instanceof AiOutputError
            ? e.code
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

      const triggeredByUserId = (analysis as any).multiRepoRun?.createdByUserId || null;
      await this.eventLogService.recordEvent({
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
          projectId: (analysis as any).requirementRevision?.requirement?.projectId,
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
