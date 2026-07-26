import type { ImpactAnalysisAiResponse } from '../../ai/ai.schema';
import { AiOutputError } from '../../ai/ai.errors';
import type { ImpactEvidenceCollectionResult } from '../../domain/impact-analysis-step.types';
import type { InsightInputParams } from '../../ports/insight.repository.port';

type AiInsight = ImpactAnalysisAiResponse['insights'][number];
type LegacyUnknown = ImpactAnalysisAiResponse['unknowns'][number];

type NormalizerInput = {
  impactAnalysisId: string;
  response: ImpactAnalysisAiResponse;
  evidenceResult: ImpactEvidenceCollectionResult;
};

export type NormalizedAiInsightOutput = {
  insightInputs: InsightInputParams[];
  insightEvidenceMap: Array<{ insightKey: string; artifactKeys: string[] }>;
  evidencedInsightMap: Array<{ insightKey: string; artifactKeys: string[] }>;
  resolvableEvidencedInsightKeys: Set<string>;
};

type MutableInsight = Omit<AiInsight, 'evidenceKeys' | 'relatedArtifactKeys'> & {
  evidenceKeys: string[];
  relatedArtifactKeys: string[];
};

export function normalizeImpactAiOutput(
  params: NormalizerInput,
): NormalizedAiInsightOutput {
  const seen = new Set<string>();
  const insights = mergeInsights(params.response);
  const insightInputs: InsightInputParams[] = [];
  const insightEvidenceMap: Array<{ insightKey: string; artifactKeys: string[] }> = [];
  const evidencedInsightMap: Array<{ insightKey: string; artifactKeys: string[] }> = [];
  const resolvableEvidencedInsightKeys = new Set<string>();

  for (const insight of insights) {
    if (seen.has(insight.insightKey)) {
      throw new AiOutputError(
        'AI_OUTPUT_SCHEMA_VALIDATION_FAILED',
        `Duplicate AI insightKey: ${insight.insightKey}`,
        { insightKey: insight.insightKey },
      );
    }
    seen.add(insight.insightKey);

    const normalized = normalizeInsight(params.impactAnalysisId, insight, params.evidenceResult);
    insightInputs.push(normalized.input);

    if (normalized.evidenceArtifactKeys.length > 0) {
      insightEvidenceMap.push({
        insightKey: normalized.input.insightKey,
        artifactKeys: normalized.evidenceArtifactKeys,
      });
    }

    if (normalized.input.certainty === 'EVIDENCED') {
      resolvableEvidencedInsightKeys.add(normalized.input.insightKey);
      evidencedInsightMap.push({
        insightKey: normalized.input.insightKey,
        artifactKeys: normalized.evidenceArtifactKeys,
      });
    }
  }

  return {
    insightInputs,
    insightEvidenceMap,
    evidencedInsightMap,
    resolvableEvidencedInsightKeys,
  };
}

function mergeInsights(response: ImpactAnalysisAiResponse): MutableInsight[] {
  return [
    ...response.insights.map((insight) => ({
      ...insight,
      evidenceKeys: insight.evidenceKeys ?? [],
      relatedArtifactKeys: insight.relatedArtifactKeys ?? [],
    })),
    ...(response.unknowns ?? []).map(mapLegacyUnknown),
  ];
}

function mapLegacyUnknown(unknown: LegacyUnknown): MutableInsight {
  return {
    insightKey: unknown.insightKey,
    insightType: 'UNKNOWN',
    certainty: 'UNKNOWN',
    confidence: null,
    title: unknown.description,
    description: unknown.description,
    reasoning: unknown.reasoning,
    evidenceKeys: unknown.evidenceKeys ?? [],
    relatedArtifactKeys: unknown.relatedArtifactKeys ?? [],
  };
}

function normalizeInsight(
  impactAnalysisId: string,
  insight: MutableInsight,
  evidenceResult: ImpactEvidenceCollectionResult,
): { input: InsightInputParams; evidenceArtifactKeys: string[] } {
  const requestedEvidenceKeys = unique(insight.evidenceKeys);
  const requestedRelatedArtifactKeys = unique(insight.relatedArtifactKeys);
  const evidenceArtifactKeys = resolveEvidenceKeys(
    [...requestedEvidenceKeys, ...requestedRelatedArtifactKeys],
    evidenceResult,
  );
  const relatedArtifactKeys = requestedRelatedArtifactKeys.filter((key) =>
    evidenceResult.artifactByKey.has(key),
  );

  let insightType = insight.insightType;
  let certainty = insight.certainty;
  let confidence = insight.confidence;
  let description = normalizeQaDescription(insight);
  const metadata: Record<string, unknown> = {};

  if (insight.kind === 'risk') {
    metadata.kind = 'risk';
    metadata.severity = insight.severity ?? 'MEDIUM';
    if (insight.category) metadata.category = insight.category;
  }

  if (insight.given || insight.when || insight.then) {
    metadata.qa = {
      given: insight.given ?? null,
      when: insight.when ?? null,
      then: insight.then ?? null,
    };
  }

  if (requestedEvidenceKeys.length > 0) metadata.requestedEvidenceKeys = requestedEvidenceKeys;
  if (requestedRelatedArtifactKeys.length > 0) {
    metadata.relatedArtifactKeys = requestedRelatedArtifactKeys;
    metadata.resolvedRelatedArtifactKeys = relatedArtifactKeys;
  }

  if (insightType === 'QUESTION' || insightType === 'UNKNOWN') {
    certainty = 'UNKNOWN';
    confidence = null;
  }

  if (insightType === 'QA_SCENARIO' && !isQaScenarioTestable(insight, description)) {
    insightType = 'UNKNOWN';
    certainty = 'UNKNOWN';
    confidence = null;
    metadata.qaIntegrity = 'QA_SCENARIO_DOWNGRADED_NOT_TESTABLE';
    metadata.originalInsightType = 'QA_SCENARIO';
  }

  const traceable = evidenceArtifactKeys.length > 0 || relatedArtifactKeys.length > 0;
  if ((insightType === 'QA_SCENARIO' || insightType === 'ACCEPTANCE_CRITERIA') && !traceable) {
    certainty = 'UNKNOWN';
    metadata.traceabilityIntegrity = `${insightType}_DOWNGRADED_NO_TRACEABLE_CONTEXT`;
    metadata.originalCertainty = insight.certainty;
  }

  if (certainty === 'EVIDENCED' && evidenceArtifactKeys.length === 0) {
    certainty = 'UNKNOWN';
    metadata.evidenceIntegrity = 'EVIDENCED_DOWNGRADED_NO_PERSISTED_EVIDENCE';
    metadata.originalCertainty = 'EVIDENCED';
  }

  if (certainty === 'INFERRED' && evidenceArtifactKeys.length === 0) {
    certainty = 'UNKNOWN';
    metadata.evidenceIntegrity = 'INFERRED_DOWNGRADED_NO_CONTEXTUAL_EVIDENCE';
    metadata.originalCertainty = 'INFERRED';
  }

  if (certainty === 'CONFLICTING' && evidenceArtifactKeys.length < 2) {
    certainty = 'UNKNOWN';
    metadata.evidenceIntegrity = 'CONFLICTING_DOWNGRADED_INSUFFICIENT_EVIDENCE';
    metadata.originalCertainty = 'CONFLICTING';
  }

  return {
    input: {
      impactAnalysisId,
      insightKey: insight.insightKey,
      insightType,
      certainty,
      reviewStatus: 'NEEDS_REVIEW',
      confidence,
      title: insight.title,
      description,
      reasoning: insight.reasoning,
      metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
    },
    evidenceArtifactKeys,
  };
}

function normalizeQaDescription(insight: MutableInsight): string {
  if (insight.insightType !== 'QA_SCENARIO') return insight.description;
  if (!insight.given || !insight.when || !insight.then) return insight.description;

  return [
    `Given: ${insight.given}`,
    `When: ${insight.when}`,
    `Then: ${insight.then}`,
  ].join('\n');
}

function isQaScenarioTestable(insight: MutableInsight, description: string): boolean {
  if (insight.given && insight.when && insight.then) return true;

  const normalized = description.toLowerCase();
  return (
    normalized.includes('given:') &&
    normalized.includes('when:') &&
    normalized.includes('then:')
  );
}

function resolveEvidenceKeys(
  artifactKeys: string[],
  evidenceResult: ImpactEvidenceCollectionResult,
): string[] {
  return unique(artifactKeys).filter((artifactKey) => evidenceResult.evidenceByKey.has(artifactKey));
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter((value) => value.trim().length > 0)));
}
