import { existsSync, mkdtempSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { probeVectorBaselinePath } from './vector-path-probe';

describe('vector path probe', () => {
  const originalEnv = {
    DATABASE_URL: process.env.DATABASE_URL,
    REQIMPACT_VECTOR_PROVIDER: process.env.REQIMPACT_VECTOR_PROVIDER,
    REQIMPACT_VECTOR_MODEL: process.env.REQIMPACT_VECTOR_MODEL,
    REQIMPACT_VECTOR_SOURCE: process.env.REQIMPACT_VECTOR_SOURCE,
    REQIMPACT_ALLOW_NETWORK_VECTOR_BASELINE:
      process.env.REQIMPACT_ALLOW_NETWORK_VECTOR_BASELINE,
  };

  afterEach(() => {
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });

  it('selects NONE when no env is configured', () => {
    delete process.env.DATABASE_URL;
    delete process.env.REQIMPACT_VECTOR_PROVIDER;
    delete process.env.REQIMPACT_VECTOR_MODEL;
    delete process.env.REQIMPACT_VECTOR_SOURCE;
    delete process.env.REQIMPACT_ALLOW_NETWORK_VECTOR_BASELINE;

    const report = probeVectorBaselinePath();

    expect(report.selectedPath).toBe('NONE');
  });

  it('marks persisted db path as available with manual inputs when DATABASE_URL exists', () => {
    process.env.DATABASE_URL = 'postgresql://example';
    delete process.env.REQIMPACT_VECTOR_PROVIDER;
    delete process.env.REQIMPACT_VECTOR_MODEL;
    delete process.env.REQIMPACT_VECTOR_SOURCE;

    const report = probeVectorBaselinePath();

    expect(report.feasiblePaths).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: 'PERSISTED_DB',
        }),
      ]),
    );
  });

  it('selects LOCAL_MODEL when local provider env is valid', () => {
    process.env.REQIMPACT_VECTOR_PROVIDER = 'local';
    process.env.REQIMPACT_VECTOR_MODEL = 'bge-small-en-v1.5';
    process.env.REQIMPACT_VECTOR_SOURCE = 'local-model';
    delete process.env.DATABASE_URL;
    delete process.env.REQIMPACT_ALLOW_NETWORK_VECTOR_BASELINE;

    const report = probeVectorBaselinePath();

    expect(report.selectedPath).toBe('LOCAL_MODEL');
  });

  it('blocks network provider without opt-in', () => {
    process.env.REQIMPACT_VECTOR_PROVIDER = 'google';
    process.env.REQIMPACT_VECTOR_MODEL = 'text-embedding-004';
    process.env.REQIMPACT_VECTOR_SOURCE = 'network';
    delete process.env.REQIMPACT_ALLOW_NETWORK_VECTOR_BASELINE;

    const report = probeVectorBaselinePath();

    expect(report.selectedPath).not.toBe('NETWORK_PROVIDER');
    expect(report.blockedPaths).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: 'NETWORK_PROVIDER',
        }),
      ]),
    );
  });

  it('allows network provider path when explicitly opted in', () => {
    process.env.REQIMPACT_VECTOR_PROVIDER = 'google';
    process.env.REQIMPACT_VECTOR_MODEL = 'text-embedding-004';
    process.env.REQIMPACT_VECTOR_SOURCE = 'network';
    process.env.REQIMPACT_ALLOW_NETWORK_VECTOR_BASELINE = '1';

    const report = probeVectorBaselinePath();

    expect(report.selectedPath).toBe('NETWORK_PROVIDER');
  });

  it('blocks fake provider env', () => {
    process.env.REQIMPACT_VECTOR_PROVIDER = 'fake-provider';
    process.env.REQIMPACT_VECTOR_MODEL = 'fake-model';
    process.env.REQIMPACT_VECTOR_SOURCE = 'local-model';

    const report = probeVectorBaselinePath();

    expect(report.selectedPath).toBe('NONE');
    expect(report.blockedPaths).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: 'LOCAL_MODEL',
        }),
      ]),
    );
  });

  it('keeps missing vector-baseline.v0.json as expected false', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'reqimpact-vector-probe-'));
    const outputPath = join(tempDir, 'vector-baseline.v0.json');

    try {
      const report = probeVectorBaselinePath({
        vectorBaselineResultPath: outputPath,
      });

      expect(report.vectorBaselineResultExists).toBe(false);
      expect(existsSync(outputPath)).toBe(false);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
