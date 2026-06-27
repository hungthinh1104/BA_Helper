import { Injectable, Logger } from '@nestjs/common';
import { Prisma, ScanJobStage, ScanJobStatus } from '@prisma/client';
import type {
  DetectedRepositoryProfile,
  ScanArtifact,
  ScanResult,
} from '@ba-helper/analyzer';
import type { DiagnosticItem } from '@ba-helper/contracts';
import { ArtifactRepository } from '../../artifact/infrastructure/artifact.repository';
import { normalizeArtifactKind } from '../../artifact/domain/universal-artifact-kind';
import { EvidenceRepository } from '../../evidence/infrastructure/evidence.repository';
import { GraphRepository } from '../../graph/infrastructure/graph.repository';
import { PrismaService } from '../../prisma/prisma.service';
import { ScanJobRepository } from '../infrastructure/scan-job.repository';
import {
  addIncrementalDiagnostics,
  addScanHealthDiagnostic,
  assertRequiredDiagnostics,
  buildDependencyEdges,
  buildEvidenceInputs,
  type DiagnosticCollectorLike,
  type PersistedArtifactRef,
} from './scan-persistence-mappers';

type ScanJobForPersistence = {
  id: string;
  repositoryId: string;
  requestedRef: string | null;
};

type PersistScanOutputParams = {
  job: ScanJobForPersistence;
  commitSha: string;
  scanResult: ScanResult;
  repositoryProfile: DetectedRepositoryProfile | null;
  collector: DiagnosticCollectorLike;
};

export type PersistedScanOutput = {
  snapshotId: string;
  sourceTargetId: string;
  coverageStatus: 'READY' | 'PARTIAL';
  artifactCount: number;
  evidenceCount: number;
  dependencyEdgeCount: number;
  skippedDependencyEdgeCount: number;
  diagnostics: DiagnosticItem[];
  shouldEnqueueEmbedding: boolean;
};

@Injectable()
export class RunScanJobPersistenceStep {
  private readonly logger = new Logger(RunScanJobPersistenceStep.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly artifactRepository: ArtifactRepository,
    private readonly graphRepository: GraphRepository,
    private readonly evidenceRepo: EvidenceRepository,
    private readonly scanJobRepository: ScanJobRepository,
  ) {}

  async persist(params: PersistScanOutputParams): Promise<PersistedScanOutput> {
    return this.prisma.$transaction(async (tx) => this.persistInTransaction(params, tx));
  }

  private async persistInTransaction(
    params: PersistScanOutputParams,
    tx: Prisma.TransactionClient,
  ): Promise<PersistedScanOutput> {
    const coverageStatus = params.scanResult.coverage.status === 'FULL' ? 'READY' : 'PARTIAL';

    addScanHealthDiagnostic({
      scanResult: params.scanResult,
      collector: params.collector,
    });

    const previousSnapshot = await tx.repositorySnapshot.findFirst({
      where: {
        repositoryId: params.job.repositoryId,
        coverageStatus: { in: ['READY', 'PARTIAL'] },
      },
      orderBy: [
        { createdAt: 'desc' },
        { id: 'desc' },
      ],
    });

    const snapshot = await tx.repositorySnapshot.upsert({
      where: {
        repositoryId_commitSha_analyzerVersion: {
          repositoryId: params.job.repositoryId,
          commitSha: params.commitSha,
          analyzerVersion: params.scanResult.analyzerVersion,
        },
      },
      create: {
        repositoryId: params.job.repositoryId,
        commitSha: params.commitSha,
        analyzerVersion: params.scanResult.analyzerVersion,
        coverageStatus,
        diagnostics: [] as unknown as Prisma.InputJsonValue,
      },
      update: {
        coverageStatus,
        diagnostics: [] as unknown as Prisma.InputJsonValue,
      },
    });

    const previousArtifacts = previousSnapshot
      ? await this.artifactRepository.listBySnapshot(previousSnapshot.id, tx)
      : [];
    addIncrementalDiagnostics({
      snapshotId: snapshot.id,
      previousSnapshot,
      previousArtifacts,
      scanResult: params.scanResult,
      collector: params.collector,
    });

    const target = await tx.repositoryTarget.upsert({
      where: {
        repositoryId_targetKey: {
          repositoryId: params.job.repositoryId,
          targetKey: params.job.requestedRef ?? 'main',
        },
      },
      create: {
        repositoryId: params.job.repositoryId,
        targetKey: params.job.requestedRef ?? 'main',
        requestedRef: params.job.requestedRef ?? 'main',
        resolvedRefType: 'BRANCH',
        latestObservedCommitSha: params.commitSha,
        lastObservedAt: new Date(),
      },
      update: {
        latestObservedCommitSha: params.commitSha,
        lastObservedAt: new Date(),
      },
    });

    await this.persistProfile(snapshot.id, params.repositoryProfile, tx);

    const persistedArtifacts = await this.persistArtifacts(
      snapshot.id,
      params.scanResult.artifacts,
      tx,
    );
    const artifactIdByStableId = new Map(
      persistedArtifacts.map((artifact) => [artifact.artifactKey, artifact.id]),
    );

    const evidenceInputs = buildEvidenceInputs({
      snapshotId: snapshot.id,
      artifacts: params.scanResult.artifacts,
      persistedArtifacts,
      collector: params.collector,
    });
    const { edgesToPersist, droppedEdgeCount } = buildDependencyEdges(
      snapshot.id,
      params.scanResult.dependencyEdges ?? [],
      artifactIdByStableId,
    );

    if (droppedEdgeCount > 0) {
      this.logger.debug(`Dropped ${droppedEdgeCount} unresolved or unsupported dependency edges.`);
    }

    await this.graphRepository.createDependencyEdges(edgesToPersist, tx);
    await this.evidenceRepo.upsertMany(evidenceInputs, tx);

    const finalDiagnostics = params.collector.getItems() as DiagnosticItem[];
    assertRequiredDiagnostics(finalDiagnostics);

    await tx.repositorySnapshot.update({
      where: { id: snapshot.id },
      data: {
        diagnostics: finalDiagnostics as unknown as Prisma.InputJsonValue,
        ...(params.scanResult.artifacts.length > 0 ? { indexStatus: 'LEXICAL_READY' } : {}),
      },
    });

    await tx.scanJob.update({
      where: { id: params.job.id },
      data: {
        snapshotId: snapshot.id,
        sourceTargetId: target.id,
      },
    });

    await this.scanJobRepository.updateState({
      jobId: params.job.id,
      status: ScanJobStatus.COMPLETED,
      stage: ScanJobStage.DONE,
      progress: 100,
    }, tx);

    return {
      snapshotId: snapshot.id,
      sourceTargetId: target.id,
      coverageStatus,
      artifactCount: params.scanResult.artifacts.length,
      evidenceCount: evidenceInputs.length,
      dependencyEdgeCount: edgesToPersist.length,
      skippedDependencyEdgeCount: droppedEdgeCount,
      diagnostics: finalDiagnostics,
      shouldEnqueueEmbedding: params.scanResult.artifacts.length > 0,
    };
  }

  private async persistProfile(
    snapshotId: string,
    repositoryProfile: DetectedRepositoryProfile | null,
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    if (!repositoryProfile) {
      return;
    }

    await tx.repositoryProfile.upsert({
      where: { snapshotId },
      create: {
        snapshotId,
        domain: repositoryProfile.domain,
        language: repositoryProfile.language,
        framework: repositoryProfile.framework,
        architectureStyle: repositoryProfile.architectureStyle,
        sourceRoots: repositoryProfile.sourceRoots as unknown as Prisma.InputJsonValue,
        testRoots: repositoryProfile.testRoots as unknown as Prisma.InputJsonValue,
        diagnostics: repositoryProfile.diagnostics
          ? (repositoryProfile.diagnostics as unknown as Prisma.InputJsonValue)
          : undefined,
        profileVersion: repositoryProfile.profileVersion,
      },
      update: {
        domain: repositoryProfile.domain,
        language: repositoryProfile.language,
        framework: repositoryProfile.framework,
        architectureStyle: repositoryProfile.architectureStyle,
        sourceRoots: repositoryProfile.sourceRoots as unknown as Prisma.InputJsonValue,
        testRoots: repositoryProfile.testRoots as unknown as Prisma.InputJsonValue,
        diagnostics: repositoryProfile.diagnostics
          ? (repositoryProfile.diagnostics as unknown as Prisma.InputJsonValue)
          : undefined,
        profileVersion: repositoryProfile.profileVersion,
      },
    });
  }

  private async persistArtifacts(
    snapshotId: string,
    artifacts: ScanArtifact[],
    tx: Prisma.TransactionClient,
  ): Promise<PersistedArtifactRef[]> {
    if (artifacts.length === 0) {
      return [];
    }

    await this.artifactRepository.createMany(
      artifacts.map((artifact) => ({
        snapshotId,
        artifactKey: artifact.stableId,
        artifactType: artifact.type,
        universalKind: normalizeArtifactKind(artifact.type),
        name: artifact.symbolName,
        filePath: artifact.filePath,
        startLine: artifact.startLine,
        endLine: artifact.endLine,
        contentHash: artifact.contentHash,
      })),
      tx,
    );

    return this.artifactRepository.listBySnapshot(snapshotId, tx);
  }
}
