import { resolve } from 'node:path';
import { scanFixture } from '../../packages/analyzer/src';

describe('prompt-injection fixture extraction boundary', () => {
  it('does not infer an artifact from an instruction-like constant-only source file', () => {
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
