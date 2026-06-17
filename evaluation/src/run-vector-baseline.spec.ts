import { mkdtempSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { runVectorBaselineGate } from '../scripts/run-vector-baseline';

describe('run-vector-baseline gate', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'reqimpact-vector-gate-'));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('does not write vector-baseline.v0.json on refusal', () => {
    const outputPath = join(tempDir, 'vector-baseline.v0.json');
    const result = runVectorBaselineGate({
      outputPath,
      providerConfig: {
        providerName: 'FakeEmbeddingProvider',
        embeddingModel: 'fake-v1',
        source: 'fake',
        allowsNetwork: false,
        isDeterministic: true,
        isFake: true,
      },
    });

    expect(result.refused).toBe(true);
    expect(result.wroteOutput).toBe(false);
    expect(result.message).toMatch(/No vector-baseline\.v0\.json was written/i);
  });
});
