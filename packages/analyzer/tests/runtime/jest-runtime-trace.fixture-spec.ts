import { realpathSync } from 'node:fs';
import { join } from 'node:path';
import { scanProject } from '../../src';
import { importJestRuntimeTrace } from '../../src/runtime/jest-runtime-trace';

describe('Jest runtime trace correlation against the booking behavior fixture', () => {
  it('joins a local result to the scanned test artifact without importing static claims as runtime facts', () => {
    const repoRoot = realpathSync.native(join(__dirname, '../../../../tests/fixtures/jest-behavior/repo'));
    const testFilePath = join(repoRoot, 'test/refund-flow.spec.ts');
    const commitSha = 'c'.repeat(40);
    const scan = scanProject({ fixturePath: repoRoot, tsFiles: [testFilePath], commitSha });
    const testArtifact = scan.artifacts.find(artifact => artifact.type === 'JEST_TEST_CASE' && artifact.testCase?.modifier === 'NORMAL');
    expect(testArtifact).toBeDefined();

    const report = JSON.stringify({ testResults: [{ testFilePath, testResults: [{
      ancestorTitles: ['Booking refund'], title: 'refunds a paid booking', status: 'passed',
      location: { line: testArtifact!.startLine, column: 1 }, startAt: 1_800_000_000_000, duration: 23,
    }] }] });
    const trace = importJestRuntimeTrace(report, { repoRoot, commitSha,
      staticSnapshotCommitSha: commitSha, staticArtifacts: [testArtifact!], runId: 'fixture-run-1' });

    expect(trace.observations).toHaveLength(1);
    expect(trace.observations[0]).toMatchObject({
      testCaseId: testArtifact!.stableId, testCaseArtifactKey: testArtifact!.stableId,
      correlation: 'MATCHED', outcome: 'PASSED', sourceLocation: {
        relativePath: 'test/refund-flow.spec.ts', line: testArtifact!.startLine, column: 1,
      },
    });
    expect(JSON.stringify(trace)).not.toContain('STATIC_DECLARATION');
    expect(trace.capabilities.methodCallSpans).toBe(false);
  });
});
