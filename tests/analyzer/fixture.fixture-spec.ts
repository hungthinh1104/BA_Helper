import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { analyzeFixture } from '../../packages/analyzer/src';

describe('fixture analyzer output', () => {
  it('matches expected analysis JSON for booking cancellation', () => {
    const expectedPath = resolve(
      __dirname,
      '../fixtures/nestjs-booking-with-payment/expected/analysis.expected.json',
    );
    const expected = JSON.parse(readFileSync(expectedPath, 'utf-8'));

    const result = analyzeFixture('nestjs-booking-with-payment');

    expect(result).toEqual(expected);
  });
});
