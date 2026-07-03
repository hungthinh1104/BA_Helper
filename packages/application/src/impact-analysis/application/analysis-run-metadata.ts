import type { ImpactEvidenceCollectionResult, ImpactAiReasoningResult } from '../domain/impact-analysis-step.types';
import type { DomainPackSelectionResult } from '../ports/domain-pack-selection.port';
import type { ImpactAnalysisStatusUpdate } from '../ports/impact-analysis.repository.port';

export const buildCompletedAnalysisMetadata = (params: {
  evidenceResult: ImpactEvidenceCollectionResult;
  aiResult: ImpactAiReasoningResult;
  domainPackResult: DomainPackSelectionResult;
}): ImpactAnalysisStatusUpdate['metadata'] => {
  const { evidenceResult, aiResult, domainPackResult } = params;
  const domainPack = domainPackResult.pack;

  return {
    retrieval: evidenceResult.retrievalMetadata,
    ...(aiResult.executiveSummary ? { executiveSummary: aiResult.executiveSummary } : {}),
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
      domainContextUsed: domainPackResult.normalizedPackId,
    },
    domainPack: {
      id: domainPack.id,
      version: domainPack.version,
      status: domainPack.status,
      selectedBy: domainPackResult.selectedBy,
    },
    selectedDomainPack: domainPackResult.resolved,
    reportProvenance: {
      domainPackId: domainPack.id,
      domainPackVersion: domainPack.version,
      domainPackStatus: domainPack.status,
      selectedBy: domainPackResult.selectedBy,
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
          selectedBy: domainPackResult.selectedBy,
          conceptCount: domainPack.concepts.length,
          retrievalHintCount: domainPack.retrievalHints.length,
          riskTemplateCount: domainPack.riskTemplates.length,
          qaTemplateCount: domainPack.qaTemplates.length,
          unknownTemplateCount: domainPack.unknownTemplates.length,
        },
      },
    ],
  };
};
