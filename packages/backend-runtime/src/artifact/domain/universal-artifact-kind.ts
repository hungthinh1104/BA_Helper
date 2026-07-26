import type { UniversalArtifactKind } from '@ba-helper/contracts';

export const normalizeArtifactKind = (
  artifactType: string,
): UniversalArtifactKind => {
  switch (artifactType) {
    case 'API_ROUTE':
    case 'HTTP_ENDPOINT':
      return 'API_ENDPOINT';
    case 'SERVICE_METHOD':
      return 'DOMAIN_SERVICE';
    case 'ENTITY':
      return 'DATA_MODEL';
    case 'TEST':
    case 'SPRING_TEST':
      return 'TEST_CASE';
    case 'SPRING_CONTROLLER_METHOD':
      return 'API_ENDPOINT';
    case 'SPRING_SERVICE_METHOD':
      return 'DOMAIN_SERVICE';
    case 'SPRING_ENTITY':
      return 'DATA_MODEL';
    default:
      return 'UNKNOWN';
  }
};
