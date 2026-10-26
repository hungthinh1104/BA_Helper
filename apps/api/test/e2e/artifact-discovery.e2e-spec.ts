import type { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '@ba-helper/backend-runtime';
import crypto from 'node:crypto';
import request from 'supertest';
import { createTestApp } from './helpers/test-app';
import { resetDatabase } from './helpers/reset-db';

describe('Artifact discovery (E2E)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;
  let adminToken: string;
  let snapshotId: string;
  let selectedArtifactId: string;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    jwtService = app.get(JwtService);
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
    const user = await prisma.user.create({
      data: { id: crypto.randomUUID(), email: 'artifact-discovery@ba-helper.local', name: 'Artifact Discovery', role: 'ADMIN' },
    });
    adminToken = jwtService.sign({ sub: user.id, email: user.email, role: user.role });
    const project = await prisma.project.create({ data: { name: 'Artifact Discovery Project' } });
    await prisma.projectMember.create({ data: { projectId: project.id, userId: user.id, role: 'OWNER' } });
    const repository = await prisma.repository.create({
      data: { projectId: project.id, canonicalUrl: 'https://github.com/mock/artifact-discovery' },
    });
    const snapshot = await prisma.repositorySnapshot.create({
      data: { repositoryId: repository.id, commitSha: 'artifact-discovery-commit',
        analyzerVersion: 'analyzer@0.14.0', coverageStatus: 'READY', diagnostics: [] },
    });
    snapshotId = snapshot.id;
    selectedArtifactId = crypto.randomUUID();
    await prisma.codeArtifact.create({ data: {
      id: selectedArtifactId, snapshotId, artifactKey: 'service:src/booking.service.ts:BookingService.cancel',
      name: 'BookingService.cancel', artifactType: 'SERVICE_METHOD', universalKind: 'DOMAIN_SERVICE',
      filePath: 'src/booking.service.ts', startLine: 10, endLine: 24, language: 'typescript', contentHash: 'sha256:service',
    } });
  });

  it('paginates persisted artifacts and searches beyond the first page without merging duplicate names', async () => {
    const bulkArtifacts = Array.from({ length: 51 }, (_, index) => {
      const sequence = String(index + 1).padStart(3, '0');
      return {
        id: crypto.randomUUID(), snapshotId,
        artifactKey: `service:src/bulk/method-${sequence}.service.ts:BulkService.method-${sequence}`,
        name: `BulkService.method-${sequence}`, artifactType: 'SERVICE_METHOD',
        universalKind: 'DOMAIN_SERVICE', filePath: `src/bulk/method-${sequence}.service.ts`,
        startLine: 1, endLine: 5, language: 'typescript', contentHash: `sha256:bulk-${sequence}`,
      };
    });
    const duplicateArtifacts = [
      { filePath: 'src/alpha.service.ts', artifactKey: 'service:src/alpha.service.ts:DuplicateService.run' },
      { filePath: 'src/beta.service.ts', artifactKey: 'service:src/beta.service.ts:DuplicateService.run' },
    ].map(({ filePath, artifactKey }) => ({
      id: crypto.randomUUID(), snapshotId, artifactKey, name: 'DuplicateService.run',
      artifactType: 'SERVICE_METHOD', universalKind: 'DOMAIN_SERVICE', filePath,
      startLine: 2, endLine: 6, language: 'typescript', contentHash: `sha256:${filePath}`,
    }));
    await prisma.codeArtifact.createMany({ data: [...bulkArtifacts, ...duplicateArtifacts] });

    const firstPage = await request(app.getHttpServer())
      .get(`/api/v1/snapshots/${snapshotId}/artifacts`)
      .query({ scope: 'production', search: 'BulkService', limit: 50, offset: 0 })
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(firstPage.body.items).toHaveLength(50);
    expect(firstPage.body.items[0].name).toBe('BulkService.method-001');
    expect(firstPage.body.items[49].name).toBe('BulkService.method-050');
    expect(firstPage.body.hasMore).toBe(true);

    const stableFirstPage = await request(app.getHttpServer())
      .get(`/api/v1/snapshots/${snapshotId}/artifacts`)
      .query({ scope: 'production', search: 'BulkService', limit: 50, offset: 0 })
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(stableFirstPage.body.items.map((item: { id: string }) => item.id))
      .toEqual(firstPage.body.items.map((item: { id: string }) => item.id));

    const lastPage = await request(app.getHttpServer())
      .get(`/api/v1/snapshots/${snapshotId}/artifacts`)
      .query({ scope: 'production', search: 'BulkService', limit: 50, offset: 50 })
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(lastPage.body.items).toHaveLength(1);
    expect(lastPage.body.items[0].name).toBe('BulkService.method-051');
    expect(lastPage.body.hasMore).toBe(false);

    for (const search of [bulkArtifacts[50].artifactKey, bulkArtifacts[50].filePath]) {
      const result = await request(app.getHttpServer())
        .get(`/api/v1/snapshots/${snapshotId}/artifacts`)
        .query({ scope: 'production', search })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(result.body.items.map((item: { id: string }) => item.id)).toEqual([bulkArtifacts[50].id]);
    }

    const duplicateNames = await request(app.getHttpServer())
      .get(`/api/v1/snapshots/${snapshotId}/artifacts`)
      .query({ scope: 'production', search: 'DuplicateService.run' })
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(duplicateNames.body.items).toHaveLength(2);
    expect(duplicateNames.body.items.map((item: { filePath: string }) => item.filePath))
      .toEqual(['src/alpha.service.ts', 'src/beta.service.ts']);
    expect(new Set(duplicateNames.body.items.map((item: { id: string }) => item.id)).size).toBe(2);
  });
});
