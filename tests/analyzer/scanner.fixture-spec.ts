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
      result.artifacts.sort((a, b) => a.stableId.localeCompare(b.stableId)),
    ).toEqual(
      expectedArtifacts.artifacts.sort((a, b) =>
        a.stableId.localeCompare(b.stableId),
      ),
    );
    expect(result.coverage).toEqual(expectedCoverage);
  });
});
