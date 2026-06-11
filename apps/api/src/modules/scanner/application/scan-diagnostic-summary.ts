import { DiagnosticItem } from '@ba-helper/contracts';

type SeverityBucket = Record<'BLOCKER' | 'ERROR' | 'WARN' | 'INFO', number>;
type CategoryBucket = Partial<
  Record<'SECURITY' | 'LIMIT' | 'FRAMEWORK' | 'FILE_SYSTEM' | 'GIT' | 'SCANNER', number>
>;

export type ScanDiagnosticSummary = {
  total: number;
  bySeverity: SeverityBucket;
  byCategory: CategoryBucket;
  codes: string[];
};

export function summarizeDiagnostics(
  diagnostics: DiagnosticItem[],
): ScanDiagnosticSummary {
  const bySeverity: SeverityBucket = {
    BLOCKER: 0,
    ERROR: 0,
    WARN: 0,
    INFO: 0,
  };
  const byCategory: CategoryBucket = {};

  for (const diagnostic of diagnostics) {
    const weight = diagnostic.count ?? 1;
    bySeverity[diagnostic.severity] += weight;

    if (diagnostic.category) {
      byCategory[diagnostic.category] =
        (byCategory[diagnostic.category] ?? 0) + weight;
    }
  }

  return {
    total: diagnostics.length,
    bySeverity,
    byCategory,
    codes: diagnostics.map((diagnostic) => diagnostic.code),
  };
}
