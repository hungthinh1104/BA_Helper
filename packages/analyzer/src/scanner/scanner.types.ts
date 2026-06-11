export const SCANNER_VERSION = 'scanner@0.3.0';
export const ANALYZER_VERSION = 'analyzer@0.3.0';

export type ScanInput = {
  fixturePath: string;
  analyzerVersion?: string; // Kept for backwards compat, though we use constant internally
};

export type ScanArtifact = {
  stableId: string;
  type: string;
  filePath: string;
  symbolName: string;
  startLine: number;
  endLine: number;
  excerpt: string;
  contentHash?: string | null;
};

export type ScanSkipReason =
  | 'IGNORED_DIRECTORY'
  | 'UNSUPPORTED_EXTENSION'
  | 'GENERATED_FILE'
  | 'VENDOR_FILE'
  | 'BUILD_OUTPUT'
  | 'FILE_TOO_LARGE'
  | 'REPO_FILE_LIMIT_EXCEEDED'
  | 'REPO_SIZE_LIMIT_EXCEEDED'
  | 'SYMLINK_OUTSIDE_ROOT'
  | 'BINARY_FILE'
  | 'READ_ERROR'
  | 'UNSUPPORTED_FRAMEWORK'
  | 'UNSUPPORTED_LANGUAGE';

export type ScanCoverageStatus = 'FULL' | 'PARTIAL' | 'FAILED';

export type ScanCoverage = {
  status: ScanCoverageStatus;
  skippedFiles: Array<{ path: string; reason: ScanSkipReason }>;
  skippedSummary: Record<ScanSkipReason, number>;
  limits: {
    maxFiles: number;
    maxFileBytes: number;
    maxTotalBytes?: number;
  };
  limitHits: {
    fileLimitHit: boolean;
    repoSizeLimitHit: boolean;
  };
};

export type ScanHealthDiagnostics = {
  coverageStatus: ScanCoverageStatus;
  scannerVersion: string;
  analyzerVersion: string;
  scannedFileCount: number;
  skippedFileCount: number;
  artifactCount: number;
  skippedSummary: Record<ScanSkipReason, number>;
  skippedFilesSample: Array<{ path: string; reason: ScanSkipReason }>;
  limits: {
    maxFiles: number;
    maxFileBytes: number;
    maxTotalBytes?: number;
  };
  limitHits: {
    fileLimitHit: boolean;
    repoSizeLimitHit: boolean;
  };
};

export type RepositoryProfileDomain =
  | 'BOOKING'
  | 'PAYMENT'
  | 'REFUND'
  | 'NOTIFICATION'
  | 'INVENTORY'
  | 'CUSTOM'
  | 'UNKNOWN';

export type RepositoryProfileLanguage = 'TYPESCRIPT' | 'UNKNOWN';

export type RepositoryProfileFramework =
  | 'NESTJS'
  | 'SPRING_BOOT'
  | 'GENERIC_TYPESCRIPT'
  | 'UNKNOWN';

export type RepositoryProfileArchitectureStyle =
  | 'MODULAR_MONOLITH'
  | 'LAYERED'
  | 'UNKNOWN';

export type RepositoryProfileDiagnostics = {
  detectedMarkers?: string[];
  confidence?: number;
  unsupportedReason?: string;
};

export type DetectedRepositoryProfile = {
  domain: RepositoryProfileDomain;
  language: RepositoryProfileLanguage;
  framework: RepositoryProfileFramework;
  architectureStyle: RepositoryProfileArchitectureStyle;
  sourceRoots: string[];
  testRoots: string[];
  diagnostics?: RepositoryProfileDiagnostics;
  profileVersion: string;
};

export type ScanResult = {
  analyzerVersion: string;
  artifacts: ScanArtifact[];
  coverage: ScanCoverage;
  sourceRoot?: string;
};
