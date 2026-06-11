import { IncrementalScanClassifier } from './incremental-scan-classifier';
import type { ScanArtifact } from '@ba-helper/analyzer';
import type { CodeArtifact } from '@prisma/client';

describe('IncrementalScanClassifier', () => {
  const currentAnalyzerVersion = '1.0.0';

  const makeScanArtifact = (id: string, hash: string | null = 'hash123'): ScanArtifact => ({
    stableId: id,
    type: 'FUNCTION',
    filePath: 'src/main.ts',
    symbolName: id,
    startLine: 1,
    endLine: 10,
    excerpt: 'function foo() {}',
    contentHash: hash,
  });

  const makeCodeArtifact = (id: string, hash: string | null = 'hash123'): CodeArtifact => ({
    id: `db-${id}`,
    snapshotId: 'prev-snap',
    artifactKey: id,
    artifactType: 'FUNCTION',
    universalKind: 'FUNCTION',
    name: id,
    filePath: 'src/main.ts',
    startLine: 1,
    endLine: 10,
    contentHash: hash,
  } as CodeArtifact);

  it('classifies all as ADDED when no previous snapshot exists', () => {
    const currentArtifacts = [makeScanArtifact('a1')];
    
    const result = IncrementalScanClassifier.classify({
      currentArtifacts,
      currentAnalyzerVersion,
      previousSnapshot: null,
      previousArtifacts: [],
    });

    expect(result.baseSnapshotId).toBeNull();
    expect(result.reuseSafety).toBe('NO_BASELINE');
    expect(result.addedArtifactCount).toBe(1);
    expect(result.unchangedArtifactCount).toBe(0);
    expect(result.reuseEligibleRatio).toBe(0);
    expect(result.samples.added.length).toBe(1);
    expect(result.samples.added[0].artifactKey).toBe('a1');
  });

  it('classifies ADDED, CHANGED, UNCHANGED, REMOVED correctly', () => {
    const currentArtifacts = [
      makeScanArtifact('added1'),
      makeScanArtifact('changed1', 'new-hash'),
      makeScanArtifact('unchanged1', 'same-hash'),
    ];

    const previousArtifacts = [
      makeCodeArtifact('changed1', 'old-hash'),
      makeCodeArtifact('unchanged1', 'same-hash'),
      makeCodeArtifact('removed1'),
    ];

    const result = IncrementalScanClassifier.classify({
      currentArtifacts,
      currentAnalyzerVersion,
      previousSnapshot: { id: 'prev-snap', analyzerVersion: '1.0.0' },
      previousArtifacts,
    });

    expect(result.baseSnapshotId).toBe('prev-snap');
    expect(result.reuseSafety).toBe('SAFE_FOR_FUTURE_REUSE');
    expect(result.addedArtifactCount).toBe(1);
    expect(result.samples.added[0].artifactKey).toBe('added1');
    
    expect(result.changedArtifactCount).toBe(1);
    expect(result.samples.changed[0].artifactKey).toBe('changed1');
    
    expect(result.unchangedArtifactCount).toBe(1);
    
    expect(result.removedArtifactCount).toBe(1);
    expect(result.samples.removed[0].artifactKey).toBe('removed1');

    expect(result.hashUnavailableArtifactCount).toBe(0);
    expect(result.reuseEligibleArtifactCount).toBe(1); // unchanged is 1
    expect(result.reuseEligibleRatio).toBeCloseTo(1 / 3);
  });

  it('classifies matched artifact with missing old hash as HASH_UNAVAILABLE', () => {
    const currentArtifacts = [makeScanArtifact('a1', 'new-hash')];
    const previousArtifacts = [makeCodeArtifact('a1', null)];

    const result = IncrementalScanClassifier.classify({
      currentArtifacts,
      currentAnalyzerVersion,
      previousSnapshot: { id: 'prev-snap', analyzerVersion: '1.0.0' },
      previousArtifacts,
    });

    expect(result.hashUnavailableArtifactCount).toBe(1);
    expect(result.changedArtifactCount).toBe(0);
    expect(result.unchangedArtifactCount).toBe(0);
    expect(result.samples.hashUnavailable[0].artifactKey).toBe('a1');
  });

  it('classifies matched artifact with missing new hash as HASH_UNAVAILABLE', () => {
    const currentArtifacts = [makeScanArtifact('a1', null)];
    const previousArtifacts = [makeCodeArtifact('a1', 'old-hash')];

    const result = IncrementalScanClassifier.classify({
      currentArtifacts,
      currentAnalyzerVersion,
      previousSnapshot: { id: 'prev-snap', analyzerVersion: '1.0.0' },
      previousArtifacts,
    });

    expect(result.hashUnavailableArtifactCount).toBe(1);
    expect(result.changedArtifactCount).toBe(0);
    expect(result.unchangedArtifactCount).toBe(0);
  });

  it('added artifact with missing hash remains ADDED, not HASH_UNAVAILABLE', () => {
    const currentArtifacts = [makeScanArtifact('added1', null)];

    const result = IncrementalScanClassifier.classify({
      currentArtifacts,
      currentAnalyzerVersion,
      previousSnapshot: { id: 'prev-snap', analyzerVersion: '1.0.0' },
      previousArtifacts: [],
    });

    expect(result.addedArtifactCount).toBe(1);
    expect(result.hashUnavailableArtifactCount).toBe(0);
  });

  it('removed artifact with missing old hash remains REMOVED, not HASH_UNAVAILABLE', () => {
    const currentArtifacts: ScanArtifact[] = [];
    const previousArtifacts = [makeCodeArtifact('removed1', null)];

    const result = IncrementalScanClassifier.classify({
      currentArtifacts,
      currentAnalyzerVersion,
      previousSnapshot: { id: 'prev-snap', analyzerVersion: '1.0.0' },
      previousArtifacts,
    });

    expect(result.removedArtifactCount).toBe(1);
    expect(result.hashUnavailableArtifactCount).toBe(0);
  });

  it('bounds samples to max 20 per category and sorts deterministically', () => {
    const currentArtifacts: ScanArtifact[] = [];
    const previousArtifacts: CodeArtifact[] = [];

    // Add 25 removed artifacts, intentionally out of order
    for (let i = 25; i >= 1; i--) {
      const id = i.toString().padStart(2, '0');
      previousArtifacts.push(makeCodeArtifact(`rm-${id}`));
    }

    const result = IncrementalScanClassifier.classify({
      currentArtifacts,
      currentAnalyzerVersion,
      previousSnapshot: { id: 'prev-snap', analyzerVersion: '1.0.0' },
      previousArtifacts,
    });

    expect(result.removedArtifactCount).toBe(25);
    expect(result.samples.removed.length).toBe(20);

    // They should be sorted by universalKind, filePath, name, artifactKey
    // Since everything is the same except artifactKey (`rm-XX`), they sort alphabetically
    expect(result.samples.removed[0].artifactKey).toBe('rm-01');
    expect(result.samples.removed[19].artifactKey).toBe('rm-20');
  });

  it('adds warning and sets reuseSafety VERSION_CHANGED_REVIEW_REQUIRED if versions differ', () => {
    const currentArtifacts = [makeScanArtifact('unchanged1', 'same-hash')];
    const previousArtifacts = [makeCodeArtifact('unchanged1', 'same-hash')];

    const result = IncrementalScanClassifier.classify({
      currentArtifacts,
      currentAnalyzerVersion: '1.1.0',
      previousSnapshot: { id: 'prev-snap', analyzerVersion: '1.0.0' },
      previousArtifacts,
    });

    expect(result.reuseSafety).toBe('VERSION_CHANGED_REVIEW_REQUIRED');
    expect(result.warnings).toContain('SCANNER_OR_ANALYZER_VERSION_CHANGED');
    expect(result.unchangedArtifactCount).toBe(1);
  });
});
