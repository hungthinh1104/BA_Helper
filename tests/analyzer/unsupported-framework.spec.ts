import { resolve } from 'node:path';
import { scanFixture } from '../../packages/analyzer/src';

describe('scanner unsupported framework handling', () => {
  it('throws UNSUPPORTED_FRAMEWORK for unsupported repositories', () => {
    const fixturePath = resolve(__dirname, '../fixtures/express-unsupported');

    expect(() =>
      scanFixture({
        fixturePath,
        analyzerVersion: 'ts-nestjs-analyzer@0.1.0',
      }),
    ).toThrow('UNSUPPORTED_FRAMEWORK');
  });
});
