import { AppError } from '@ba-helper/shared';
import { PrismaService } from '../../prisma/prisma.service';
import {
  DriftStatus,
  DriftArtifactSample,
  DriftChangedArtifactSample,
  RepositorySnapshotDriftResponse,
} from '@ba-helper/contracts';

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

    const scannerVersionChanged = baseSnapshot.analyzerVersion !== targetSnapshot.analyzerVersion; // Actually scanner uses analyzerVersion field here? Wait, the schema has analyzerVersion but not scannerVersion.
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

    if (analyzerVersionChanged && maxArtifacts > 0 && churn > 0.8 * maxArtifacts) {
      status = 'INCOMPATIBLE';
    }

    const warnings: { code: string; message: string }[] = [];
    if (scannerVersionChanged) {
      // Since schema doesn't have scannerVersion, we use analyzerVersion for now.
      warnings.push({ code: 'ANALYZER_VERSION_CHANGED', message: 'Analyzer version changed between snapshots.' });
    }
    if (hashUnavailableCount > 0) {
      warnings.push({ code: 'HASH_UNAVAILABLE', message: 'Some matched artifacts are missing content hashes.' });
    }
    if (status === 'INCOMPATIBLE') {
      warnings.push({ code: 'DRIFT_INCOMPATIBLE', message: 'Drift comparison is incompatible due to version churn.' });
    }

    const sortSamples = (arr: any[]) => {
      arr.sort((a, b) => {
        if (a.universalKind !== b.universalKind) return (a.universalKind || '').localeCompare(b.universalKind || '');
        if (a.filePath !== b.filePath) return (a.filePath || '').localeCompare(b.filePath || '');
        if (a.name !== b.name) return (a.name || '').localeCompare(b.name || '');
        return a.artifactKey.localeCompare(b.artifactKey);
      });
      return arr.slice(0, 50);
    };

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
        addedArtifacts: sortSamples(added),
        removedArtifacts: sortSamples(removed),
        changedArtifacts: sortSamples(changed),
        unknownChangedArtifacts: sortSamples(unknownChanged),
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
      },
      warnings: [],
    };
  }
}
