import { normalizeArtifactKind } from './universal-artifact-kind';

describe('normalizeArtifactKind', () => {
  it('maps API_ROUTE to API_ENDPOINT', () => {
    expect(normalizeArtifactKind('API_ROUTE')).toBe('API_ENDPOINT');
  });

  it('maps SERVICE_METHOD to DOMAIN_SERVICE', () => {
    expect(normalizeArtifactKind('SERVICE_METHOD')).toBe('DOMAIN_SERVICE');
  });

  it('maps ENTITY to DATA_MODEL', () => {
    expect(normalizeArtifactKind('ENTITY')).toBe('DATA_MODEL');
  });

  it('maps TEST to TEST_CASE', () => {
    expect(normalizeArtifactKind('TEST')).toBe('TEST_CASE');
  });

  it('maps unknown types to UNKNOWN', () => {
    expect(normalizeArtifactKind('FILE')).toBe('UNKNOWN');
  });
});
