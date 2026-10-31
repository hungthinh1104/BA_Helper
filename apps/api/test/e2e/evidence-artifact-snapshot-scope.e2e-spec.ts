import type { INestApplication } from '@nestjs/common';
import { PrismaService } from '@ba-helper/backend-runtime';
import { randomUUID } from 'node:crypto';
import { createTestApp } from './helpers/test-app';
import { resetDatabase } from './helpers/reset-db';

describe('Evidence artifact snapshot provenance (E2E)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let snapshotId: string;
  let foreignArtifactId: string;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
    const project = await prisma.project.create({ data: { name: 'Evidence scope project' } });
    const repository = await prisma.repository.create({
      data: { projectId: project.id, canonicalUrl: 'https://github.com/mock/evidence-scope' },
    });
    const localSnapshot = await prisma.repositorySnapshot.create({
      data: {
        repositoryId: repository.id,
        commitSha: 'local-evidence-scope-commit',
        analyzerVersion: 'analyzer@1.0.0',
        coverageStatus: 'READY',
      },
    });
    const foreignSnapshot = await prisma.repositorySnapshot.create({
      data: {
        repositoryId: repository.id,
        commitSha: 'foreign-evidence-scope-commit',
        analyzerVersion: 'analyzer@1.0.0',
        coverageStatus: 'READY',
      },
    });
    const foreignArtifact = await prisma.codeArtifact.create({
      data: {
        snapshotId: foreignSnapshot.id,
        artifactKey: 'service:foreign-evidence-scope',
        name: 'ForeignEvidenceScope',
        artifactType: 'SERVICE',
        filePath: 'src/foreign-evidence-scope.ts',
      },
    });
    snapshotId = localSnapshot.id;
    foreignArtifactId = foreignArtifact.id;
  });

  afterEach(async () => {
    await resetDatabase(prisma);
  });

  it('rejects evidence whose snapshot differs from the referenced artifact snapshot', async () => {
    const provenanceKey = `cross-snapshot-evidence:${randomUUID()}`;

    await expect(prisma.evidence.create({
      data: {
        provenanceKey,
        sourceType: 'CODE',
        snapshotId,
        artifactId: foreignArtifactId,
        sourcePath: 'src/foreign-evidence-scope.ts',
        excerpt: 'cross-snapshot source evidence',
        contentHash: 'cross-snapshot-evidence-hash',
      },
    })).rejects.toMatchObject({ code: 'P2003' });

    await expect(prisma.evidence.count({ where: { provenanceKey } })).resolves.toBe(0);
  });

  it('rejects artifact evidence whose snapshot provenance is missing', async () => {
    const provenanceKey = `missing-snapshot-evidence:${randomUUID()}`;

    await expect(prisma.evidence.create({
      data: {
        provenanceKey,
        sourceType: 'CODE',
        snapshotId: null,
        artifactId: foreignArtifactId,
        sourcePath: 'src/foreign-evidence-scope.ts',
        excerpt: 'artifact evidence without snapshot provenance',
        contentHash: 'missing-snapshot-evidence-hash',
      },
    })).rejects.toBeDefined();

    await expect(prisma.evidence.count({ where: { provenanceKey } })).resolves.toBe(0);
  });

  it.each(['CODE', 'TEST', 'STATIC_ANALYSIS', 'COVERAGE'] as const)(
    'rejects %s evidence without snapshot identity even when no artifact is attached',
    async (sourceType) => {
      const provenanceKey = `unscoped-${sourceType.toLowerCase()}-evidence:${randomUUID()}`;

      await expect(prisma.evidence.create({
        data: {
          provenanceKey,
          sourceType,
          snapshotId: null,
          artifactId: null,
          sourcePath: 'src/unscoped.ts',
          excerpt: 'unscoped repository-derived evidence',
          contentHash: 'unscoped-repository-evidence-hash',
        },
      })).rejects.toBeDefined();

      await expect(prisma.evidence.count({ where: { provenanceKey } })).resolves.toBe(0);
    },
  );

  it('rejects requirement evidence without revision identity', async () => {
    const provenanceKey = `unscoped-requirement-evidence:${randomUUID()}`;

    await expect(prisma.evidence.create({
      data: {
        provenanceKey,
        sourceType: 'REQUIREMENT_INPUT',
        snapshotId: null,
        artifactId: null,
        requirementRevisionId: null,
        excerpt: 'unscoped requirement evidence',
        contentHash: 'unscoped-requirement-evidence-hash',
      },
    })).rejects.toBeDefined();

    await expect(prisma.evidence.count({ where: { provenanceKey } })).resolves.toBe(0);
  });
});
