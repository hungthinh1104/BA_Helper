import { existsSync } from 'node:fs';
import path from 'node:path';
import type { ChangeClassification } from './classification';
import type { ChangedPath, RelatedTestSelection } from './types';

const CAPABILITY_FALLBACKS: Record<string, string[]> = {
  analysis: ['apps/api/test/e2e/analysis-flow.e2e-spec.ts', 'apps/api/test/e2e/impact-analysis-workspace.e2e-spec.ts'],
  artifact: ['apps/api/test/e2e/artifact-discovery.e2e-spec.ts', 'apps/api/test/e2e/evidence-artifact-snapshot-scope.e2e-spec.ts'],
  auth: ['apps/api/test/e2e/auth-rbac.e2e-spec.ts', 'apps/api/test/e2e/route-authentication-matrix.e2e-spec.ts'],
  document: ['apps/api/test/e2e/document-job-startup-recovery.e2e-spec.ts', 'apps/api/test/e2e/final-reviewed-report.audit-flow.e2e-spec.ts'],
  evidence: ['apps/api/test/e2e/evidence-artifact-snapshot-scope.e2e-spec.ts', 'apps/api/test/e2e/retrieval-provider-redaction.e2e-spec.ts'],
  graph: ['apps/api/test/e2e/code-comprehension.e2e-spec.ts', 'apps/api/test/e2e/matrix-drilldown.e2e-spec.ts'],
  impact: ['apps/api/test/e2e/impact-analysis-workspace.e2e-spec.ts', 'apps/api/test/e2e/impact-diff.e2e-spec.ts'],
  queue: ['apps/api/test/e2e/worker-process-recovery.e2e-spec.ts', 'apps/api/test/e2e/redis-outage-recovery.e2e-spec.ts'],
  repository: ['apps/api/test/e2e/scan-job-repository-scope.e2e-spec.ts', 'apps/api/test/e2e/artifact-discovery.e2e-spec.ts'],
  review: ['apps/api/test/e2e/review-decision.e2e-spec.ts', 'apps/api/test/e2e/review-item-decision.e2e-spec.ts'],
  scan: ['apps/api/test/e2e/scan-job-enqueue-recovery.e2e-spec.ts', 'apps/api/test/e2e/secure-ingestion-diagnostics.e2e-spec.ts'],
  scanner: ['apps/api/test/e2e/scan-job-repository-scope.e2e-spec.ts', 'apps/api/test/e2e/secure-ingestion-diagnostics.e2e-spec.ts'],
  traceability: ['apps/api/test/e2e/code-comprehension.e2e-spec.ts', 'apps/api/test/e2e/matrix-drilldown.e2e-spec.ts'],
};

export function relatedSelections(root: string, classification: ChangeClassification, changes: ChangedPath[]): RelatedTestSelection[] {
  const candidates = classification.executablePaths.filter((file) => /\.[cm]?[jt]sx?$/.test(file));
  const sourceFiles = candidates.filter((file) => existsSync(path.join(root, file)));
  const selections: RelatedTestSelection[] = [];
  const rootCandidates = candidates.filter((file) => !isE2e(file) && !isWeb(file) && !isAnalyzer(file));
  const rootFiles = sourceFiles.filter((file) => !isE2e(file) && !isWeb(file) && !isAnalyzer(file));
  if (rootCandidates.length > 0 && !classification.areas.has('contracts') && !classification.areas.has('prisma')) {
    selections.push({
      id: 'related-backend', config: 'jest.config.ts', sourceFiles: rootFiles,
      fallbackFiles: capabilityFallbacks(root, changes),
      fallbackConfig: 'jest.e2e.config.ts', fallbackRequires: ['test-targets'],
      reason: 'Native Jest dependency discovery for backend and shared packages.',
    });
  }
  const analyzerCandidates = candidates.filter(isAnalyzer);
  const analyzerFiles = sourceFiles.filter(isAnalyzer);
  if (analyzerCandidates.length > 0) {
    selections.push({
      id: 'related-analyzer', config: 'jest.analyzer.config.ts', sourceFiles: analyzerFiles,
      fallbackFiles: ['packages/analyzer/tests/scanner/capability-matrix.spec.ts'],
      fallbackConfig: 'jest.analyzer.config.ts',
      reason: 'Native analyzer Jest discovery; analyzer-wide gates are added for AFFECTED.',
    });
  }
  const webCandidates = candidates.filter(isWeb);
  const webFiles = sourceFiles.filter(isWeb);
  if (webCandidates.length > 0) {
    selections.push({
      id: 'related-web', config: 'jest.config.ts', sourceFiles: webFiles.map((file) => path.posix.relative('apps/web', file)),
      fallbackFiles: ['src/app/(app)/repositories/[repositoryId]/_components/code-evidence-navigator.integration.test.tsx'],
      fallbackConfig: 'jest.config.ts',
      cwd: path.join(root, 'apps/web'),
      reason: 'Native Next/Jest dependency discovery for web source changes.',
    });
  }
  return selections;
}

export function capabilityFallbacks(root: string, changes: ChangedPath[]): string[] {
  const hits = new Set<string>();
  for (const change of changes) {
    const segments = change.path.toLowerCase().split('/');
    for (const [capability, files] of Object.entries(CAPABILITY_FALLBACKS)) {
      if (segments.some((segment) => segment.includes(capability))) files.forEach((file) => hits.add(file));
    }
  }
  return [...hits].filter((file) => existsSync(path.join(root, file)));
}

export function chooseRelatedTestPaths(discovered: string[], fallback: string[]): string[] {
  return discovered.length > 0 ? discovered : fallback;
}

function isE2e(file: string): boolean { return file.includes('/test/e2e/') || file.endsWith('.e2e-spec.ts'); }
function isWeb(file: string): boolean { return file.startsWith('apps/web/'); }
function isAnalyzer(file: string): boolean { return file.startsWith('packages/analyzer/') || file.startsWith('tests/analyzer/'); }
