import { Injectable, Logger } from '@nestjs/common';
import { LlmProvider } from '../../../../ai/domain/llm-provider.interface';
import { renderPrompt } from '../../../../ai/domain/prompt-registry';
import { buildCompactDomainContext } from '../../../../domain-profile';
import { impactAnalysisAiSchema } from '../../../../ai/domain/ai.schema';
import {
  EvidenceCandidate,
  EvidencePackFormatter,
} from '../../../../ai/application/evidence-pack.formatter';
import {
  ImpactAiReasoningResult,
  ImpactEvidenceCollectionResult,
  InsightInputParams,
} from './impact-analysis-step.types';

@Injectable()
export class ImpactAiReasoningStep {
  private readonly logger = new Logger(ImpactAiReasoningStep.name);

  constructor(private readonly llmProvider: LlmProvider) {}

  async execute(
    analysis: any,
    evidenceResult: ImpactEvidenceCollectionResult,
    domainPackSelection: any,
  ): Promise<ImpactAiReasoningResult> {
    const MAX_EVIDENCE_ITEMS_FOR_LLM = 12;
    const MAX_TOTAL_EVIDENCE_CHARS = 30000;
    let evidenceTruncated = false;
    let totalEvidenceChars = 0;

    const evidenceCandidates: EvidenceCandidate[] = [];

    for (const retrieved of evidenceResult.retrievedArtifacts) {
      if (evidenceCandidates.length >= MAX_EVIDENCE_ITEMS_FOR_LLM) {
        break;
      }

      const persistedArtifact = evidenceResult.artifactByKey.get(retrieved.artifactKey);
      if (!persistedArtifact) continue;

      const evidenceRecord = evidenceResult.evidenceById.get(persistedArtifact.id);
      let excerpt = evidenceRecord?.excerpt || '';

      if (totalEvidenceChars + excerpt.length > MAX_TOTAL_EVIDENCE_CHARS) {
        const remainingSpace = MAX_TOTAL_EVIDENCE_CHARS - totalEvidenceChars;
        if (remainingSpace > 500) {
          excerpt =
            excerpt.substring(0, remainingSpace) +
            '\n... [TRUNCATED DUE TO TOKEN LIMITS]';
          evidenceTruncated = true;
        } else {
          break;
        }
      }

      totalEvidenceChars += excerpt.length;

      evidenceCandidates.push({
        artifactKey: persistedArtifact.artifactKey,
        symbolName: persistedArtifact.name,
        filePath: persistedArtifact.filePath,
        artifactType: persistedArtifact.artifactType,
        excerpt,
        retrievalMethod: retrieved.retrievalMethod,
        retrievalReason: `Score: ${retrieved.score}`,
      } as unknown as EvidenceCandidate);
    }

    const domainContext = buildCompactDomainContext(
      domainPackSelection.normalizedPackId,
    );

    const { systemPrompt, userPrompt, version } = renderPrompt('IMPACT_ANALYSIS', {
      changeRequest: analysis.requirementRevision.rawText,
      snapshotId: analysis.snapshot.id,
      analyzerVersion: analysis.snapshot.analyzerVersion,
      evidenceExcerpts: EvidencePackFormatter.format(evidenceCandidates),
      domainContext,
    });

    const { data: llmResponse, metadata } = await this.llmProvider.generateStructured(
      { systemPrompt, userPrompt, options: { promptVersion: version } },
      impactAnalysisAiSchema,
    );

    const insightInputs: InsightInputParams[] = [];
    const evidencedInsightMap: Array<{ insightKey: string; artifactKeys: string[] }> = [];
    const resolvableEvidencedInsightKeys = new Set<string>();

    for (const insight of llmResponse.insights) {
      let certainty = insight.certainty;
      let insightMetadata: Record<string, unknown> | undefined;
      const requestedEvidenceKeys = insight.evidenceKeys ?? [];

      if (insight.certainty === 'EVIDENCED') {
        const resolvableArtifactKeys = requestedEvidenceKeys.filter((artifactKey) =>
          evidenceResult.evidenceByKey.has(artifactKey),
        );

        if (resolvableArtifactKeys.length === 0) {
          certainty = requestedEvidenceKeys.length > 0 ? 'INFERRED' : 'UNKNOWN';
          insightMetadata = {
            evidenceIntegrity: 'EVIDENCED_DOWNGRADED_NO_PERSISTED_EVIDENCE',
            originalCertainty: 'EVIDENCED',
            requestedEvidenceKeys,
          };
          this.logger.warn(
            `Downgraded insight ${insight.insightKey} from EVIDENCED because no persisted evidence could be resolved.`,
          );
        } else {
          resolvableEvidencedInsightKeys.add(insight.insightKey);
          evidencedInsightMap.push({
            insightKey: insight.insightKey,
            artifactKeys: resolvableArtifactKeys,
          });
        }
      }

      insightInputs.push({
        impactAnalysisId: analysis.id,
        insightKey: insight.insightKey,
        insightType: insight.insightType,
        certainty,
        reviewStatus: 'NEEDS_REVIEW',
        confidence: insight.confidence,
        title: insight.title,
        description: insight.description,
        reasoning: insight.reasoning,
        metadata: insightMetadata,
      });
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

    return {
      insightInputs,
      evidencedInsightMap,
      resolvableEvidencedInsightKeys,
      llmMetadata: metadata,
      totalEvidenceChars,
      evidenceTruncated,
      evidenceCandidatesLength: evidenceCandidates.length,
      promptVersion: version,
    };
  }
}
