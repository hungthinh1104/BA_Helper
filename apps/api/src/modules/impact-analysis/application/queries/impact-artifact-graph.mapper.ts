import type { GraphNodeType } from '@ba-helper/contracts';

export function mapArtifactGraphNodeType(artifact: {
  artifactType: string; universalKind?: string | null;
}): GraphNodeType {
  const raw: Record<string, GraphNodeType> = {
    CONTROLLER: 'CONTROLLER', API_ROUTE: 'API_ROUTE', SERVICE_METHOD: 'SERVICE_METHOD',
    ENTITY: 'ENTITY', TEST: 'TEST', JEST_TEST_CASE: 'TEST',
  };
  const universal: Record<string, GraphNodeType> = {
    API_ENDPOINT: 'API_ROUTE', DOMAIN_SERVICE: 'SERVICE_METHOD', DATA_MODEL: 'ENTITY',
    TEST_FILE: 'TEST', TEST_CASE: 'TEST',
  };
  return raw[artifact.artifactType] ?? universal[artifact.universalKind ?? ''] ?? 'SERVICE';
}
