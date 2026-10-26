import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { ANALYZER_VERSION, buildGraph, scanFixture, type ScanArtifact, type ScanCoverage } from '../../packages/analyzer/src';

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

    const result = scanFixture({ fixturePath });

    const expectedArtifacts = JSON.parse(
      readFileSync(expectedArtifactsPath, 'utf-8'),
    ) as { artifacts: ScanArtifact[] };
    const expectedCoverage = JSON.parse(
      readFileSync(expectedCoveragePath, 'utf-8'),
    ) as ScanCoverage;

    expect(result.analyzerVersion).toBe(ANALYZER_VERSION);
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

  it('keeps source offsets deterministic across LF and CRLF checkouts', () => {
    const fixturePath = resolve(__dirname, '../fixtures/nestjs-booking-with-payment');
    const temporaryRoot = mkdtempSync(join(tmpdir(), 'ba-helper-line-endings-'));
    const lfRoot = join(temporaryRoot, 'lf');
    const crlfRoot = join(temporaryRoot, 'crlf');
    cpSync(fixturePath, lfRoot, { recursive: true });
    cpSync(fixturePath, crlfRoot, { recursive: true });

    const rewriteLineEndings = (root: string, lineEnding: '\n' | '\r\n') => {
      const pending = [join(root, 'src'), join(root, 'test')];
      while (pending.length > 0) {
        const directory = pending.pop()!;
        if (!existsSync(directory)) continue;
        for (const entry of readdirSync(directory, { withFileTypes: true })) {
          const path = join(directory, entry.name);
          if (entry.isDirectory()) pending.push(path);
          else if (entry.isFile() && path.endsWith('.ts')) {
            const source = readFileSync(path, 'utf8').replace(/\r\n?/g, '\n');
            writeFileSync(path, source.replace(/\n/g, lineEnding), 'utf8');
          }
        }
      }
    };
    const normalizeArtifacts = (artifacts: ScanArtifact[]) => artifacts
      .map(({ testBodySpan: _span, ...artifact }) => ({
        ...artifact,
        excerpt: artifact.excerpt.replace(/\r\n?/g, '\n'),
      }))
      .sort((left, right) => left.stableId.localeCompare(right.stableId));

    try {
      rewriteLineEndings(lfRoot, '\n');
      rewriteLineEndings(crlfRoot, '\r\n');
      const commitSha = 'a'.repeat(40);
      const lfScan = scanFixture({ fixturePath: lfRoot, commitSha });
      const crlfScan = scanFixture({ fixturePath: crlfRoot, commitSha });
      const lfGraph = buildGraph(lfScan);
      const crlfGraph = buildGraph(crlfScan);

      expect(normalizeArtifacts(crlfScan.artifacts)).toEqual(normalizeArtifacts(lfScan.artifacts));
      expect(crlfScan.coverage).toEqual(lfScan.coverage);
      expect(lfGraph.edges.some(edge => edge.type === 'TESTS')).toBe(true);
      expect(crlfGraph).toEqual(lfGraph);
      for (const [root, scan] of [[lfRoot, lfScan], [crlfRoot, crlfScan]] as const) {
        for (const artifact of scan.artifacts) {
          const source = readFileSync(join(root, artifact.filePath), 'utf8').replace(/\r\n?/g, '\n');
          const locations = [
            ...(artifact.codeEvidence?.parameters.map(item => ({ location: item.sourceLocation, text: item.sourceText })) ?? []),
            ...(artifact.codeEvidence?.returnType ? [{
              location: artifact.codeEvidence.returnType.sourceLocation,
              text: artifact.codeEvidence.returnType.text,
            }] : []),
            ...(artifact.testCase?.behaviorEvidence?.map(claim => ({
              location: claim.sourceLocation, text: claim.sourceText,
            })) ?? []),
          ];
          for (const item of locations) {
            expect(source.slice(item.location.startOffset, item.location.endOffset)).toBe(item.text);
          }
        }
      }
    } finally {
      rmSync(temporaryRoot, { recursive: true, force: true });
    }
  });

  it('resolves test calls near the end of a CRLF body using canonical source offsets', () => {
    const temporaryRoot = mkdtempSync(join(tmpdir(), 'ba-helper-long-test-offsets-'));
    const roots = [join(temporaryRoot, 'lf'), join(temporaryRoot, 'crlf')];
    const setup = Array.from({ length: 40 }, (_, index) => `  const value${index} = 'input';`).join('\n');
    const sources = {
      'src/long.service.ts': `import { Injectable } from '@nestjs/common';\n@Injectable()\nexport class LongService { run(value: string) { return value; } }\n`,
      'test/long.service.spec.ts': `import { LongService } from '../src/long.service';\nimport { it } from '@jest/globals';\nit('links a late call', async () => {\n  const service = new LongService();\n${setup}\n  await service.run(value39);\n});\n`,
    };

    try {
      const graphs = roots.map((root, index) => {
        for (const [relativePath, source] of Object.entries(sources)) {
          const target = join(root, relativePath);
          mkdirSync(join(target, '..'), { recursive: true });
          writeFileSync(target, source.replace(/\n/g, index === 0 ? '\n' : '\r\n'), 'utf8');
        }
        return buildGraph(scanFixture({ fixturePath: root, commitSha: 'a'.repeat(40) }));
      });

      expect(graphs[0].edges.some(edge => edge.type === 'TESTS' && edge.to.includes('LongService.run'))).toBe(true);
      expect(graphs[1]).toEqual(graphs[0]);
    } finally {
      rmSync(temporaryRoot, { recursive: true, force: true });
    }
  });
});
