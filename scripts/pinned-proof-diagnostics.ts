import type { DiagnosticItem } from '../packages/analyzer/src/scanner/core/diagnostic-collector';
import { DiagnosticCollector } from '../packages/analyzer/src/index';
import type { FileDiagnostic } from '../packages/analyzer/src/scanner/core/safe-file-enumerator';

const MAX_EXAMPLES = 20;

export type PinnedDiagnosticExample = {
  code: string;
  reason: string;
  sourcePath: string;
  sourceSymbol: string;
  startLine: number;
  endLine: number;
  targetExpression?: string;
};

export type PinnedDiagnosticSummary = {
  codeCounts: Array<[string, number]>;
  reasonCounts: Array<{ code: string; reason: string; count: number }>;
  examples: PinnedDiagnosticExample[];
};

export type PinnedScanDiagnosticSummary = PinnedDiagnosticSummary & {
  fileDiagnosticExamples: Array<{ code: string; severity: FileDiagnostic['severity']; filePath?: string }>;
};

export function summarizePinnedScanDiagnostics(
  diagnostics: readonly DiagnosticItem[], fileDiagnostics: readonly FileDiagnostic[],
  maxExamples = MAX_EXAMPLES,
): PinnedScanDiagnosticSummary {
  const collector = new DiagnosticCollector();
  for (const diagnostic of diagnostics) collector.add(diagnostic);
  for (const diagnostic of fileDiagnostics) collector.addFromFileDiagnostic(diagnostic, diagnostic.filePath);
  const fileDiagnosticExamples = fileDiagnostics.map(({ code, severity, filePath }) => ({
    code, severity, ...(filePath ? { filePath } : {}),
  })).sort((left, right) => compareText(left.code, right.code) ||
    compareText(left.filePath ?? '', right.filePath ?? '') || compareText(left.severity, right.severity))
    .slice(0, boundedLimit(maxExamples));
  return { ...summarizePinnedDiagnostics(collector.getItems(), maxExamples), fileDiagnosticExamples };
}

export function summarizePinnedDiagnostics(
  diagnostics: readonly DiagnosticItem[], maxExamples = MAX_EXAMPLES,
): PinnedDiagnosticSummary {
  const codeCounts = new Map<string, number>();
  const reasonCounts = new Map<string, { code: string; reason: string; count: number }>();
  const examples = new Map<string, PinnedDiagnosticExample>();

  for (const diagnostic of diagnostics) {
    const count = diagnostic.count ?? 1;
    const reason = stringValue(diagnostic.payload?.reason) ??
      stringValue(diagnostic.payload?.unsupportedPattern) ?? diagnostic.code;
    codeCounts.set(diagnostic.code, (codeCounts.get(diagnostic.code) ?? 0) + count);
    const reasonKey = JSON.stringify([diagnostic.code, reason]);
    const current = reasonCounts.get(reasonKey);
    reasonCounts.set(reasonKey, { code: diagnostic.code, reason, count: (current?.count ?? 0) + count });

    for (const sample of evidenceSamples(diagnostic.payload?.sampleEvidence)) {
      const example = { code: diagnostic.code, reason, ...sample };
      const exampleKey = JSON.stringify(example);
      if (examples.size < MAX_EXAMPLES * 10) examples.set(exampleKey, example);
    }
  }

  const orderedReasons = [...reasonCounts.values()].sort((left, right) =>
    compareText(left.code, right.code) || compareText(left.reason, right.reason));
  const orderedExamples = [...examples.values()].sort((left, right) =>
    compareText(left.code, right.code) || compareText(left.reason, right.reason) ||
    compareText(left.sourcePath, right.sourcePath) || left.startLine - right.startLine ||
    compareText(left.sourceSymbol, right.sourceSymbol) ||
    compareText(left.targetExpression ?? '', right.targetExpression ?? '')).slice(0, boundedLimit(maxExamples));

  return {
    codeCounts: [...codeCounts.entries()].sort(([left], [right]) => compareText(left, right)),
    reasonCounts: orderedReasons,
    examples: orderedExamples,
  };
}

function evidenceSamples(value: unknown): Array<Omit<PinnedDiagnosticExample, 'code' | 'reason'>> {
  if (!Array.isArray(value)) return [];
  return value.flatMap(item => {
    if (!item || typeof item !== 'object') return [];
    const sample = item as Record<string, unknown>;
    if (typeof sample.sourcePath !== 'string' || typeof sample.sourceSymbol !== 'string' ||
      typeof sample.startLine !== 'number' || typeof sample.endLine !== 'number') return [];
    return [{ sourcePath: sample.sourcePath, sourceSymbol: sample.sourceSymbol,
      startLine: sample.startLine, endLine: sample.endLine,
      ...(typeof sample.targetExpression === 'string' ? { targetExpression: sample.targetExpression } : {}) }];
  });
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function boundedLimit(value: number): number {
  return Number.isFinite(value) ? Math.min(MAX_EXAMPLES, Math.max(0, Math.floor(value))) : MAX_EXAMPLES;
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
