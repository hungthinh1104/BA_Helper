export type ScanInput = {
  fixturePath: string;
  analyzerVersion: string;
};

export type ScanArtifact = {
  stableId: string;
  type: string;
  filePath: string;
  symbolName: string;
  startLine: number;
  endLine: number;
  excerpt: string;
};

export type ScanCoverage = {
  status: 'READY' | 'PARTIAL';
  skippedFiles: string[];
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
