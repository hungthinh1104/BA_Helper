import { AppError } from '@ba-helper/shared';
import type {
  DriftStatus,
  DriftArtifactSample,
  DriftChangedArtifactSample,
  RepositorySnapshotDriftResponse,
} from '@ba-helper/contracts';
import { PrismaService } from "@ba-helper/backend-runtime";
import { readScannerVersion } from './scanner-version.reader';

const MAX_DRIFT_SAMPLE_ITEMS = 10;

export class GetRepositorySnapshotDriftUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(params: {
    projectId: string;
    repositoryId: string;
    baseSnapshotId: string;
    targetSnapshotId?: string;
  }): Promise<RepositorySnapshotDriftResponse> {
    const { projectId, repositoryId, baseSnapshotId } = params;

    const baseSnapshot = await this.prisma.repositorySnapshot.findUnique({
      where: { id: baseSnapshotId },
      include: { repository: true },
    });

    if (!baseSnapshot || baseSnapshot.repository.projectId !== projectId || baseSnapshot.repositoryId !== repositoryId) {
      throw new AppError('SNAPSHOT_NOT_FOUND', 'Base snapshot not found in this repository.');
    }

    let targetSnapshot;
    if (params.targetSnapshotId) {
      targetSnapshot = await this.prisma.repositorySnapshot.findUnique({
        where: { id: params.targetSnapshotId },
        include: { repository: true },
      });
      if (!targetSnapshot || targetSnapshot.repository.projectId !== projectId || targetSnapshot.repositoryId !== repositoryId) {
        throw new AppError('SNAPSHOT_NOT_FOUND', 'Target snapshot not found in this repository.');
      }
    } else {
      targetSnapshot = await this.prisma.repositorySnapshot.findFirst({
        where: {
          repositoryId,
          coverageStatus: { in: ['READY', 'PARTIAL'] },
        },
        orderBy: { createdAt: 'desc' },
        include: { repository: true },
      });

      if (!targetSnapshot) {
        throw new AppError('SNAPSHOT_NOT_FOUND', 'No suitable target snapshot found for comparison.');
      }
    }

    const targetSnapshotId = targetSnapshot.id;

    if (baseSnapshotId === targetSnapshotId) {
      return this.createEmptyResponse(params.projectId, repositoryId, baseSnapshotId, targetSnapshotId, baseSnapshot, targetSnapshot);
    }

    const baseArtifacts = await this.prisma.codeArtifact.findMany({
      where: { snapshotId: baseSnapshotId },
      select: {
        id: true,
        artifactKey: true,
        universalKind: true,
        artifactType: true,
        filePath: true,
        name: true,
        contentHash: true,
      },
    });

    const targetArtifacts = await this.prisma.codeArtifact.findMany({
      where: { snapshotId: targetSnapshotId },
      select: {
        id: true,
        artifactKey: true,
        universalKind: true,
        artifactType: true,
        filePath: true,
        name: true,
        contentHash: true,
      },
    });

    const baseMap = new Map(baseArtifacts.map(a => [a.artifactKey, a]));
    const targetMap = new Map(targetArtifacts.map(a => [a.artifactKey, a]));

    const added: DriftArtifactSample[] = [];
    const removed: DriftArtifactSample[] = [];
    const changed: DriftChangedArtifactSample[] = [];
    const unknownChanged: DriftArtifactSample[] = [];
    let unchangedCount = 0;
    let hashUnavailableCount = 0;

    for (const [key, targetArt] of targetMap.entries()) {
      const baseArt = baseMap.get(key);
      if (!baseArt) {
        added.push(this.mapSample(targetArt));
      } else {
        if (targetArt.contentHash == null || baseArt.contentHash == null) {
          unknownChanged.push(this.mapSample(targetArt));
          hashUnavailableCount++;
        } else if (targetArt.contentHash !== baseArt.contentHash) {
          changed.push({
            ...this.mapSample(targetArt),
            baseArtifactId: baseArt.id,
            targetArtifactId: targetArt.id,
            baseContentHash: baseArt.contentHash,
            targetContentHash: targetArt.contentHash,
          });
        } else {
          unchangedCount++;
        }
      }
    }

    for (const [key, baseArt] of baseMap.entries()) {
      if (!targetMap.has(key)) {
        removed.push(this.mapSample(baseArt));
      }
    }

    const baseScannerVersion = readScannerVersion(baseSnapshot.diagnostics);
    const targetScannerVersion = readScannerVersion(targetSnapshot.diagnostics);
    const scannerVersionChanged = !!baseScannerVersion && !!targetScannerVersion &&
      baseScannerVersion !== targetScannerVersion;
    const analyzerVersionChanged = baseSnapshot.analyzerVersion !== targetSnapshot.analyzerVersion;

    const baseArtifactCount = baseArtifacts.length;
    const targetArtifactCount = targetArtifacts.length;
    const addedArtifactCount = added.length;
    const removedArtifactCount = removed.length;
    const changedArtifactCount = changed.length;
    const unknownChangedArtifactCount = unknownChanged.length;

    let status: DriftStatus = 'NO_DRIFT';

    if (addedArtifactCount > 0 || removedArtifactCount > 0 || changedArtifactCount > 0) {
      status = 'DRIFTED';
    } else if (unknownChangedArtifactCount > 0) {
      status = 'UNKNOWN';
    }

    const churn = addedArtifactCount + removedArtifactCount + changedArtifactCount + unknownChangedArtifactCount;
    const maxArtifacts = Math.max(baseArtifactCount, targetArtifactCount);

    if ((scannerVersionChanged || analyzerVersionChanged) && maxArtifacts > 0 && churn > 0.8 * maxArtifacts) {
      status = 'INCOMPATIBLE';
    }

    const warnings: { code: string; message: string }[] = [];
    if (analyzerVersionChanged) {
      warnings.push({ code: 'ANALYZER_VERSION_CHANGED', message: 'Analyzer version changed between snapshots.' });
    }
    if (scannerVersionChanged) {
      warnings.push({ code: 'SCANNER_VERSION_CHANGED', message: 'Scanner version changed between snapshots.' });
    } else if (!baseScannerVersion || !targetScannerVersion) {
      warnings.push({ code: 'SCANNER_VERSION_UNAVAILABLE', message: 'Scanner version is unavailable for one or both snapshots.' });
    }
    if (hashUnavailableCount > 0) {
      warnings.push({ code: 'HASH_UNAVAILABLE', message: 'Some matched artifacts are missing content hashes.' });
    }
    if (status === 'INCOMPATIBLE') {
      warnings.push({ code: 'DRIFT_INCOMPATIBLE', message: 'Drift comparison is incompatible due to version churn.' });
    }

    const sortSamples = <T extends { universalKind?: string | null; filePath?: string | null; name?: string | null; artifactKey: string }>(arr: T[]) => {
      arr.sort((a, b) => {
        if (a.universalKind !== b.universalKind) return (a.universalKind || '').localeCompare(b.universalKind || '');
        if (a.filePath !== b.filePath) return (a.filePath || '').localeCompare(b.filePath || '');
        if (a.name !== b.name) return (a.name || '').localeCompare(b.name || '');
        return a.artifactKey.localeCompare(b.artifactKey);
      });
      return arr;
    };

    const sortedSamples = [sortSamples(added), sortSamples(removed), sortSamples(changed), sortSamples(unknownChanged)];
    const boundedSamples: Array<Array<DriftArtifactSample | DriftChangedArtifactSample>> = sortedSamples.map(() => []);
    let remainingSamples = MAX_DRIFT_SAMPLE_ITEMS;
    while (remainingSamples > 0 && sortedSamples.some((samples, index) => boundedSamples[index].length < samples.length)) {
      for (let index = 0; index < sortedSamples.length && remainingSamples > 0; index++) {
        const source = sortedSamples[index];
        if (boundedSamples[index].length >= source.length) continue;
        boundedSamples[index].push(source[boundedSamples[index].length]);
        remainingSamples--;
      }
    }
    const samplesTruncated = sortedSamples.some((samples, index) => boundedSamples[index].length < samples.length);
    const [addedSamples, removedSamples, changedSamples, unknownChangedSamples] = boundedSamples;

    return {
      projectId,
      repositoryId,
      baseSnapshotId,
      targetSnapshotId,
      status,
      summary: {
        baseArtifactCount,
        targetArtifactCount,
        addedArtifactCount,
        removedArtifactCount,
        changedArtifactCount,
        unchangedArtifactCount: unchangedCount,
        unknownChangedArtifactCount,
        hashUnavailableArtifactCount: hashUnavailableCount,
      },
      versionComparison: {
        baseScannerVersion: baseScannerVersion ?? null,
        targetScannerVersion: targetScannerVersion ?? null,
        baseAnalyzerVersion: baseSnapshot.analyzerVersion,
        targetAnalyzerVersion: targetSnapshot.analyzerVersion,
        scannerVersionChanged,
        analyzerVersionChanged,
      },
      coverageComparison: {
        baseCoverageStatus: baseSnapshot.coverageStatus,
        targetCoverageStatus: targetSnapshot.coverageStatus,
        coverageStatusChanged: baseSnapshot.coverageStatus !== targetSnapshot.coverageStatus,
      },
      samples: {
        addedArtifacts: addedSamples as DriftArtifactSample[],
        removedArtifacts: removedSamples as DriftArtifactSample[],
        changedArtifacts: changedSamples as DriftChangedArtifactSample[],
        unknownChangedArtifacts: unknownChangedSamples as DriftArtifactSample[],
        sampleLimit: MAX_DRIFT_SAMPLE_ITEMS,
        samplesTruncated,
      },
      warnings,
    };
  }

  private mapSample(a: any): DriftArtifactSample {
    return {
      artifactId: a.id,
      artifactKey: a.artifactKey,
      universalKind: a.universalKind,
      artifactType: a.artifactType,
      filePath: a.filePath,
      symbolName: a.name,
      displayName: a.name || a.artifactKey,
    };
  }

  private createEmptyResponse(projectId: string, repositoryId: string, baseSnapshotId: string, targetSnapshotId: string, baseSnapshot: any, targetSnapshot: any): RepositorySnapshotDriftResponse {
    const baseScannerVersion = readScannerVersion(baseSnapshot.diagnostics);
    const targetScannerVersion = readScannerVersion(targetSnapshot.diagnostics);
    const scannerVersionUnavailable = !baseScannerVersion || !targetScannerVersion;
    return {
      projectId,
      repositoryId,
      baseSnapshotId,
      targetSnapshotId,
      status: 'NO_DRIFT',
      summary: {
        baseArtifactCount: 0,
        targetArtifactCount: 0,
        addedArtifactCount: 0,
        removedArtifactCount: 0,
        changedArtifactCount: 0,
        unchangedArtifactCount: 0,
        unknownChangedArtifactCount: 0,
        hashUnavailableArtifactCount: 0,
      },
      versionComparison: {
        baseScannerVersion: baseScannerVersion ?? null,
        targetScannerVersion: targetScannerVersion ?? null,
        baseAnalyzerVersion: baseSnapshot.analyzerVersion,
        targetAnalyzerVersion: targetSnapshot.analyzerVersion,
        scannerVersionChanged: false,
        analyzerVersionChanged: false,
      },
      coverageComparison: {
        baseCoverageStatus: baseSnapshot.coverageStatus,
        targetCoverageStatus: targetSnapshot.coverageStatus,
        coverageStatusChanged: false,
      },
      samples: {
        addedArtifacts: [],
        removedArtifacts: [],
        changedArtifacts: [],
        unknownChangedArtifacts: [],
        sampleLimit: MAX_DRIFT_SAMPLE_ITEMS,
        samplesTruncated: false,
      },
      warnings: scannerVersionUnavailable ? [{
        code: 'SCANNER_VERSION_UNAVAILABLE',
        message: 'Scanner version is unavailable for one or both snapshots.',
      }] : [],
    };
  }
}
