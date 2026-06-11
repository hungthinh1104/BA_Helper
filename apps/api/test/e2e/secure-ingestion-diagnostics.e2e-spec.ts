jest.mock('@ba-helper/analyzer', () => ({
  GitHubUrlValidator: {
    validate: jest.fn(),
  },
  GitRepositoryFetcher: {
    fetch: jest.fn(),
  },
  FrameworkDetector: {
    detect: jest.fn(),
  },
  SafeFileEnumerator: jest.fn(),
  SecretRedactor: {
    redact: jest.fn((content: string) => ({
      redactedContent: content,
      foundSecrets: false,
    })),
  },
  DiagnosticCollector: class {
    private readonly items: any[] = [];

    add(item: any) {
      this.items.push(item);
    }

    addFromFileDiagnostic(item: any) {
      this.items.push(item);
    }

    addSecretRedacted(relativePath: string) {
      this.items.push({ code: 'SECRET_REDACTED', samplePaths: [relativePath] });
    }

    getItems() {
      return this.items;
    }
  },
  scanProject: jest.fn(),
  scanFixture: jest.fn(),
}));

import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import * as crypto from 'crypto';
import { createTestApp } from './helpers/test-app';
import { resetDatabase } from './helpers/reset-db';
import { PrismaService } from '../../src/modules/prisma/prisma.service';
import { RunScanJobUseCase } from '../../src/modules/scanner/application/run-scan-job.usecase';
import {
  projectCreateResponseSchema,
  repositoryCreateResponseSchema,
  repositoryDetailResponseSchema,
  scanJobResponseSchema,
} from '@ba-helper/contracts';

const analyzer = jest.requireMock('@ba-helper/analyzer') as {
  GitHubUrlValidator: { validate: jest.Mock };
  GitRepositoryFetcher: { fetch: jest.Mock };
  FrameworkDetector: { detect: jest.Mock };
  SafeFileEnumerator: jest.Mock;
  scanProject: jest.Mock;
};

describe('Secure Ingestion Diagnostics (E2E)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;
  let adminToken: string;
  let runScanJob: RunScanJobUseCase;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    jwtService = app.get(JwtService);
    runScanJob = app.get(RunScanJobUseCase);
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    await resetDatabase(prisma);
    const user = await prisma.user.create({
      data: {
        id: crypto.randomUUID(),
        email: 'admin@ba-helper.local',
        name: 'John Doe',
        role: 'ADMIN',
      },
    });
    adminToken = jwtService.sign({ sub: user.id, email: user.email, role: user.role });
  });

  it('rejects a non-canonical GitHub URL before repository creation', async () => {
    const project = await request(app.getHttpServer())
      .post('/api/v1/projects')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Security Project' })
      .expect(201);

    const projectId = projectCreateResponseSchema.parse(project.body).projectId;

    const response = await request(app.getHttpServer())
      .post(`/api/v1/projects/${projectId}/repositories`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ url: 'https://github.com/owner/repo/tree/main' })
      .expect(400);

    expect(response.body).toMatchObject({
      code: 'INVALID_REPOSITORY_URL',
    });
  });

  it('rejects an unsafe ref before scan queueing', async () => {
    const project = await prisma.project.create({ data: { name: 'Unsafe Ref Project' } });
    const repository = await prisma.repository.create({
      data: {
        projectId: project.id,
        canonicalUrl: 'https://github.com/owner/repo',
      },
    });

    const response = await request(app.getHttpServer())
      .post(`/api/v1/repositories/${repository.id}/scan-jobs`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        requestKey: crypto.randomUUID(),
        ref: 'main..evil',
      })
      .expect(400);

    expect(response.body).toMatchObject({
      code: 'INVALID_REPOSITORY_REF',
    });
  });

  it('surfaces PARTIAL diagnostics for a limit-triggered secure scan', async () => {
    analyzer.GitHubUrlValidator.validate.mockReturnValue({ isValid: true });
    analyzer.GitRepositoryFetcher.fetch.mockResolvedValue({
      commitSha: '0123456789abcdef0123456789abcdef01234567',
    });
    analyzer.FrameworkDetector.detect.mockResolvedValue({ isSupported: true });
    analyzer.SafeFileEnumerator.mockImplementation(() => ({
      enumerate: jest.fn().mockResolvedValue({
        tsFiles: [],
        allFiles: [],
        diagnostics: [
          {
            code: 'REPO_LIMIT_EXCEEDED',
            severity: 'WARN',
            category: 'LIMIT',
            message: 'Repository exceeded 100 MB limit.',
            samplePaths: ['src/huge.ts'],
          },
        ],
        isPartial: true,
      }),
    }));
    analyzer.scanProject.mockReturnValue({
      analyzerVersion: '0.1.0',
      artifacts: [],
      coverage: { status: 'PARTIAL', skippedFiles: ['src/huge.ts'] },
      sourceRoot: '/tmp/ba-scan-partial',
    });

    const project = await prisma.project.create({ data: { name: 'Partial Scan Project' } });
    const repository = await prisma.repository.create({
      data: {
        projectId: project.id,
        canonicalUrl: 'https://github.com/owner/repo',
      },
    });
    const projectId = project.id;
    const repositoryId = repository.id;

    const createJobRes = await request(app.getHttpServer())
      .post(`/api/v1/repositories/${repositoryId}/scan-jobs`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        requestKey: crypto.randomUUID(),
        ref: 'main',
      })
      .expect(201);
    const scanJob = scanJobResponseSchema.parse(createJobRes.body);

    await runScanJob.execute({ jobId: scanJob.id });

    const detailRes = await request(app.getHttpServer())
      .get(`/api/v1/projects/${projectId}/repositories/${repositoryId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const detail = repositoryDetailResponseSchema.parse(detailRes.body);

    expect(detail.latestTarget).toMatchObject({
      requestedRef: 'main',
      resolvedCommitSha: '0123456789abcdef0123456789abcdef01234567',
    });
    expect(detail.latestScanJob).toMatchObject({
      status: 'COMPLETED',
      error: null,
    });
    expect(detail.latestSnapshot).toMatchObject({
      coverageStatus: 'PARTIAL',
    });
    expect(detail.latestSnapshot?.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'REPO_LIMIT_EXCEEDED',
          severity: 'WARN',
          category: 'LIMIT',
        }),
      ]),
    );

    const completedEvent = await prisma.domainEvent.findUniqueOrThrow({
      where: {
        idempotencyKey: `scan-job:${scanJob.id}:completed`,
      },
    });
    expect(completedEvent.payload).toMatchObject({
      jobId: scanJob.id,
      repositoryId,
      commitSha: '0123456789abcdef0123456789abcdef01234567',
      coverageStatus: 'PARTIAL',
      diagnostics: expect.objectContaining({
        codes: ['REPO_LIMIT_EXCEEDED'],
      }),
    });
  });

  it('surfaces FAILED scan error code and blocker diagnostics for unsupported framework', async () => {
    analyzer.GitHubUrlValidator.validate.mockReturnValue({ isValid: true });
    analyzer.GitRepositoryFetcher.fetch.mockResolvedValue({
      commitSha: 'fedcba9876543210fedcba9876543210fedcba98',
    });
    analyzer.FrameworkDetector.detect.mockResolvedValue({
      isSupported: false,
      reason: 'Express repositories are not supported in the MVP.',
    });

    const project = await prisma.project.create({ data: { name: 'Blocked Scan Project' } });
    const repository = await prisma.repository.create({
      data: {
        projectId: project.id,
        canonicalUrl: 'https://github.com/owner/repo',
      },
    });

    const createJobRes = await request(app.getHttpServer())
      .post(`/api/v1/repositories/${repository.id}/scan-jobs`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        requestKey: crypto.randomUUID(),
        ref: 'main',
      })
      .expect(201);
    const scanJob = scanJobResponseSchema.parse(createJobRes.body);

    await runScanJob.execute({ jobId: scanJob.id }).catch(() => undefined);

    let status = scanJobResponseSchema.parse(
      (
        await request(app.getHttpServer())
          .get(`/api/v1/repositories/${repository.id}/scan-jobs/${scanJob.id}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200)
      ).body,
    );

    for (let attempt = 0; attempt < 5 && status.status !== 'FAILED'; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 25));
      status = scanJobResponseSchema.parse(
        (
          await request(app.getHttpServer())
            .get(`/api/v1/repositories/${repository.id}/scan-jobs/${scanJob.id}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .expect(200)
        ).body,
      );
    }

    expect(status.status).toBe('FAILED');
    expect(status.error).toMatchObject({
      code: 'UNSUPPORTED_FRAMEWORK',
      message: 'Express repositories are not supported in the MVP.',
    });
    expect(status.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'UNSUPPORTED_FRAMEWORK',
          severity: 'BLOCKER',
          category: 'FRAMEWORK',
        }),
      ]),
    );

    const detailRes = await request(app.getHttpServer())
      .get(`/api/v1/projects/${project.id}/repositories/${repository.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const detail = repositoryDetailResponseSchema.parse(detailRes.body);

    expect(detail.latestScanJob).toMatchObject({
      status: 'FAILED',
      error: {
        code: 'UNSUPPORTED_FRAMEWORK',
        message: 'Express repositories are not supported in the MVP.',
      },
    });
    expect(detail.latestSnapshot).toBeUndefined();

    const failedEvent = await prisma.domainEvent.findUniqueOrThrow({
      where: {
        idempotencyKey: `scan-job:${scanJob.id}:failed`,
      },
    });
    expect(failedEvent.payload).toMatchObject({
      jobId: scanJob.id,
      repositoryId: repository.id,
      errorCode: 'UNSUPPORTED_FRAMEWORK',
      diagnostics: expect.objectContaining({
        codes: ['UNSUPPORTED_FRAMEWORK'],
      }),
    });
  });
});
