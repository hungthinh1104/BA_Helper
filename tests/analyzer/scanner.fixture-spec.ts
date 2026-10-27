import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { scanFixture, type ScanArtifact, type ScanCoverage } from '../../packages/analyzer/src';

describe('scanner fixture expectations', () => {
  it('extracts expected artifacts and coverage', () => {
    const fixturePath = resolve(
      __dirname,
      '../fixtures/nestjs-booking-with-payment',
    );
    const expectedArtifactsPath = resolve(
      __dirname,
      '../fixtures/nestjs-booking-with-payment/expected/artifacts.json',
    );
    const expectedCoveragePath = resolve(
      __dirname,
      '../fixtures/nestjs-booking-with-payment/expected/coverage.json',
    );

    const result = scanFixture({
      fixturePath,
      analyzerVersion: 'ts-nestjs-analyzer@0.1.0',
    });

    const expectedArtifacts = JSON.parse(
      readFileSync(expectedArtifactsPath, 'utf-8'),
    ) as { artifacts: ScanArtifact[] };
    const expectedCoverage = JSON.parse(
      readFileSync(expectedCoveragePath, 'utf-8'),
    ) as ScanCoverage;

    expect(result.analyzerVersion).toBe('ts-nestjs-analyzer@0.1.0');
    expect(
      result.artifacts.map(({ testBodySpan: _span, ...a }) => ({ ...a, excerpt: a.excerpt.replace(/\r\n/g, '\n') }))
        .sort((a, b) => a.stableId.localeCompare(b.stableId)),
    ).toEqual(
      expectedArtifacts.artifacts.sort((a, b) =>
        a.stableId.localeCompare(b.stableId),
      ),
    );
    expect(result.coverage).toEqual(expectedCoverage);
  });

  it('validates pinned fixture source offsets against actual LF source bytes', () => {
    const fixturePath = resolve(__dirname, '../fixtures/nestjs-booking-with-payment');
    const expectedPath = resolve(fixturePath, 'expected/artifacts.json');
    const { artifacts } = JSON.parse(readFileSync(expectedPath, 'utf-8')) as { artifacts: ScanArtifact[] };
    const locations = artifacts.flatMap(artifact => [
      ...(artifact.codeEvidence?.parameters ?? []).map(item => ({ location: item.sourceLocation, text: item.sourceText })),
      ...(artifact.codeEvidence?.returnType ? [{ location: artifact.codeEvidence.returnType.sourceLocation,
        text: artifact.codeEvidence.returnType.text }] : []),
      ...(artifact.codeEvidence?.conditions ?? []).map(item => ({ location: item.sourceLocation, text: item.sourceText })),
      ...(artifact.codeEvidence?.exceptionHandlers ?? []).map(item => ({ location: item.sourceLocation, text: item.sourceText })),
    ]);

    expect(locations.length).toBeGreaterThan(0);
    const sourceCache = new Map<string, string>();
    for (const { location, text } of locations) {
      let source = sourceCache.get(location.relativePath);
      if (source === undefined) {
        source = readFileSync(resolve(fixturePath, location.relativePath), 'utf-8');
        sourceCache.set(location.relativePath, source);
      }
      // Git attributes pin this fixture to LF on every runner. Do not silently
      // normalize offsets to make a stale golden file pass.
      expect(source).not.toContain('\\r');
      const lines = source.split('\\n');
      const offset = (line: number, column: number) =>
        lines.slice(0, line - 1).reduce((sum, value) => sum + value.length + 1, 0) + column - 1;
      expect(location.startOffset).toBe(offset(location.startLine, location.startColumn));
      expect(location.endOffset).toBe(offset(location.endLine, location.endColumn));
      expect(source.slice(location.startOffset, location.endOffset)).toBe(text);
    }
  });
});
