import { summarizePinnedDiagnostics, summarizePinnedScanDiagnostics } from './pinned-proof-diagnostics';

describe('summarizePinnedDiagnostics', () => {
  it('includes file-enumerator diagnostics and bounded path samples in pinned proof summaries', () => {
    const summary = summarizePinnedScanDiagnostics([], [{
      code: 'TS_FILE_LIMIT_EXCEEDED', severity: 'WARN', message: 'TypeScript file limit exceeded.',
      filePath: 'src/too-many.ts',
    }]);

    expect(summary.codeCounts).toEqual([['TS_FILE_LIMIT_EXCEEDED', 1]]);
    expect(summary.fileDiagnosticExamples).toEqual([{
      code: 'TS_FILE_LIMIT_EXCEEDED', severity: 'WARN', filePath: 'src/too-many.ts',
    }]);
  });

  it('groups unresolved diagnostics by reason and keeps exact bounded source locations', () => {
    const summary = summarizePinnedDiagnostics([
      { code: 'TEST_TARGET_UNRESOLVED', severity: 'WARN', count: 2, message: 'missing receiver', payload: {
        relativePath: 'src/auth/auth.controller.spec.ts', reason: 'UNRESOLVED_RECEIVER', sampleEvidence: [
          { sourcePath: 'src/auth/auth.controller.spec.ts', sourceSymbol: 'AuthController.spec',
            startLine: 14, endLine: 14, targetExpression: 'controller.create()' },
        ],
      } },
      { code: 'JEST_BEHAVIOR_UNRESOLVED', severity: 'WARN', message: 'unsupported matcher', payload: {
        unsupportedPattern: 'DYNAMIC_MATCHER',
      } },
      { code: 'TEST_TARGET_UNRESOLVED', severity: 'WARN', message: 'alias not resolved', payload: {
        reason: 'ALIAS_RESOLUTION_FAILED', sampleEvidence: [
          { sourcePath: 'src/blog/blog.controller.spec.ts', sourceSymbol: 'BlogController.spec',
            startLine: 22, endLine: 22, targetExpression: 'controller.create()' },
        ],
      } },
      { code: 'TEST_TARGET_UNRESOLVED', severity: 'WARN', message: 'same unresolved receiver', payload: {
        reason: 'UNRESOLVED_RECEIVER', sampleEvidence: [
          { sourcePath: 'src/auth/auth.controller.spec.ts', sourceSymbol: 'AuthController.spec',
            startLine: 14, endLine: 14, targetExpression: 'controller.create()' },
        ],
      } },
    ]);

    expect(summary.codeCounts).toEqual([
      ['JEST_BEHAVIOR_UNRESOLVED', 1], ['TEST_TARGET_UNRESOLVED', 4],
    ]);
    expect(summary.reasonCounts).toEqual([
      { code: 'JEST_BEHAVIOR_UNRESOLVED', reason: 'DYNAMIC_MATCHER', count: 1 },
      { code: 'TEST_TARGET_UNRESOLVED', reason: 'ALIAS_RESOLUTION_FAILED', count: 1 },
      { code: 'TEST_TARGET_UNRESOLVED', reason: 'UNRESOLVED_RECEIVER', count: 3 },
    ]);
    expect(summary.examples).toEqual([
      { code: 'TEST_TARGET_UNRESOLVED', reason: 'ALIAS_RESOLUTION_FAILED',
        sourcePath: 'src/blog/blog.controller.spec.ts', sourceSymbol: 'BlogController.spec',
        startLine: 22, endLine: 22, targetExpression: 'controller.create()' },
      { code: 'TEST_TARGET_UNRESOLVED', reason: 'UNRESOLVED_RECEIVER',
        sourcePath: 'src/auth/auth.controller.spec.ts', sourceSymbol: 'AuthController.spec',
        startLine: 14, endLine: 14, targetExpression: 'controller.create()' },
    ]);
  });

  it('sorts and caps examples so proof artifacts stay bounded and deterministic', () => {
    const diagnostics = Array.from({ length: 4 }, (_, index) => ({
      code: 'TEST_TARGET_UNRESOLVED', severity: 'WARN' as const, message: 'unresolved', payload: {
        reason: 'UNRESOLVED_RECEIVER', sampleEvidence: [{
          sourcePath: `src/${3 - index}.spec.ts`, sourceSymbol: `Case${index}`,
          startLine: index + 1, endLine: index + 1,
        }],
      },
    }));
    const summary = summarizePinnedDiagnostics(diagnostics, 2);

    expect(summary.examples).toHaveLength(2);
    expect(summary.examples.map(example => example.sourcePath)).toEqual(['src/0.spec.ts', 'src/1.spec.ts']);
  });
});
