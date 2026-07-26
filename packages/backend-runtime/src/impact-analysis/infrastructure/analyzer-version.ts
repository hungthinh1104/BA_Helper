import { ANALYZER_VERSION } from '@ba-helper/analyzer';

export function isAnalyzerVersionOutdated(snapshotAnalyzerVersion: string): boolean {
  return snapshotAnalyzerVersion !== ANALYZER_VERSION;
}

export function getCurrentAnalyzerVersion(): string {
  return ANALYZER_VERSION;
}
