import { SecretRedactor, type ScanArtifact } from '@ba-helper/analyzer';
import { createArtifactIdentity } from '@ba-helper/shared';
import { scanTestCaseMetadataSchema, testCaseMetadataSchema } from '@ba-helper/contracts';
import { AppError } from '@ba-helper/shared';
import type { ArtifactRepository } from '../../artifact/infrastructure/artifact.repository';
import { normalizeArtifactKind } from '../../artifact/domain/universal-artifact-kind';
import type { DiagnosticCollectorLike } from './scan-persistence-mappers';

export function buildArtifactInputs(
  snapshotId: string,
  artifacts: ScanArtifact[],
  collector: DiagnosticCollectorLike,
  commitSha?: string,
): Parameters<ArtifactRepository['createMany']>[0] {
  const identities = new Set<string>();
  const artifactByStableId = new Map(artifacts.map(artifact => [artifact.stableId, artifact]));
  for (const artifact of artifacts) {
    if (identities.has(artifact.stableId)) {
      throw new AppError('INVALID_ARTIFACT_KEY', 'Multiple extracted artifacts share the same stable identity.');
    }
    identities.add(artifact.stableId);
  }

  return artifacts.map((artifact) => {
    const redact = (label: string): string => {
      const result = SecretRedactor.redact(label);
      if (result.foundSecrets) collector.addSecretRedacted(artifact.filePath);
      return result.redactedContent;
    };
    const metadata = artifact.type === 'JEST_TEST_CASE'
      ? { testCase: validatedCase(snapshotId, artifact, artifactByStableId, redact, commitSha) }
      : undefined;
    return {
      snapshotId,
      artifactKey: artifact.stableId,
      artifactType: artifact.type,
      universalKind: normalizeArtifactKind(artifact.type),
      name: redact(artifact.symbolName),
      filePath: artifact.filePath,
      startLine: artifact.startLine,
      endLine: artifact.endLine,
      contentHash: artifact.contentHash,
      ...(metadata ? { metadata } : {}),
    };
  });
}

export function assertArtifactPersistenceMatches(
  inputs: Parameters<ArtifactRepository['createMany']>[0],
  persisted: Array<{
    id: string;
    artifactKey: string;
    artifactType: string;
    universalKind: string;
    name: string;
    filePath: string;
    startLine: number | null;
    endLine: number | null;
    contentHash: string | null;
    metadata: unknown;
  }>,
): void {
  const persistedByKey = new Map(persisted.map(artifact => [artifact.artifactKey, artifact]));
  if (persistedByKey.size !== persisted.length || persisted.length !== inputs.length) {
    throw new AppError('INVALID_ARTIFACT_KEY', 'Persisted artifact identities conflict with the extracted snapshot.');
  }

  for (const input of inputs) {
    const artifact = persistedByKey.get(input.artifactKey);
    const metadata = input.metadata ?? null;
    if (!artifact ||
      (artifact.artifactType !== undefined && artifact.artifactType !== input.artifactType) ||
      (artifact.universalKind !== undefined && artifact.universalKind !== input.universalKind) ||
      (artifact.name !== undefined && artifact.name !== input.name) ||
      (artifact.filePath !== undefined && artifact.filePath !== input.filePath) ||
      (artifact.startLine !== undefined && artifact.startLine !== (input.startLine ?? null)) ||
      (artifact.endLine !== undefined && artifact.endLine !== (input.endLine ?? null)) ||
      (artifact.contentHash !== undefined && artifact.contentHash !== (input.contentHash ?? null)) ||
      (artifact.metadata !== undefined && stableJson(artifact.metadata) !== stableJson(metadata))) {
      throw new AppError('INVALID_ARTIFACT_KEY', 'Persisted artifact data conflicts with its extracted identity.');
    }
  }
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value).sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`).join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

function validatedCase(snapshotId: string, artifact: ScanArtifact, artifactByStableId: Map<string, ScanArtifact>,
  redact: (label: string) => string, commitSha?: string) {
  const testCase = scanTestCaseMetadataSchema.parse(artifact.testCase);
  if (testCase.parentFileArtifactKey !== createArtifactIdentity('test', artifact.filePath, 'file')) {
    throw new AppError('INVALID_ARTIFACT_KEY', 'Test case must reference its own source file.');
  }
  if (testCase.behaviorEvidence?.some(claim => claim.sourceLocation.relativePath !== artifact.filePath)) {
    throw new AppError('INVALID_ARTIFACT_KEY', 'Behavior evidence must reference its test case source file.');
  }
  if (testCase.behaviorEvidence?.some(claim => !commitSha || claim.commitSha !== commitSha)) {
    throw new AppError('INVALID_ARTIFACT_KEY', 'Behavior evidence must reference the persisted snapshot commit.');
  }
  const sourceFileArtifact = testCase.behaviorEvidence?.length
    ? artifactByStableId.get(testCase.parentFileArtifactKey) : undefined;
  if (testCase.behaviorEvidence?.length && (!sourceFileArtifact || sourceFileArtifact.type !== 'TEST' ||
      sourceFileArtifact.filePath !== artifact.filePath)) {
    throw new AppError('INVALID_ARTIFACT_KEY', 'Behavior evidence must reference its persisted test file evidence.');
  }
  const evidenceProvenanceKey = sourceFileArtifact
    ? `snapshot:${snapshotId}:artifact:${sourceFileArtifact.stableId}`
    : `snapshot:${snapshotId}:artifact:${artifact.stableId}`;
  if (testCase.behaviorEvidence?.some(claim => claim.evidenceProvenanceKey &&
      claim.evidenceProvenanceKey !== evidenceProvenanceKey)) {
    throw new AppError('INVALID_ARTIFACT_KEY', 'Behavior evidence provenance must reference its persisted source evidence.');
  }
  return testCaseMetadataSchema.parse({
    ...testCase,
    title: redact(testCase.title),
    suitePath: testCase.suitePath.map(redact),
    ...(testCase.behaviorEvidence ? {
      behaviorEvidence: testCase.behaviorEvidence.map(claim => ({ ...claim, sourceText: redact(claim.sourceText),
        evidenceProvenanceKey })),
    } : {}),
  });
}
