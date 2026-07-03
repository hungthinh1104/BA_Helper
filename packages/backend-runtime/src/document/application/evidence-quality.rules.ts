import type {
  EvidenceQualitySummary,
  InsightForAnnotation,
} from './evidence-quality.types';

type EvidenceForQuality = {
  sourceType: string;
  artifactId?: string | null;
  snapshotId?: string | null;
  sourcePath?: string | null;
  startLine?: number | null;
  endLine?: number | null;
  excerpt?: string | null;
  provenanceKey?: string | null;
  artifact?: {
    id?: string;
    filePath?: string | null;
    name?: string | null;
  } | null;
  retrievalMetadata?: unknown;
};

export function inspectEvidence(evidence: EvidenceForQuality[], fallbackArtifact?: {
  id?: string;
  filePath?: string | null;
  name?: string | null;
} | null): {
  hasEvidence: boolean;
  hasSourceEvidence: boolean;
  hasStrongSourceEvidence: boolean;
  hasDomainHintOnly: boolean;
  hasArtifactLink: boolean;
  hasSourcePath: boolean;
  hasLineRange: boolean;
  hasSpecificExcerpt: boolean;
} {
  const hasEvidence = evidence.length > 0;
  const hasDomainHintOnly = hasEvidence && evidence.every(isDomainHintEvidence);
  const sourceEvidence = evidence.filter(isSourceEvidence);
  const hasArtifactLink =
    sourceEvidence.some((item) => !!item.artifactId || !!item.artifact?.id) ||
    !!fallbackArtifact?.id;
  const hasSourcePath = sourceEvidence.some((item) => !!item.sourcePath || !!item.artifact?.filePath);
  const hasLineRange = sourceEvidence.some((item) => item.startLine !== null && item.endLine !== null);
  const hasSpecificExcerpt = sourceEvidence.some((item) => isSpecificExcerpt(item.excerpt));

  return {
    hasEvidence,
    hasSourceEvidence: sourceEvidence.length > 0,
    hasStrongSourceEvidence:
      hasArtifactLink &&
      hasSourcePath &&
      hasLineRange &&
      hasSpecificExcerpt,
    hasDomainHintOnly,
    hasArtifactLink,
    hasSourcePath,
    hasLineRange,
    hasSpecificExcerpt,
  };
}

export function buildEvidenceReasons(facts: ReturnType<typeof inspectEvidence>): string[] {
  const reasons: string[] = [];
  if (facts.hasEvidence) reasons.push('hasPersistedEvidence');
  if (facts.hasSourceEvidence) reasons.push('hasSourceEvidence');
  if (facts.hasArtifactLink) reasons.push('hasArtifactLink');
  if (facts.hasSourcePath) reasons.push('hasSourcePath');
  if (facts.hasLineRange) reasons.push('hasLineRange');
  if (facts.hasSpecificExcerpt) reasons.push('hasSpecificExcerpt');
  if (!facts.hasSpecificExcerpt && facts.hasSourceEvidence) reasons.push('weakOrGenericExcerpt');
  return reasons;
}

export function hasUsableArtifact(artifact: { filePath?: string | null; name?: string | null } | null): boolean {
  if (!artifact) return false;
  const name = artifact.name ?? '';
  return !!artifact.filePath || (!!name && !name.includes('UNKNOWN'));
}

export function readRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

export function isDomainHintMetadata(
  metadata: Record<string, unknown>,
  insight: Pick<InsightForAnnotation, 'title' | 'description' | 'reasoning'>,
): boolean {
  const haystack = [
    metadata.origin,
    metadata.source,
    metadata.kind,
    metadata.evidenceIntegrity,
    insight.title,
    insight.description,
    insight.reasoning,
  ].filter((value): value is string => typeof value === 'string');

  return haystack.some((value) => /domain[-_ ]pack|domain hint|partial .* hint/i.test(value));
}

export function hasStructuralMetadata(metadata: Record<string, unknown>): boolean {
  return ['artifactKey', 'artifactKeys', 'impactedArtifacts', 'retrievalScope', 'sourcePath']
    .some((key) => metadata[key] !== undefined);
}

export function isReviewRequiredInsight(
  insight: Pick<InsightForAnnotation, 'reviewStatus' | 'certainty' | 'insightType'>,
): boolean {
  if (insight.reviewStatus !== 'NEEDS_REVIEW') {
    return false;
  }
  return (
    insight.certainty === 'EVIDENCED' ||
    insight.certainty === 'CONFLICTING' ||
    insight.insightType === 'CLAIM' ||
    insight.insightType === 'UNKNOWN'
  );
}

export function emptyEvidenceQualitySummary(): EvidenceQualitySummary {
  return {
    STRONG_SOURCE_EVIDENCE: 0,
    WEAK_SOURCE_EVIDENCE: 0,
    INFERRED_FROM_STRUCTURE: 0,
    DOMAIN_HINT_ONLY: 0,
    MISSING_EVIDENCE: 0,
    CONFLICTING_EVIDENCE: 0,
    REVIEW_REQUIRED: 0,
    DERIVED_ARTIFACT: 0,
    strongSourceEvidence: 0,
    weakSourceEvidence: 0,
    inferredFromStructure: 0,
    domainHintOnly: 0,
    missingEvidence: 0,
    conflictingEvidence: 0,
    reviewRequired: 0,
    derivedArtifact: 0,
    evidenced: 0,
    inferred: 0,
    weakEvidence: 0,
  };
}

function isSourceEvidence(evidence: EvidenceForQuality): boolean {
  return (
    evidence.sourceType === 'CODE' ||
    evidence.sourceType === 'TEST' ||
    evidence.sourceType === 'STATIC_ANALYSIS' ||
    (!!evidence.sourcePath && !!evidence.excerpt && !isDomainHintEvidence(evidence))
  );
}

function isDomainHintEvidence(evidence: EvidenceForQuality): boolean {
  return [evidence.provenanceKey, evidence.sourcePath, evidence.excerpt]
    .some((value) => typeof value === 'string' && /domain[-_ ]pack|domain hint/i.test(value));
}

function isSpecificExcerpt(value: string | null | undefined): boolean {
  const normalized = value?.trim() ?? '';
  if (normalized.length < 24) {
    return false;
  }
  return !/^(todo|n\/a|unknown|placeholder|domain hint|domain pack hint)$/i.test(normalized);
}
