import { performance } from 'node:perf_hooks';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { ScanArtifact } from '../../src/scanner/scanner.types';
import { importJestRuntimeTrace } from '../../src/runtime/jest-runtime-trace';

describe('Jest runtime trace import performance', () => {
  it('imports 5,000 results across 100 suite batches within latency and output budgets', () => {
    const root = join(tmpdir(), 'ba-runtime-trace-performance-fixture');
    const suites = Array.from({ length: 100 }, (_, suiteIndex) => {
      const filePath = `worker-${suiteIndex}/perf.spec.ts`;
      const testResults = Array.from({ length: 50 }, (_, caseIndex) => {
        const index = suiteIndex * 50 + caseIndex;
        return { ancestorTitles: ['GeneratedSuite'], title: `case ${index}`,
          status: index % 17 === 0 ? 'failed' : 'passed', location: { line: caseIndex + 1, column: 1 },
          startAt: 1_800_000_000_000 + index, duration: (index % 31) + 1, failureMessages: ['not retained'] };
      });
      return { testFilePath: `${root}/${filePath}`, filePath, testResults };
    });
    const artifacts: ScanArtifact[] = [];
    for (const [suiteIndex, suite] of suites.entries()) {
      for (const [caseIndex, result] of suite.testResults.entries()) {
        const index = suiteIndex * 50 + caseIndex;
        artifacts.push({ stableId: `test-case:${suite.filePath}::${index}`, type: 'JEST_TEST_CASE', filePath: suite.filePath,
          symbolName: `GeneratedSuite > case ${index}`, startLine: result.location.line,
          endLine: result.location.line, excerpt: '',
          testCase: { framework: 'jest', suitePath: ['GeneratedSuite'], title: result.title,
            modifier: 'NORMAL', declaredModifier: 'NORMAL', parentFileArtifactKey: `test:${suite.filePath}#file` } });
      }
    }
    const report = JSON.stringify({ testResults: suites.map(suite => ({
      testFilePath: suite.testFilePath, testResults: suite.testResults,
    })) });
    const startedAt = performance.now();
    const trace = importJestRuntimeTrace(report, {
      repoRoot: root, commitSha: 'a'.repeat(40), staticSnapshotCommitSha: 'a'.repeat(40),
      staticArtifacts: artifacts, runId: 'performance-run',
    });
    const elapsedMs = performance.now() - startedAt;
    const outputBytes = Buffer.byteLength(JSON.stringify(trace), 'utf8');

    expect(trace.observations).toHaveLength(5_000);
    expect(trace.observations.every(item => item.correlation === 'MATCHED')).toBe(true);
    expect(elapsedMs).toBeLessThan(5_000);
    expect(outputBytes).toBeLessThan(5 * 1024 * 1024);
  });
});
