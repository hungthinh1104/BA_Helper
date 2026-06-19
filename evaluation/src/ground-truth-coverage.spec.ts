import { evaluateGroundTruthArtifactCoverage } from './ground-truth-coverage';

describe('ground-truth artifact coverage', () => {
  it('returns OK when every ground-truth file has an indexed artifact path', () => {
    expect(
      evaluateGroundTruthArtifactCoverage({
        groundTruthFiles: ['src/a.ts', 'src/b.ts'],
        indexedArtifactFilePaths: ['src/a.ts', 'src/b.ts', 'src/c.ts'],
      }),
    ).toEqual({
      status: 'OK',
      indexedGroundTruthFiles: ['src/a.ts', 'src/b.ts'],
      missingIndexedGroundTruthFiles: [],
    });
  });

  it('returns GROUND_TRUTH_NOT_INDEXED with missing files', () => {
    expect(
      evaluateGroundTruthArtifactCoverage({
        groundTruthFiles: ['libs/boat/src/transformers/transformer.ts'],
        indexedArtifactFilePaths: ['libs/boat/src/boat.service.ts'],
      }),
    ).toEqual({
      status: 'GROUND_TRUTH_NOT_INDEXED',
      indexedGroundTruthFiles: [],
      missingIndexedGroundTruthFiles: [
        'libs/boat/src/transformers/transformer.ts',
      ],
    });
  });

  it('returns UNKNOWN when persisted artifact file paths were not inspected', () => {
    expect(
      evaluateGroundTruthArtifactCoverage({
        groundTruthFiles: ['src/a.ts'],
        indexedArtifactFilePaths: undefined,
      }),
    ).toEqual({
      status: 'UNKNOWN',
      indexedGroundTruthFiles: [],
      missingIndexedGroundTruthFiles: ['src/a.ts'],
    });
  });
});
