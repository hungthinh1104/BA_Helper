export type ReportScanHealth = {
  coverageStatus?: string;
  scannerVersion?: string;
  analyzerVersion?: string;
  scannedFileCount?: number;
  skippedFileCount?: number;
  artifactCount?: number;
  skippedSummary?: Record<string, number>;
};

export function parseScanHealthPayload(payload: unknown): ReportScanHealth | null {
  if (!payload || typeof payload !== 'object') return null;
  const p = payload as Record<string, unknown>;

  const scanHealth: ReportScanHealth = {};

  if (typeof p.coverageStatus === 'string') scanHealth.coverageStatus = p.coverageStatus;
  if (typeof p.scannerVersion === 'string') scanHealth.scannerVersion = p.scannerVersion;
  if (typeof p.analyzerVersion === 'string') scanHealth.analyzerVersion = p.analyzerVersion;
  if (typeof p.scannedFileCount === 'number') scanHealth.scannedFileCount = p.scannedFileCount;
  if (typeof p.skippedFileCount === 'number') scanHealth.skippedFileCount = p.skippedFileCount;
  if (typeof p.artifactCount === 'number') scanHealth.artifactCount = p.artifactCount;
  
  if (p.skippedSummary && typeof p.skippedSummary === 'object') {
    scanHealth.skippedSummary = p.skippedSummary as Record<string, number>;
  }

  return scanHealth;
}

const HUMAN_READABLE_REASONS: Record<string, string> = {
  IGNORED_DIRECTORY: "Ignored directories",
  UNSUPPORTED_EXTENSION: "Unsupported file types",
  GENERATED_FILE: "Generated files",
  VENDOR_FILE: "Vendor dependencies",
  BUILD_OUTPUT: "Build outputs",
  FILE_TOO_LARGE: "Files too large",
  REPO_FILE_LIMIT_EXCEEDED: "Repository file limit hit",
  REPO_SIZE_LIMIT_EXCEEDED: "Repository size limit hit",
  SYMLINK_OUTSIDE_ROOT: "Unsafe symlinks",
  BINARY_FILE: "Binary files",
  READ_ERROR: "File read errors",
  UNSUPPORTED_FRAMEWORK: "Unsupported frameworks",
  UNSUPPORTED_LANGUAGE: "Unsupported languages",
};

export function formatSkipReason(reason: string): string {
  return HUMAN_READABLE_REASONS[reason] || reason;
}
