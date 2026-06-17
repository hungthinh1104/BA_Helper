import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { loadResultRegistry } from './result-registry';

function writeKeywordBaselineFixture(tempDir: string): void {
  writeFileSync(
    join(tempDir, 'keyword-baseline.v0.json'),
    JSON.stringify({
      generatedAt: '2026-06-17T00:00:00.000Z',
      method: 'keyword-baseline-v0',
      topK: 10,
      cases: [
        {
          caseId: 'case-001',
          repo: 'owner/repo',
          groundTruthFiles: ['src/a.ts'],
          results: [],
        },
      ],
    }),
    'utf8',
  );
}

function writeBm25BaselineFixture(tempDir: string): void {
  writeFileSync(
    join(tempDir, 'bm25-baseline.v0.json'),
    JSON.stringify({
      generatedAt: '2026-06-17T00:00:00.000Z',
      method: 'bm25-baseline-v0',
      topK: 10,
      cases: [
        {
          caseId: 'case-001',
          repo: 'owner/repo',
          groundTruthFiles: ['src/a.ts'],
          results: [],
        },
      ],
    }),
    'utf8',
  );
}

describe('result registry', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'reqimpact-results-'));
    writeKeywordBaselineFixture(tempDir);
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('includes keyword-baseline.v0.json', () => {
    const registry = loadResultRegistry(tempDir);

    expect(registry.methods.map((method) => method.method)).toEqual(
      expect.arrayContaining([
      'keyword-baseline-v0',
      ]),
    );
  });

  it('includes bm25-baseline.v0.json when present', () => {
    writeBm25BaselineFixture(tempDir);

    const registry = loadResultRegistry(tempDir);

    expect(registry.methods.map((method) => method.method)).toEqual(
      expect.arrayContaining(['bm25-baseline-v0']),
    );
  });

  it('excludes rag-samples.v0.json as benchmark input', () => {
    writeFileSync(
      join(tempDir, 'rag-samples.v0.json'),
      JSON.stringify({ smoke: true }),
      'utf8',
    );

    const registry = loadResultRegistry(tempDir);

    expect(registry.methods.map((method) => method.sourceFile)).not.toContain(
      'rag-samples.v0.json',
    );
    expect(registry.warnings).toEqual(
      expect.arrayContaining([
        expect.stringContaining('Excluded non-benchmark result file: rag-samples.v0.json'),
      ]),
    );
  });

  it('reports missing optional result files as warnings', () => {
    const registry = loadResultRegistry(tempDir);

    expect(registry.warnings).toEqual(
      expect.arrayContaining([
        expect.stringContaining(
          'Optional result file not found: rag-samples.current-hybrid.v0.json',
        ),
        expect.stringContaining(
          'Optional result file not found: vector-baseline.v0.json',
        ),
      ]),
    );
  });
});
