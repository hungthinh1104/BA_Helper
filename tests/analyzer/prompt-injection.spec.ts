import { resolve } from 'node:path';
import { scanFixture } from '../../packages/analyzer/src';

describe('prompt injection handling', () => {
  it('treats instruction-like comments as data only', () => {
    const fixturePath = resolve(
      __dirname,
      '../fixtures/nestjs-booking-with-payment',
    );

    const result = scanFixture({
      fixturePath,
      analyzerVersion: 'ts-nestjs-analyzer@0.1.0',
    });

    expect(result.artifacts.map((artifact) => artifact.filePath)).not.toContain(
      'src/admin/prompt-injection.ts',
    );
  });
});
