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
};

export type ScanCoverage = {
  status: 'READY' | 'PARTIAL';
  skippedFiles: string[];
};

export type ScanResult = {
  analyzerVersion: string;
  artifacts: ScanArtifact[];
  coverage: ScanCoverage;
  sourceRoot?: string;
};
