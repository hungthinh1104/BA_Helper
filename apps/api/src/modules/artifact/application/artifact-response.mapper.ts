import { codeArtifactMetadataSchema } from '@ba-helper/contracts';

type ArtifactRecord = {
  id: string; artifactKey: string; name: string; artifactType: string;
  universalKind: string | null; filePath: string; startLine: number | null;
  endLine: number | null; language: string | null; metadata?: unknown;
};

export function readTestCaseMetadata(artifact: { artifactType: string; metadata?: unknown }) {
  if (artifact.artifactType !== 'JEST_TEST_CASE') return undefined;
  const parsed = codeArtifactMetadataSchema.safeParse(artifact.metadata);
  return parsed.success ? parsed.data.testCase : undefined;
}

export function mapArtifactResponse(artifact: ArtifactRecord) {
  return {
    id: artifact.id,
    artifactKey: artifact.artifactKey,
    name: artifact.name,
    artifactType: artifact.artifactType,
    universalKind: artifact.universalKind ?? 'UNKNOWN',
    filePath: artifact.filePath,
    startLine: artifact.startLine,
    endLine: artifact.endLine,
    language: artifact.language,
    testCase: readTestCaseMetadata(artifact),
  };
}
