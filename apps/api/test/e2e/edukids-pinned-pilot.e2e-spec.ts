import type { INestApplication, INestApplicationContext } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import {
  projectCreateResponseSchema,
  repositoryCreateResponseSchema,
  scanJobResponseSchema,
} from '@ba-helper/contracts';
import { PrismaService } from '@ba-helper/backend-runtime';
import { createTestApp } from './helpers/test-app';
import { resetDatabase } from './helpers/reset-db';

const EDUKIDS_URL = 'https://github.com/hungthinh1104/EduKids';
const EDUKIDS_COMMIT = '78547792178275bb76ba1550c41265f55f79350a';
const pilotDescribe = process.env.EDUKIDS_PILOT_REAL_SCAN === 'true' ? describe : describe.skip;

jest.setTimeout(15 * 60_000);

pilotDescribe('EduKids pinned real scan (E2E)', () => {
  let api: INestApplication;
  let worker: INestApplicationContext;
  let prisma: PrismaService;
  let adminToken: string;

  beforeAll(async () => {
    api = await createTestApp();
    prisma = api.get(PrismaService);
    const jwt = api.get(JwtService);
    await resetDatabase(prisma);
    const admin = await prisma.user.create({
      data: {
        id: randomUUID(),
        email: 'edukids-pilot-admin@ba-helper.local',
        name: 'EduKids Pilot Admin',
        role: 'ADMIN',
      },
    });
    adminToken = jwt.sign({ sub: admin.id, email: admin.email, role: admin.role });
  });

  afterAll(async () => {
    try {
      await worker?.close();
    } finally {
      if (prisma) await prisma.$disconnect();
      await api?.close();
    }
  });

  it('acquires, scans, and persists only the pinned source commit through the worker path', async () => {
    const projectResponse = await request(api.getHttpServer())
      .post('/api/v1/projects')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'EduKids trust validation' })
      .expect(201);
    const project = projectCreateResponseSchema.parse(projectResponse.body);

    const repositoryResponse = await request(api.getHttpServer())
      .post(`/api/v1/projects/${project.projectId}/repositories`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ url: EDUKIDS_URL })
      .expect(201);
    const repository = repositoryCreateResponseSchema.parse(repositoryResponse.body);

    const startedAt = new Date();
    const scanResponse = await request(api.getHttpServer())
      .post(`/api/v1/repositories/${repository.repositoryId}/scan-jobs`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ ref: EDUKIDS_COMMIT, requestKey: randomUUID() })
      .expect(201);
    const scanJob = scanJobResponseSchema.parse(scanResponse.body);

    const { AppModule } = await import('../../../worker/src/app.module');
    worker = await NestFactory.createApplicationContext(AppModule, { logger: false });
    await worker.init();

    const deadline = Date.now() + 12 * 60_000;
    let persisted = await prisma.scanJob.findUniqueOrThrow({ where: { id: scanJob.id } });
    while (Date.now() < deadline && persisted.status !== 'COMPLETED' && persisted.status !== 'FAILED') {
      await new Promise((resolveDelay) => setTimeout(resolveDelay, 1_000));
      persisted = await prisma.scanJob.findUniqueOrThrow({ where: { id: scanJob.id } });
    }
    const evidencePath = process.env.EDUKIDS_SCAN_EVIDENCE_PATH;
    if (persisted.status !== 'COMPLETED' || !persisted.snapshotId) {
      const observedTarget = await prisma.repositoryTarget.findFirst({
        where: { repositoryId: repository.repositoryId, requestedRef: EDUKIDS_COMMIT },
        select: { id: true, requestedRef: true, resolvedRefType: true, latestObservedCommitSha: true },
      });
      await writeEvidence(evidencePath, {
        schemaVersion: 1,
        source: {
          url: EDUKIDS_URL,
          requestedCommitSha: EDUKIDS_COMMIT,
          resolvedCommitSha: observedTarget?.latestObservedCommitSha ?? null,
        },
        scan: {
          jobId: persisted.id,
          targetId: observedTarget?.id ?? null,
          resolvedRefType: observedTarget?.resolvedRefType ?? null,
          status: persisted.status,
          errorCode: persisted.errorCode,
          errorMessage: persisted.errorMessage,
          terminalStage: persisted.stage,
          timedOut: Date.now() >= deadline,
        },
      });
      throw new Error(`Pinned EduKids scan ended with status ${persisted.status} (${persisted.errorCode ?? 'no error code'}).`);
    }

    const [snapshot, target, artifactGroups, edgeGroups, selectedArtifacts, selectedEdges] = await Promise.all([
      prisma.repositorySnapshot.findUniqueOrThrow({
        where: { id: persisted.snapshotId! },
        select: {
          id: true,
          commitSha: true,
          analyzerVersion: true,
          coverageStatus: true,
          indexStatus: true,
          diagnostics: true,
          profile: { select: { domain: true, language: true, framework: true, sourceRoots: true, testRoots: true } },
          _count: { select: { artifacts: true, edges: true, evidences: true, embeddingChunks: true } },
        },
      }),
      prisma.repositoryTarget.findFirstOrThrow({
        where: { repositoryId: repository.repositoryId, requestedRef: EDUKIDS_COMMIT },
        select: { id: true, requestedRef: true, resolvedRefType: true, latestObservedCommitSha: true },
      }),
      prisma.codeArtifact.groupBy({ by: ['artifactType'], where: { snapshotId: persisted.snapshotId! }, _count: true }),
      prisma.dependencyEdge.groupBy({ by: ['type'], where: { snapshotId: persisted.snapshotId! }, _count: true }),
      prisma.codeArtifact.findMany({
        where: { snapshotId: persisted.snapshotId!, filePath: { startsWith: 'apps/backend/src/modules/' } },
        select: { artifactKey: true, artifactType: true, name: true, filePath: true, startLine: true, endLine: true },
        orderBy: [{ filePath: 'asc' }, { startLine: 'asc' }],
      }),
      prisma.dependencyEdge.findMany({
        where: { snapshotId: persisted.snapshotId! },
        select: {
          type: true,
          confidence: true,
          fromArtifact: { select: { artifactKey: true, artifactType: true, filePath: true, startLine: true, endLine: true } },
          toArtifact: { select: { artifactKey: true, artifactType: true, filePath: true, startLine: true, endLine: true } },
        },
      }),
    ]);

    expect(snapshot.commitSha.toLowerCase()).toBe(EDUKIDS_COMMIT);
    expect(target).toMatchObject({
      requestedRef: EDUKIDS_COMMIT,
      resolvedRefType: 'COMMIT',
      latestObservedCommitSha: EDUKIDS_COMMIT,
    });

    const diagnostics = Array.isArray(snapshot.diagnostics) ? snapshot.diagnostics : [];
    const relevantPath = (filePath: string) => /apps\/backend\/src\/modules\/(auth|quiz|pronunciation)\//.test(filePath);
    const graphEvidence = selectedEdges.filter((edge) =>
      relevantPath(edge.fromArtifact.filePath) || relevantPath(edge.toArtifact.filePath));
    const health = diagnostics.find((item) => typeof item === 'object' && item !== null &&
      'code' in item && item.code === 'SCAN_HEALTH');
    const healthPayload = health && typeof health === 'object' && 'payload' in health &&
      typeof health.payload === 'object' && health.payload !== null ? health.payload as Record<string, unknown> : {};
    await writeEvidence(evidencePath, {
      schemaVersion: 1,
      source: { url: EDUKIDS_URL, requestedCommitSha: EDUKIDS_COMMIT, resolvedCommitSha: snapshot.commitSha },
      scan: {
        jobId: persisted.id,
        snapshotId: snapshot.id,
        targetId: target.id,
        analyzerVersion: snapshot.analyzerVersion,
        status: persisted.status,
        coverageStatus: snapshot.coverageStatus,
        indexStatus: snapshot.indexStatus,
        profile: snapshot.profile,
        elapsedSeconds: Math.round((Date.now() - startedAt.getTime()) / 100) / 10,
        scannedFileCount: typeof healthPayload.scannedFileCount === 'number' ? healthPayload.scannedFileCount : null,
        skippedFileCount: typeof healthPayload.skippedFileCount === 'number' ? healthPayload.skippedFileCount : null,
        skippedSummary: healthPayload.skippedSummary ?? null,
        artifactCount: snapshot._count.artifacts,
        evidenceCount: snapshot._count.evidences,
        edgeCount: snapshot._count.edges,
        embeddingChunkCount: snapshot._count.embeddingChunks,
        artifactTypes: Object.fromEntries(artifactGroups.map((item) => [item.artifactType, item._count])),
        edgeTypes: Object.fromEntries(edgeGroups.map((item) => [item.type, item._count])),
        diagnosticCodes: diagnostics.flatMap((item) =>
          typeof item === 'object' && item !== null && 'code' in item && typeof item.code === 'string'
            ? [item.code] : []),
        evaluatedArtifacts: selectedArtifacts.filter((item) => relevantPath(item.filePath)),
        relatedDependencyEdges: graphEvidence,
      },
    });
  }, 13 * 60_000);
});

async function writeEvidence(evidencePath: string | undefined, evidence: unknown): Promise<void> {
  if (!evidencePath) return;
  const outputPath = resolve(process.cwd(), evidencePath);
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, JSON.stringify(evidence, null, 2) + '\n', 'utf8');
}
