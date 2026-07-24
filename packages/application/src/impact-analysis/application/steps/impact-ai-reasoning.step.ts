import type { LlmProviderPort } from '../../ports/llm-provider.port';
import { renderPrompt } from '../../ai/prompt-registry';
import { buildDomainPackPromptContext } from '../../domain/domain-pack-context';
import { impactAnalysisAiSchema } from '../../ai/ai.schema';
import { EvidencePackFormatter, type EvidenceCandidate } from '../../ai/evidence-pack.formatter';
import type { ImpactAiReasoningResult, ImpactEvidenceCollectionResult } from '../../domain/impact-analysis-step.types';
import type { DomainPackSelectionResult } from '../../ports/domain-pack-selection.port';
import type { ImpactAnalysisRecord } from '../../ports/impact-analysis.repository.port';
import { normalizeImpactAiOutput } from './impact-ai-output-normalizer';

export class ImpactAiReasoningStep {
  constructor(private readonly llmProvider: LlmProviderPort) {}

  async execute(
    analysis: ImpactAnalysisRecord,
    evidenceResult: ImpactEvidenceCollectionResult,
    domainPackSelection: DomainPackSelectionResult,
  ): Promise<ImpactAiReasoningResult> {
    const MAX_EVIDENCE_ITEMS_FOR_LLM = 12;
    const MAX_TOTAL_EVIDENCE_CHARS = 30000;
    let evidenceTruncated = false;
    let totalEvidenceChars = 0;

    const evidenceCandidates: EvidenceCandidate[] = [];

    for (const retrieved of evidenceResult.retrievedArtifacts) {
      if (evidenceCandidates.length >= MAX_EVIDENCE_ITEMS_FOR_LLM) break;

      const persistedArtifact = evidenceResult.artifactByKey.get(retrieved.artifactKey);
      if (!persistedArtifact) continue;

      const evidenceRecord = evidenceResult.evidenceById.get(persistedArtifact.id);
      if (!evidenceRecord) continue;

      let excerpt = evidenceRecord.excerpt;

      if (totalEvidenceChars + excerpt.length > MAX_TOTAL_EVIDENCE_CHARS) {
        const remainingSpace = MAX_TOTAL_EVIDENCE_CHARS - totalEvidenceChars;
        if (remainingSpace > 500) {
          excerpt = excerpt.substring(0, remainingSpace) + '\n... [TRUNCATED DUE TO TOKEN LIMITS]';
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
      } as EvidenceCandidate);
    }

    const domainContext = buildDomainPackPromptContext(domainPackSelection.pack);

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

    const normalizedOutput = normalizeImpactAiOutput({
      impactAnalysisId: analysis.id,
      response: {
        ...llmResponse,
        unknowns: llmResponse.unknowns ?? [],
      },
      evidenceResult,
    });

    return {
      ...normalizedOutput,
      llmMetadata: metadata,
      totalEvidenceChars,
      evidenceTruncated,
      evidenceCandidatesLength: evidenceCandidates.length,
      promptVersion: version,
      executiveSummary: llmResponse.executiveSummary,
    };
  }
}
