import type { UniversalArtifactKind } from '@ba-helper/contracts';

export const normalizeArtifactKind = (
  artifactType: string,
): UniversalArtifactKind => {
  switch (artifactType) {
    case 'API_ROUTE':
      return 'API_ENDPOINT';
    case 'SERVICE_METHOD':
      return 'DOMAIN_SERVICE';
    case 'ENTITY':
      return 'DATA_MODEL';
    case 'TEST':
      return 'TEST_CASE';
    default:
      return 'UNKNOWN';
  }
};
