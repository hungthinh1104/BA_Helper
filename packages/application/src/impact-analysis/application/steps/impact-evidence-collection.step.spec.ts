import { describe, expect, it, jest } from '@jest/globals';
import { ImpactEvidenceCollectionStep } from './impact-evidence-collection.step';

describe('ImpactEvidenceCollectionStep retrieval metadata', () => {
  it('persists an explicit lexical fallback when the selected model has no chunks', async () => {
    const step = new ImpactEvidenceCollectionStep(
      { listBySnapshot: jest.fn<(...args: any[]) => Promise<any>>().mockResolvedValue([]) } as any,
      { listByArtifactIds: jest.fn<(...args: any[]) => Promise<any>>().mockResolvedValue([]) } as any,
      {
        upsertMany: jest.fn<(...args: any[]) => Promise<any>>().mockResolvedValue([]),
        linkEvidenceMany: jest.fn<(...args: any[]) => Promise<any>>().mockResolvedValue(undefined),
      } as any,
      {
        retrieve: jest.fn<(...args: any[]) => Promise<any>>().mockResolvedValue({
          artifacts: [],
          diagnostics: {
            strategy: 'lexical_fallback',
            vectorStatus: 'NO_COMPATIBLE_CHUNKS',
          },
        }),
      } as any,
    );

    const result = await step.execute({
      id: 'analysis-1',
      snapshot: {
        id: 'snapshot-1',
        repositoryId: 'repository-1',
        repository: { projectId: 'project-1' },
      },
      requirementRevision: { rawText: 'Cancel a paid booking' },
    } as any, { normalizedPackId: 'BOOKING' } as any, false);

    expect(result.retrievalMetadata).toEqual({
      strategy: 'lexical_fallback',
      vectorStatus: 'NO_COMPATIBLE_CHUNKS',
      maxArtifacts: 20,
      artifactCount: 0,
      vectorSignalCount: 0,
    });
  });
});
