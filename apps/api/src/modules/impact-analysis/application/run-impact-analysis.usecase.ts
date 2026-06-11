import { Injectable } from "@nestjs/common";

import { createHash } from 'node:crypto';
import { AppError } from '../../../shared/app-error';
import { ImpactAnalysisRepository } from '../infrastructure/impact-analysis.repository';
import { ArtifactRepository } from '../../artifact/infrastructure/artifact.repository';
import { EvidenceRepository } from '../../evidence/infrastructure/evidence.repository';
import { InsightRepository } from '../../insight/infrastructure/insight.repository';
import { TraceabilityRepository } from '../../traceability/infrastructure/traceability.repository';
import { LlmProvider } from '../../ai/domain/llm-provider.interface';
import { renderPrompt } from '../../ai/domain/prompt-registry';
import { impactAnalysisAiSchema } from '../../ai/domain/ai.schema';
import { HybridRetrievalService } from '../../retrieval/application/hybrid-retrieval.service';
import { EvidencePackFormatter, EvidenceCandidate } from '../../ai/application/evidence-pack.formatter';
import { z } from 'zod';

type PersistedArtifact = {
  id: string;
  artifactKey: string;
  artifactType: string;
  name: string;
  filePath: string;
  startLine: number | null;
  endLine: number | null;
};


type ScanArtifact = {
  stableId: string;
  type: string;
  filePath: string;
  symbolName: string;
  startLine: number;
  endLine: number;
};

type EvidenceRecord = {
  id: string;
  artifactId: string | null;
};

type InsightRecord = {
  id: string;
  insightKey: string;
  certainty: 'EVIDENCED' | 'INFERRED' | 'UNKNOWN' | 'CONFLICTING';
};

const REQUIRED_STABLE_IDS = [
  'api:booking.controller.cancel',
  'service-method:booking.service.cancelBooking',
  'service-method:payment.service.refund',
];

const GRAPH_EXPANSION_STABLE_IDS = [
  'service-method:slot.service.releaseSlot',
  'service-method:notification.service.notifyOwner',
  'entity:booking',
  'entity:paymentTransaction',
  'test:booking.cancel.spec',
];

const includesKeyword = (input: string, keyword: string) =>
  input.toLowerCase().includes(keyword.toLowerCase());

const shouldRun = (changeRequest: string) =>
  includesKeyword(changeRequest, 'cancel') ||
  includesKeyword(changeRequest, 'refund');

const selectEvidenceCandidates = (input: {
  changeRequest: string;
  artifacts: ScanArtifact[];
  expandGraph: boolean;
}) => {
  if (!shouldRun(input.changeRequest)) {
    return { artifacts: [] as ScanArtifact[] };
  }

  const artifactById = new Map(
    input.artifacts.map((artifact) => [artifact.stableId, artifact]),
  );

  const selected = new Map<string, ScanArtifact>();

  for (const stableId of REQUIRED_STABLE_IDS) {
    const artifact = artifactById.get(stableId);
    if (artifact) {
      selected.set(stableId, artifact);
    }
  }

  if (input.expandGraph) {
    for (const stableId of GRAPH_EXPANSION_STABLE_IDS) {
      const artifact = artifactById.get(stableId);
      if (artifact) {
        selected.set(stableId, artifact);
      }
    }
  }

  return {
    artifacts: Array.from(selected.values()).sort((a, b) =>
      a.stableId.localeCompare(b.stableId),
    ),
  };
};

const toEvidenceSourceType = (artifactType: string) =>
  artifactType === 'TEST' ? 'TEST' : 'CODE';

const buildExcerpt = (artifact: ScanArtifact) =>
  `${artifact.filePath}:${artifact.startLine}-${artifact.endLine} (${artifact.symbolName})`;



@Injectable()
export class RunImpactAnalysisUseCase {
  constructor(
    private readonly impactRepo: ImpactAnalysisRepository,
    private readonly artifactRepo: ArtifactRepository,
    private readonly evidenceRepo: EvidenceRepository,
    private readonly insightRepo: InsightRepository,
    private readonly traceabilityRepo: TraceabilityRepository,
    private readonly llmProvider: LlmProvider,
    private readonly retrievalService: HybridRetrievalService,
  ) {}

  async execute(params: { analysisId: string; expandGraph?: boolean; domain?: string }) {
    const analysis = await this.impactRepo.findById(params.analysisId);

    if (!analysis) {
      throw new AppError(
        'IMPACT_ANALYSIS_NOT_FOUND',
        'Impact analysis not found.',
      );
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

    try {
      const snapshotId = analysis.snapshot.id;
      const artifacts = await this.artifactRepo.listBySnapshot(snapshotId);

      // Retrieve using Hybrid RAG — domain scopes keyword expansion via DomainProfile
      const retrievedArtifacts = await this.retrievalService.retrieve({
        projectId: (analysis.snapshot as any).repository?.projectId ?? 'unknown',
        repositoryId: analysis.snapshot.repositoryId,
        snapshotId,
        changeRequest: analysis.requirementRevision.rawText,
        domain: params.domain, // Removed MVP hardcode, falls back via RetrievalService to BOOKING if undefined
        expandGraph: params.expandGraph ?? true,
        maxResults: 20,
      });

      const artifactByKey = new Map(
        artifacts.map((artifact) => [artifact.artifactKey, artifact]),
      );

      const evidenceInputs = retrievedArtifacts
        .map((retrieved: any) => {
          const persistedArtifact = artifactByKey.get(retrieved.artifactKey);
          if (!persistedArtifact) {
            return null;
          }
          
          // Ensure type compatibility for buildExcerpt
          const artifactToExcerpt = {
            stableId: persistedArtifact.artifactKey,
            type: persistedArtifact.artifactType,
            filePath: persistedArtifact.filePath,
            symbolName: persistedArtifact.name,
            startLine: persistedArtifact.startLine ?? 0,
            endLine: persistedArtifact.endLine ?? 0,
          };
          
          const excerpt = buildExcerpt(artifactToExcerpt);
          const contentHash = createHash('sha256').update(excerpt).digest('hex');
          return {
            provenanceKey: `snapshot:${snapshotId}:artifact:${persistedArtifact.artifactKey}`,
            sourceType: toEvidenceSourceType(persistedArtifact.artifactType),
            snapshotId,
            artifactId: persistedArtifact.id,
            sourcePath: persistedArtifact.filePath,
            startLine: persistedArtifact.startLine,
            endLine: persistedArtifact.endLine,
            excerpt,
            contentHash,
            isRedacted: false,
            redactionMetadata: null as Record<string, unknown> | null,
          };
        })
        .filter((entry: any): entry is NonNullable<typeof entry> => entry !== null);

      const evidence = await this.evidenceRepo.upsertMany(evidenceInputs);

      const evidenceByArtifactId = new Map<string, EvidenceRecord>(
        (evidence as EvidenceRecord[])
          .filter((item) => item.artifactId)
          .map((item) => [item.artifactId as string, item]),
      );

      const evidenceByArtifactKey = new Map<string, EvidenceRecord>();
      for (const [artifactKey, artifact] of artifactByKey.entries()) {
        const evidenceRecord = evidenceByArtifactId.get(artifact.id);
        if (evidenceRecord) {
          evidenceByArtifactKey.set(artifactKey, evidenceRecord);
        }
      }

      const affectedLinks = retrievedArtifacts
        .filter((retrieved: any) => retrieved.retrievalMethod !== 'GRAPH')
        .map((retrieved: any) => artifactByKey.get(retrieved.artifactKey))
        .filter((artifact: any): artifact is any => Boolean(artifact));

      const traceabilityLinks = await this.traceabilityRepo.upsertMany(
        affectedLinks.map((artifact: any) => ({
          impactAnalysisId: analysis.id,
          artifactId: artifact.id,
          linkType: 'AFFECTED',
          linkBasis: 'EVIDENCED',
          reviewStatus: 'NEEDS_REVIEW',
          confidence: 1,
        })),
      );

      await Promise.all(
        traceabilityLinks.map((link: { id: string; artifactId: string }) => {
          const evidenceRecord = evidenceByArtifactId.get(link.artifactId);
          if (!evidenceRecord) {
            return Promise.resolve([]);
          }
          return this.traceabilityRepo.linkEvidence({
            linkId: link.id,
            evidenceIds: [evidenceRecord.id],
          });
        }),
      );

      await this.impactRepo.updateStatus({
        id: analysis.id,
        status: 'RUNNING',
        stage: 'RUNNING_AI_REASONING',
        progress: 60,
      });

      const evidenceCandidates = retrievedArtifacts
        .map((retrieved: any) => {
          const persistedArtifact = artifactByKey.get(retrieved.artifactKey);
          if (!persistedArtifact) return null;
          
          return {
            artifactKey: persistedArtifact.artifactKey,
            symbolName: persistedArtifact.name,
            filePath: persistedArtifact.filePath,
            artifactType: persistedArtifact.artifactType,
            excerpt: evidenceInputs.find((e: any) => e.artifactId === persistedArtifact.id)?.excerpt || '',
            retrievalMethod: retrieved.retrievalMethod,
            retrievalReason: `Score: ${retrieved.score}`,
          };
        })
        .filter((c: any) => c !== null) as unknown as EvidenceCandidate[];

      const { systemPrompt, userPrompt, version } = renderPrompt('IMPACT_ANALYSIS', {
        changeRequest: analysis.requirementRevision.rawText,
        snapshotId: analysis.snapshot.id,
        analyzerVersion: analysis.snapshot.analyzerVersion,
        evidenceExcerpts: EvidencePackFormatter.format(evidenceCandidates),
      });

      const { data: llmResponse, metadata } = await this.llmProvider.generateStructured(
        { systemPrompt, userPrompt },
        impactAnalysisAiSchema,
      );

      const insightInputs = [] as Array<{
        impactAnalysisId: string;
        insightKey: string;
        insightType: 'CLAIM' | 'UNKNOWN' | 'QUESTION' | 'ACCEPTANCE_CRITERIA' | 'QA_SCENARIO';
        certainty: 'EVIDENCED' | 'INFERRED' | 'UNKNOWN' | 'CONFLICTING';
        reviewStatus: 'NEEDS_REVIEW' | 'CONFIRMED' | 'REJECTED';
        confidence: number | null;
        title: string;
        description: string;
        reasoning?: string | null;
      }>;

      const evidencedInsightMap: Array<{ insightKey: string; artifactKeys: string[] }> = [];

      for (const insight of llmResponse.insights) {
        insightInputs.push({
          impactAnalysisId: analysis.id,
          insightKey: insight.insightKey,
          insightType: insight.insightType,
          certainty: insight.certainty,
          reviewStatus: 'NEEDS_REVIEW',
          confidence: insight.confidence,
          title: insight.title,
          description: insight.description,
          reasoning: insight.reasoning,
        });

        if (insight.certainty === 'EVIDENCED' && insight.evidenceKeys && insight.evidenceKeys.length > 0) {
          evidencedInsightMap.push({
            insightKey: insight.insightKey,
            artifactKeys: insight.evidenceKeys,
          });
        }
      }

      insightInputs.push(
        ...llmResponse.unknowns.map((unknown) => ({
          impactAnalysisId: analysis.id,
          insightKey: unknown.insightKey,
          insightType: 'UNKNOWN' as const,
          certainty: 'UNKNOWN' as const,
          reviewStatus: 'NEEDS_REVIEW' as const,
          confidence: null,
          title: unknown.description,
          description: unknown.description,
          reasoning: unknown.reasoning,
        })),
      );

      const insights = (await this.insightRepo.upsertMany(
        insightInputs,
      )) as InsightRecord[];

      await Promise.all(
        insights
          .filter((insight) => insight.certainty === 'EVIDENCED')
          .map((insight) => {
            const mapping = evidencedInsightMap.find(
              (item) => item.insightKey === insight.insightKey,
            );
            
            if (!mapping || mapping.artifactKeys.length === 0) {
              return Promise.resolve([]);
            }
            
            const evidenceIds = mapping.artifactKeys
              .map(key => evidenceByArtifactKey.get(key)?.id)
              .filter((id): id is string => Boolean(id));

            if (evidenceIds.length === 0) {
              console.warn(`Could not resolve any evidence IDs for insight ${insight.insightKey}`);
              // Future: Downgrade insight certainty or mark validation issue here
              return Promise.resolve([]);
            }

            return this.insightRepo.linkEvidence({
              insightId: insight.id,
              evidenceIds,
            });
          }),
      );

      return this.impactRepo.updateStatus({
        id: analysis.id,
        status: 'WAITING_FOR_REVIEW',
        stage: 'DONE',
        progress: 100,
        metadata: {
          llm: {
            provider: metadata?.provider || 'unknown',
            model: metadata?.model || 'unknown',
            promptVersion: version,
            parseMode: metadata?.parseMode,
            inputTokens: metadata?.inputTokens,
            outputTokens: metadata?.outputTokens,
            rawLength: metadata?.rawLength,
            jsonLength: metadata?.jsonLength,
            generatedAt: new Date().toISOString(),
          },
          retrieval: {
            strategy: 'hybrid',
            maxArtifacts: 20,
            artifactCount: evidenceInputs.length,
          }
        },
      });
    } catch (e: any) {
      console.error(`RunImpactAnalysisUseCase execution failed:`, e);
      await this.impactRepo.updateStatus({
        id: analysis.id,
        status: 'FAILED',
        stage: analysis.stage,
        progress: analysis.progress,
      });
      throw e;
    }
  }
}
