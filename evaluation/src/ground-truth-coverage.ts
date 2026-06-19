import type { PrismaService } from '../../apps/api/src/modules/prisma/prisma.service';

export type GroundTruthCoverageStatus =
  | 'OK'
  | 'GROUND_TRUTH_NOT_INDEXED'
  | 'UNKNOWN';

export type GroundTruthCoverageResult = {
  status: GroundTruthCoverageStatus;
  indexedGroundTruthFiles: string[];
  missingIndexedGroundTruthFiles: string[];
};

export function evaluateGroundTruthArtifactCoverage(params: {
  groundTruthFiles: readonly string[];
  indexedArtifactFilePaths?: readonly string[] | null;
}): GroundTruthCoverageResult {
  if (!params.indexedArtifactFilePaths) {
    return {
      status: 'UNKNOWN',
      indexedGroundTruthFiles: [],
      missingIndexedGroundTruthFiles: [...params.groundTruthFiles],
    };
  }

  const indexedPaths = new Set(params.indexedArtifactFilePaths);
  const indexedGroundTruthFiles = params.groundTruthFiles.filter((filePath) =>
    indexedPaths.has(filePath),
  );
  const missingIndexedGroundTruthFiles = params.groundTruthFiles.filter(
    (filePath) => !indexedPaths.has(filePath),
  );

  return {
    status:
      missingIndexedGroundTruthFiles.length === 0
        ? 'OK'
        : 'GROUND_TRUTH_NOT_INDEXED',
    indexedGroundTruthFiles,
    missingIndexedGroundTruthFiles,
  };
}

export async function readGroundTruthArtifactCoverage(params: {
  prisma: PrismaService;
  snapshotId: string;
  groundTruthFiles: readonly string[];
}): Promise<GroundTruthCoverageResult> {
  const rows = await params.prisma.codeArtifact.findMany({
    where: {
      snapshotId: params.snapshotId,
      filePath: { in: [...params.groundTruthFiles] },
    },
    select: {
      filePath: true,
    },
  });

  return evaluateGroundTruthArtifactCoverage({
    groundTruthFiles: params.groundTruthFiles,
    indexedArtifactFilePaths: rows.map((row) => row.filePath),
  });
}
