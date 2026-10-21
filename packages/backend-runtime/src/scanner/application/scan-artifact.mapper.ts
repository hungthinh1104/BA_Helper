import { SecretRedactor, type ScanArtifact } from '@ba-helper/analyzer';
import { testCaseMetadataSchema } from '@ba-helper/contracts';
import { AppError } from '@ba-helper/shared';
import type { ArtifactRepository } from '../../artifact/infrastructure/artifact.repository';
import { normalizeArtifactKind } from '../../artifact/domain/universal-artifact-kind';
import type { DiagnosticCollectorLike } from './scan-persistence-mappers';

export function buildArtifactInputs(
  snapshotId: string,
  artifacts: ScanArtifact[],
  collector: DiagnosticCollectorLike,
): Parameters<ArtifactRepository['createMany']>[0] {
  return artifacts.map((artifact) => {
    const redact = (label: string): string => {
      const result = SecretRedactor.redact(label);
      if (result.foundSecrets) collector.addSecretRedacted(artifact.filePath);
      return result.redactedContent;
    };
    const metadata = artifact.type === 'JEST_TEST_CASE'
      ? { testCase: validatedCase(artifact, redact) }
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

function validatedCase(artifact: ScanArtifact, redact: (label: string) => string) {
  const testCase = testCaseMetadataSchema.parse(artifact.testCase);
  if (testCase.parentFileArtifactKey !== `test:${artifact.filePath.replace(/[/\\]/g, '.')}`) {
    throw new AppError('INVALID_ARTIFACT_KEY', 'Test case must reference its own source file.');
  }
  return testCaseMetadataSchema.parse({
    ...testCase,
    title: redact(testCase.title),
    suitePath: testCase.suitePath.map(redact),
  });
}
