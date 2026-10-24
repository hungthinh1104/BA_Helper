import { GetRepositorySnapshotDriftUseCase } from './get-repository-snapshot-drift.usecase';
import { PrismaService } from "@ba-helper/backend-runtime";

describe('GetRepositorySnapshotDriftUseCase', () => {
  let prisma: jest.Mocked<PrismaService>;
  let useCase: GetRepositorySnapshotDriftUseCase;

  beforeEach(() => {
    prisma = {
      repositorySnapshot: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
      },
      codeArtifact: {
        findMany: jest.fn(),
      },
    } as any;
    useCase = new GetRepositorySnapshotDriftUseCase(prisma);
  });

  const baseSnapshot = {
    id: 'base-snap-id',
    repositoryId: 'repo-1',
    repository: { projectId: 'proj-1' },
    analyzerVersion: '0.1.0',
    coverageStatus: 'READY',
  };

  const targetSnapshot = {
    id: 'target-snap-id',
    repositoryId: 'repo-1',
    repository: { projectId: 'proj-1' },
    analyzerVersion: '0.1.0',
    coverageStatus: 'READY',
  };

  it('throws 404 if base snapshot is missing or belongs to different project', async () => {
    (prisma.repositorySnapshot.findUnique as jest.Mock).mockResolvedValueOnce(null);
    await expect(useCase.execute({ projectId: 'proj-1', repositoryId: 'repo-1', baseSnapshotId: 'base' })).rejects.toThrow('Base snapshot not found');
  });

  it('returns NO_DRIFT when base equals target', async () => {
    (prisma.repositorySnapshot.findUnique as jest.Mock)
      .mockResolvedValueOnce(baseSnapshot as any)
      .mockResolvedValueOnce(baseSnapshot as any);
    const result = await useCase.execute({
      projectId: 'proj-1',
      repositoryId: 'repo-1',
      baseSnapshotId: 'base-snap-id',
      targetSnapshotId: 'base-snap-id',
    });
    expect(result.status).toBe('NO_DRIFT');
    expect(result.summary.baseArtifactCount).toBe(0);
  });

  it('determines added, removed, and changed artifacts deterministically', async () => {
    (prisma.repositorySnapshot.findUnique as jest.Mock)
      .mockResolvedValueOnce(baseSnapshot as any)
      .mockResolvedValueOnce(targetSnapshot as any);

    (prisma.codeArtifact.findMany as jest.Mock)
      .mockResolvedValueOnce([
        { id: '1', artifactKey: 'unchanged', contentHash: 'hash-1' },
        { id: '2', artifactKey: 'changed', contentHash: 'hash-old' },
        { id: '3', artifactKey: 'removed', contentHash: 'hash-3' },
      ] as any)
      .mockResolvedValueOnce([
        { id: '1', artifactKey: 'unchanged', contentHash: 'hash-1' },
        { id: '2x', artifactKey: 'changed', contentHash: 'hash-new' },
        { id: '4', artifactKey: 'added', contentHash: 'hash-4' },
      ] as any);

    const result = await useCase.execute({
      projectId: 'proj-1',
      repositoryId: 'repo-1',
      baseSnapshotId: 'base-snap-id',
      targetSnapshotId: 'target-snap-id',
    });

    expect(result.status).toBe('DRIFTED');
    expect(result.summary.addedArtifactCount).toBe(1);
    expect(result.summary.removedArtifactCount).toBe(1);
    expect(result.summary.changedArtifactCount).toBe(1);
    expect(result.summary.unchangedArtifactCount).toBe(1);
    expect(result.summary.unknownChangedArtifactCount).toBe(0);
  });

  it('flags UNKNOWN when hashes are missing but no other drift exists', async () => {
    (prisma.repositorySnapshot.findUnique as jest.Mock)
      .mockResolvedValueOnce(baseSnapshot as any)
      .mockResolvedValueOnce(targetSnapshot as any);

    (prisma.codeArtifact.findMany as jest.Mock)
      .mockResolvedValueOnce([
        { id: '1', artifactKey: 'maybe-changed', contentHash: null },
      ] as any)
      .mockResolvedValueOnce([
        { id: '1x', artifactKey: 'maybe-changed', contentHash: null },
      ] as any);

    const result = await useCase.execute({
      projectId: 'proj-1',
      repositoryId: 'repo-1',
      baseSnapshotId: 'base-snap-id',
      targetSnapshotId: 'target-snap-id',
    });

    expect(result.status).toBe('UNKNOWN');
    expect(result.summary.changedArtifactCount).toBe(0);
    expect(result.summary.unchangedArtifactCount).toBe(0);
    expect(result.summary.unknownChangedArtifactCount).toBe(1);
    expect(result.summary.hashUnavailableArtifactCount).toBe(1);
  });

  it('flags INCOMPATIBLE when version changes and churn exceeds 80%', async () => {
    const base = { ...baseSnapshot, analyzerVersion: '0.1.0' };
    const target = { ...targetSnapshot, analyzerVersion: '0.2.0' };

    (prisma.repositorySnapshot.findUnique as jest.Mock)
      .mockResolvedValueOnce(base as any)
      .mockResolvedValueOnce(target as any);

    (prisma.codeArtifact.findMany as jest.Mock)
      .mockResolvedValueOnce([
        { id: '1', artifactKey: 'a1', contentHash: 'h1' },
        { id: '2', artifactKey: 'a2', contentHash: 'h2' },
        { id: '3', artifactKey: 'a3', contentHash: 'h3' },
      ] as any)
      .mockResolvedValueOnce([
        { id: '4', artifactKey: 'b1', contentHash: 'h4' },
        { id: '5', artifactKey: 'b2', contentHash: 'h5' },
        { id: '6', artifactKey: 'b3', contentHash: 'h6' },
      ] as any);

    const result = await useCase.execute({
      projectId: 'proj-1',
      repositoryId: 'repo-1',
      baseSnapshotId: 'base-snap-id',
      targetSnapshotId: 'target-snap-id',
    });

    expect(result.status).toBe('INCOMPATIBLE');
    expect(result.warnings.some(w => w.code === 'ANALYZER_VERSION_CHANGED')).toBe(true);
    expect(result.warnings.some(w => w.code === 'DRIFT_INCOMPATIBLE')).toBe(true);
  });

  it('compares scanner and analyzer versions from their distinct persisted sources', async () => {
    const base = {
      ...baseSnapshot,
      diagnostics: [{ code: 'SCAN_HEALTH', payload: { scannerVersion: 'scanner@0.3.0' } }],
    };
    const target = {
      ...targetSnapshot,
      diagnostics: [{ code: 'SCAN_HEALTH', payload: { scannerVersion: 'scanner@0.4.0' } }],
    };
    (prisma.repositorySnapshot.findUnique as jest.Mock)
      .mockResolvedValueOnce(base as any)
      .mockResolvedValueOnce(target as any);
    (prisma.codeArtifact.findMany as jest.Mock).mockResolvedValueOnce([]).mockResolvedValueOnce([]);

    const result = await useCase.execute({
      projectId: 'proj-1', repositoryId: 'repo-1', baseSnapshotId: 'base-snap-id', targetSnapshotId: 'target-snap-id',
    });

    expect(result.versionComparison).toEqual({
      baseScannerVersion: 'scanner@0.3.0',
      targetScannerVersion: 'scanner@0.4.0',
      baseAnalyzerVersion: '0.1.0',
      targetAnalyzerVersion: '0.1.0',
      scannerVersionChanged: true,
      analyzerVersionChanged: false,
    });
    expect(result.warnings.some(warning => warning.code === 'SCANNER_VERSION_CHANGED')).toBe(true);
    expect(result.warnings.some(warning => warning.code === 'ANALYZER_VERSION_CHANGED')).toBe(false);
  });

  it('marks high-churn comparisons incompatible when scanner versions differ', async () => {
    const base = {
      ...baseSnapshot,
      diagnostics: [{ code: 'SCAN_HEALTH', payload: { scannerVersion: 'scanner@0.3.0' } }],
    };
    const target = {
      ...targetSnapshot,
      diagnostics: [{ code: 'SCAN_HEALTH', payload: { scannerVersion: 'scanner@0.4.0' } }],
    };
    (prisma.repositorySnapshot.findUnique as jest.Mock)
      .mockResolvedValueOnce(base as any)
      .mockResolvedValueOnce(target as any);
    (prisma.codeArtifact.findMany as jest.Mock)
      .mockResolvedValueOnce([{ id: 'old', artifactKey: 'old-key', contentHash: 'old-hash' }] as any)
      .mockResolvedValueOnce([{ id: 'new', artifactKey: 'new-key', contentHash: 'new-hash' }] as any);

    const result = await useCase.execute({
      projectId: 'proj-1', repositoryId: 'repo-1', baseSnapshotId: 'base-snap-id', targetSnapshotId: 'target-snap-id',
    });

    expect(result.status).toBe('INCOMPATIBLE');
    expect(result.warnings.some(warning => warning.code === 'DRIFT_INCOMPATIBLE')).toBe(true);
  });

  it('bounds the combined sample payload and reports truncation', async () => {
    (prisma.repositorySnapshot.findUnique as jest.Mock)
      .mockResolvedValueOnce(baseSnapshot as any)
      .mockResolvedValueOnce(targetSnapshot as any);
    const baseArtifacts = Array.from({ length: 25 }, (_, index) => ({
      id: `base-${index}`, artifactKey: `removed-${index}`, contentHash: `hash-${index}`,
    }));
    (prisma.codeArtifact.findMany as jest.Mock)
      .mockResolvedValueOnce(baseArtifacts as any)
      .mockResolvedValueOnce([] as any);

    const result = await useCase.execute({
      projectId: 'proj-1', repositoryId: 'repo-1', baseSnapshotId: 'base-snap-id', targetSnapshotId: 'target-snap-id',
    });

    expect(result.samples.sampleLimit).toBe(10);
    expect(result.samples.samplesTruncated).toBe(true);
    expect(result.samples.removedArtifacts).toHaveLength(10);
    expect(result.summary.removedArtifactCount).toBe(25);
  });
});
