import { createHash } from 'node:crypto';
import type { CodeArtifact, DependencyEdgeType } from '@prisma/client';
import type {
  ScanArtifact,
  ScanHealthDiagnostics,
  ScanResult,
} from '@ba-helper/analyzer';
import { SecretRedactor } from '@ba-helper/analyzer';
import { AppError } from '@ba-helper/shared';
import type { DiagnosticItem } from '@ba-helper/contracts';
import type { EvidenceRepository } from '../../evidence/infrastructure/evidence.repository';
import { IncrementalScanClassifier } from './incremental-scan-classifier';

export type DiagnosticCollectorLike = {
  add(item: DiagnosticItem): void;
  addSecretRedacted(relativePath: string): void;
  getItems(): DiagnosticItem[];
};

export type PersistedArtifactRef = {
  id: string;
  artifactKey: string;
};

const REQUIRED_SCAN_DIAGNOSTIC_CODES = [
  'SCAN_HEALTH',
  'SCANNER_CAPABILITY_SUMMARY',
  'INCREMENTAL_SCAN_SUMMARY',
  'EMBEDDING_REUSE_PLAN',
] as const;

export function addScanHealthDiagnostic(params: {
  scanResult: ScanResult;
  collector: DiagnosticCollectorLike;
}): void {
  const scanHealth: ScanHealthDiagnostics = {
    coverageStatus: params.scanResult.coverage.status,
    scannerVersion: 'scanner@0.2.0',
    analyzerVersion: params.scanResult.analyzerVersion,
    scannedFileCount: params.scanResult.artifacts.length,
    skippedFileCount: Object.values(params.scanResult.coverage?.skippedSummary || {})
      .reduce((a, b) => a + b, 0),
    artifactCount: params.scanResult.artifacts.length,
    skippedSummary: params.scanResult.coverage?.skippedSummary || {},
    skippedFilesSample: params.scanResult.coverage?.skippedFiles || [],
    limits: params.scanResult.coverage?.limits || { maxFiles: 0, maxFileSize: 0 },
    limitHits: params.scanResult.coverage?.limitHits || [],
  };

  params.collector.add({
    code: 'SCAN_HEALTH',
    severity: 'INFO',
    message: 'Scan health summary generated',
    category: 'SCANNER',
    payload: scanHealth as unknown as Record<string, unknown>,
  });
}

export function addIncrementalDiagnostics(params: {
  snapshotId: string;
  previousSnapshot: { id: string; analyzerVersion: string } | null;
  previousArtifacts: CodeArtifact[];
  scanResult: ScanResult;
  collector: DiagnosticCollectorLike;
}): void {
  const { scanSummary, reusePlan } = IncrementalScanClassifier.generateDiagnostics({
    targetSnapshotId: params.snapshotId,
    currentArtifacts: params.scanResult.artifacts,
    currentAnalyzerVersion: params.scanResult.analyzerVersion,
    previousSnapshot: params.previousSnapshot
      ? {
          id: params.previousSnapshot.id,
          analyzerVersion: params.previousSnapshot.analyzerVersion,
        }
      : null,
    previousArtifacts: params.previousArtifacts,
  });

  params.collector.add({
    code: 'INCREMENTAL_SCAN_SUMMARY',
    severity: 'INFO',
    message: 'Incremental scan classification summary generated',
    category: 'SCANNER',
    payload: scanSummary as unknown as Record<string, unknown>,
  });

  params.collector.add({
    code: 'EMBEDDING_REUSE_PLAN',
    severity: 'INFO',
    message: 'Embedding chunk reuse plan generated',
    category: 'SCANNER',
    payload: reusePlan as unknown as Record<string, unknown>,
  });
}

export function buildEvidenceInputs(params: {
  snapshotId: string;
  artifacts: ScanArtifact[];
  persistedArtifacts: PersistedArtifactRef[];
  collector: DiagnosticCollectorLike;
}): Parameters<EvidenceRepository['upsertMany']>[0] {
  const persistedArtifactByKey = new Map(
    params.persistedArtifacts.map((artifact) => [artifact.artifactKey, artifact.id]),
  );

  return params.artifacts
    .map((artifact) => {
      const persistedId = persistedArtifactByKey.get(artifact.stableId);
      if (!persistedId) return null;

      const redaction = SecretRedactor.redact(artifact.excerpt || '');
      const excerpt = redaction.redactedContent;
      const contentHash = createHash('sha256').update(excerpt).digest('hex');

      if (redaction.foundSecrets) {
        params.collector.addSecretRedacted('source files');
      }

      return {
        provenanceKey: `snapshot:${params.snapshotId}:artifact:${artifact.stableId}`,
        sourceType: artifact.type === 'TEST' ? 'TEST' : 'CODE',
        snapshotId: params.snapshotId,
        artifactId: persistedId,
        sourcePath: artifact.filePath,
        startLine: artifact.startLine,
        endLine: artifact.endLine,
        excerpt,
        contentHash,
        isRedacted: redaction.foundSecrets,
        redactionMetadata: null,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);
}

export function buildDependencyEdges(
  snapshotId: string,
  dependencyEdges: NonNullable<ScanResult['dependencyEdges']>,
  artifactIdByStableId: Map<string, string>,
): {
  edgesToPersist: {
    snapshotId: string;
    fromArtifactId: string;
    toArtifactId: string;
    type: DependencyEdgeType;
  }[];
  droppedEdgeCount: number;
} {
  const edgesToPersist: {
    snapshotId: string;
    fromArtifactId: string;
    toArtifactId: string;
    type: DependencyEdgeType;
  }[] = [];
  let droppedEdgeCount = 0;

  for (const edge of dependencyEdges) {
    const mappedType = mapScannerEdgeType(edge.type);
    if (!mappedType) {
      droppedEdgeCount++;
      continue;
    }

    const fromId = artifactIdByStableId.get(edge.fromArtifactId);
    const toId = artifactIdByStableId.get(edge.toArtifactId);
    if (!fromId || !toId) {
      droppedEdgeCount++;
      continue;
    }

    edgesToPersist.push({
      snapshotId,
      fromArtifactId: fromId,
      toArtifactId: toId,
      type: mappedType,
    });
  }

  return { edgesToPersist, droppedEdgeCount };
}

export function assertRequiredDiagnostics(items: DiagnosticItem[]): void {
  const presentCodes = new Set(items.map((d) => d.code));
  const missing = REQUIRED_SCAN_DIAGNOSTIC_CODES.filter((code) => !presentCodes.has(code));
  if (missing.length > 0) {
    throw new AppError(
      'SNAPSHOT_DIAGNOSTICS_INCOMPLETE',
      `Required scan diagnostics missing before finalization: ${missing.join(', ')}`,
    );
  }
}

function mapScannerEdgeType(type: string): DependencyEdgeType | null {
  switch (type) {
    case 'CALLS':
      return 'CALLS';
    case 'IMPORTS':
      return 'IMPORTS';
    case 'TESTS':
      return 'TESTS';
    case 'USES':
    case 'REFERENCES':
      return 'REFERENCES';
    default:
      return null;
  }
}
