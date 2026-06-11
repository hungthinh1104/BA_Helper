import { AppError } from '../../../shared/app-error';

export const ArtifactPolicy = {
  validateArtifactPayload: (params: {
    artifactKey: string;
    name: string;
    artifactType: string;
    filePath?: string | null;
    excerpt?: string | null;
  }) => {
    // 1. Artifact key must not contain absolute path leakage
    if (params.artifactKey.startsWith('/')) {
      throw new AppError('INVALID_ARTIFACT_KEY', 'Artifact key must be repository-relative, not an absolute path.');
    }

    // 2. Artifact key must not contain path traversal
    if (params.artifactKey.includes('../') || params.artifactKey.includes('..\\')) {
      throw new AppError('INVALID_ARTIFACT_KEY', 'Artifact key must not contain path traversal (../).');
    }

    if (params.filePath) {
      if (params.filePath.startsWith('/')) {
        throw new AppError('INVALID_ARTIFACT_PATH', 'File path must be repository-relative.');
      }
      if (params.filePath.includes('../') || params.filePath.includes('..\\')) {
        throw new AppError('INVALID_ARTIFACT_PATH', 'File path must not contain path traversal.');
      }
    }

    // 3. Artifact name length is bounded
    if (params.name.length > 200) {
      throw new AppError('ARTIFACT_NAME_TOO_LONG', 'Artifact name exceeds the 200 character limit.');
    }

    // 4. Extracted payload size is bounded
    if (params.excerpt && Buffer.from(params.excerpt).length > 50000) {
      throw new AppError('ARTIFACT_PAYLOAD_TOO_LARGE', 'Artifact excerpt exceeds the 50KB limit.');
    }

    // 5. Artifact kind must be known
    const allowedTypes = [
      'CONTROLLER',
      'API_ROUTE',
      'SERVICE',
      'SERVICE_METHOD',
      'ENTITY',
      'MODEL',
      'TEST',
      'MODULE',
      'FILE',
      'FUNCTION',
      'INTERFACE',
      'ENUM',
      'CONSTANT'
    ];
    if (!allowedTypes.includes(params.artifactType)) {
      throw new AppError('INVALID_ARTIFACT_TYPE', `Artifact type ${params.artifactType} is not supported.`);
    }
  },
};
