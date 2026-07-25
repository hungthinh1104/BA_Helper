import { readFileSync } from 'node:fs';
import path from 'node:path';

const manifest = JSON.parse(
  readFileSync(
    path.join(
      process.cwd(),
      'tests/evaluation/public-nestjs-repositories.json',
    ),
    'utf8',
  ),
) as {
  repositories: Array<{
    repository: string;
    commitSha: string;
    reviewStatus: string;
    frameworkDetected: string;
    coverageStatus: string;
    typescriptFiles: number;
    artifactCount: number;
    artifactEvidenceCoverage: number;
  }>;
};

describe('Public NestJS repository review manifest', () => {
  it('pins 3-5 reproducible public repositories with reviewed extraction results', () => {
    expect(manifest.repositories).toHaveLength(3);

    for (const repository of manifest.repositories) {
      expect(repository.repository).toMatch(/^[\w.-]+\/[\w.-]+$/);
      expect(repository.commitSha).toMatch(/^[a-f0-9]{40}$/);
      expect(repository.frameworkDetected).toBe('nestjs');
      expect(repository.coverageStatus).toBe('FULL');
      expect(repository.reviewStatus).toMatch(
        /^REVIEWED(?:_WITH_LIMITATION)?$/,
      );
      expect(repository.typescriptFiles).toBeGreaterThan(0);
      expect(repository.artifactCount).toBeGreaterThan(0);
      expect(repository.artifactEvidenceCoverage).toBeGreaterThan(0);
      expect(repository.artifactEvidenceCoverage).toBeLessThanOrEqual(1);
    }
  });
});
