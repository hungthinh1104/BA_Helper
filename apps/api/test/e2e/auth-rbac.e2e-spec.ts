import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import * as crypto from 'crypto';
import { JwtService } from '@nestjs/jwt';
import { createTestApp } from './helpers/test-app';
import { resetDatabase } from './helpers/reset-db';
import { grantProjectMembership } from './helpers/grant-project-membership';
import {
  artifactListResponseSchema,
  ClarificationItemDtoSchema,
  ClarificationListResponseSchema,
  ConvertClarificationResponseSchema,
  evidenceListResponseSchema,
  eventLogListResponseSchema,
  impactGraphResponseSchema,
  requirementCreateResponseSchema,
  requirementDetailResponseSchema,
  requirementListResponseSchema,
  requirementRevisionCreateResponseSchema,
  requirementRevisionQualifyResponseSchema,
  reviewCompletionResponseSchema,
  reviewCoverageResponseSchema,
  reviewClarificationListResponseSchema,
  reviewClarificationRequestSchema,
} from '@ba-helper/contracts';
import { EventLogService, PrismaService } from "@ba-helper/backend-runtime";
import { PasswordHashService } from '../../src/modules/auth/application/password-hash.service';

describe('Auth and RBAC (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;
  let passwordHashService: PasswordHashService;

  let adminToken: string;
  let reviewerToken: string;
  let viewerToken: string;
  let adminUserId: string;
  let reviewerUserId: string;
  let viewerUserId: string;
  let originalEnableDevLogin: string | undefined;
  let originalWorkspaceMode: string | undefined;
  let originalCorsAllowedOrigins: string | undefined;

  beforeAll(async () => {
    originalCorsAllowedOrigins = process.env.CORS_ALLOWED_ORIGINS;
    process.env.CORS_ALLOWED_ORIGINS = 'https://web.example.test';
    app = await createTestApp();
    prisma = app.get(PrismaService);
    jwtService = app.get(JwtService);
    passwordHashService = app.get(PasswordHashService);
  });

  afterAll(async () => {
    await app.close();
    if (originalCorsAllowedOrigins === undefined) {
      delete process.env.CORS_ALLOWED_ORIGINS;
    } else {
      process.env.CORS_ALLOWED_ORIGINS = originalCorsAllowedOrigins;
    }
  });

  beforeEach(async () => {
    await resetDatabase(prisma);

    originalEnableDevLogin = process.env.ENABLE_DEV_LOGIN;
    originalWorkspaceMode = process.env.WORKSPACE_MODE;

    const [admin, reviewer, viewer] = await Promise.all([
      prisma.user.create({
        data: {
          id: crypto.randomUUID(),
          email: 'admin@ba-helper.local',
          name: 'Admin',
          role: 'ADMIN',
        },
      }),
      prisma.user.create({
        data: {
          id: crypto.randomUUID(),
          email: 'reviewer@ba-helper.local',
          name: 'Reviewer',
          role: 'REVIEWER',
        },
      }),
      prisma.user.create({
        data: {
          id: crypto.randomUUID(),
          email: 'viewer@ba-helper.local',
          name: 'Viewer',
          role: 'VIEWER',
        },
      }),
    ]);

    adminUserId = admin.id;
    reviewerUserId = reviewer.id;
    viewerUserId = viewer.id;

    adminToken = jwtService.sign({ sub: admin.id, email: admin.email, role: admin.role, name: admin.name });
    reviewerToken = jwtService.sign({ sub: reviewer.id, email: reviewer.email, role: reviewer.role, name: reviewer.name });
    viewerToken = jwtService.sign({ sub: viewer.id, email: viewer.email, role: viewer.role, name: viewer.name });
  });

  afterEach(() => {
    if (originalEnableDevLogin === undefined) {
      delete process.env.ENABLE_DEV_LOGIN;
    } else {
      process.env.ENABLE_DEV_LOGIN = originalEnableDevLogin;
    }

    if (originalWorkspaceMode === undefined) {
      delete process.env.WORKSPACE_MODE;
    } else {
      process.env.WORKSPACE_MODE = originalWorkspaceMode;
    }
  });

  async function seedAnalysisGraph(status: 'WAITING_FOR_REVIEW' | 'COMPLETED' = 'WAITING_FOR_REVIEW') {
    const projectId = crypto.randomUUID();
    const repositoryId = crypto.randomUUID();
    const targetId = crypto.randomUUID();
    const snapshotId = crypto.randomUUID();
    const artifactId = crypto.randomUUID();
    const requirementId = crypto.randomUUID();
    const revisionId = crypto.randomUUID();
    const analysisId = crypto.randomUUID();
    const insightId = crypto.randomUUID();
    const linkId = crypto.randomUUID();

    await prisma.project.create({ data: { id: projectId, name: 'Auth RBAC Project' } });
    await Promise.all([
      grantProjectMembership(prisma, {
        projectId,
        userId: adminUserId,
        role: 'OWNER',
      }),
      grantProjectMembership(prisma, {
        projectId,
        userId: reviewerUserId,
        role: 'REVIEWER',
      }),
      grantProjectMembership(prisma, {
        projectId,
        userId: viewerUserId,
        role: 'VIEWER',
      }),
    ]);
    await prisma.repository.create({
      data: {
        id: repositoryId,
        projectId,
        canonicalUrl: 'https://github.com/example/repo',
      },
    });
    await prisma.repositoryTarget.create({
      data: {
        id: targetId,
        repositoryId,
        targetKey: 'main',
        requestedRef: 'main',
        resolvedRefType: 'BRANCH',
        latestObservedCommitSha: 'abc1234',
        lastObservedAt: new Date(),
      },
    });
    await prisma.repositorySnapshot.create({
      data: {
        id: snapshotId,
        repositoryId,
        commitSha: 'abc1234',
        analyzerVersion: '1.0.0',
        coverageStatus: 'READY',
      },
    });
    await prisma.codeArtifact.create({
      data: {
        id: artifactId,
        snapshotId,
        artifactKey: 'src/orders/orders.service.ts#OrdersService',
        name: 'OrdersService',
        artifactType: 'SERVICE',
        universalKind: 'DOMAIN_SERVICE',
        filePath: 'src/orders/orders.service.ts',
      },
    });
    await prisma.requirement.create({
      data: {
        id: requirementId,
        projectId,
      },
    });
    await prisma.requirementRevision.create({
      data: {
        id: revisionId,
        requirementId,
        title: 'Refund paid bookings',
        rawText: 'Allow users to cancel paid bookings and receive refund.',
        normalizedText: 'Allow users to cancel paid bookings and receive refund.',
        readinessStatus: 'READY_FOR_ANALYSIS',
      },
    });
    await prisma.impactAnalysis.create({
      data: {
        id: analysisId,
        requirementRevisionId: revisionId,
        requirementId,
        projectId,
        repositoryId,
        snapshotId,
        sourceTargetId: targetId,
        requestKey: crypto.randomUUID(),
        status,
        stage: 'DONE',
      },
    });
    await prisma.baInsight.create({
      data: {
        id: insightId,
        impactAnalysisId: analysisId,
        insightKey: 'unknown-refund-path',
        insightType: 'UNKNOWN',
        certainty: 'UNKNOWN',
        reviewStatus: 'NEEDS_REVIEW',
        title: 'Refund path needs clarification',
        description: 'Unsure whether refund is handled in payment service.',
      },
    });
    await prisma.impactAnalysis.update({
      where: { id: analysisId },
      data: {
        traceabilityLinks: {
          create: {
            id: linkId,
            artifactId,
            linkType: 'AFFECTED',
            linkBasis: 'EVIDENCED',
            reviewStatus: 'NEEDS_REVIEW',
          },
        },
      },
    });

    return {
      projectId,
      repositoryId,
      targetId,
      snapshotId,
      requirementId,
      revisionId,
      analysisId,
      insightId,
      linkId,
    };
  }

  it('serves dev-login on /api/v1/auth/dev-login and gates it by ENABLE_DEV_LOGIN', async () => {
    process.env.ENABLE_DEV_LOGIN = 'false';

    await request(app.getHttpServer())
      .post('/api/v1/auth/dev-login')
      .send({ email: 'new-user@ba-helper.local' })
      .expect(403);

    process.env.ENABLE_DEV_LOGIN = 'true';

    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/dev-login')
      .send({ email: 'new-user@ba-helper.local', role: 'REVIEWER' })
      .expect(201);

    expect(res.body.accessToken).toEqual(expect.any(String));
    expect(res.body.user.email).toBe('new-user@ba-helper.local');
    expect(res.body.user.role).toBe('REVIEWER');
  });

  it('logs in with persisted password hash and does not mutate role', async () => {
    const passwordHash = await passwordHashService.hashPassword('admin-password-123');
    await prisma.user.update({
      where: { id: adminUserId },
      data: { passwordHash },
    });

    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'admin@ba-helper.local', password: 'admin-password-123' })
      .expect(200);

    expect(res.body.accessToken).toEqual(expect.any(String));
    expect(res.body.user).toMatchObject({
      email: 'admin@ba-helper.local',
      role: 'ADMIN',
    });

    const persisted = await prisma.user.findUniqueOrThrow({
      where: { id: adminUserId },
    });
    expect(persisted.role).toBe('ADMIN');
  });

  it('returns generic 401 for wrong password, unknown email, and missing hash', async () => {
    const passwordHash = await passwordHashService.hashPassword('admin-password-123');
    await prisma.user.update({
      where: { id: adminUserId },
      data: { passwordHash },
    });

    const wrongPassword = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'admin@ba-helper.local', password: 'wrong-password-123' })
      .expect(401);

    const unknownEmail = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'unknown@ba-helper.local', password: 'wrong-password-123' })
      .expect(401);

    const missingHash = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'viewer@ba-helper.local', password: 'viewer-password-123' })
      .expect(401);

    expect(wrongPassword.body.message).toBe('Invalid email or password.');
    expect(unknownEmail.body.message).toBe('Invalid email or password.');
    expect(missingHash.body.message).toBe('Invalid email or password.');
  });

  it('allows unauthenticated workspace bootstrap through GET /api/v1/workspace/current', async () => {
    process.env.WORKSPACE_MODE = 'dev-single-user';

    const res = await request(app.getHttpServer())
      .get('/api/v1/workspace/current')
      .expect(200);

    expect(res.body.projectId).toEqual(expect.any(String));
    expect(res.body.mode).toBe('dev-single-user');
    expect(res.body.membershipRole).toBeNull();
  });

  it('returns project membership role when workspace bootstrap is called with an authenticated actor', async () => {
    process.env.WORKSPACE_MODE = 'dev-single-user';

    const res = await request(app.getHttpServer())
      .get('/api/v1/workspace/current')
      .set('Authorization', `Bearer ${reviewerToken}`)
      .expect(200);

    expect(res.body.membershipRole).toBe('REVIEWER');
    const member = await prisma.projectMember.findFirst({
      where: {
        projectId: res.body.projectId,
      },
    });
    expect(member).toMatchObject({
      role: 'REVIEWER',
    });
  });

  // This multi-request lifecycle includes real scrypt derivations and persisted audit writes.
  it('provisions, resets, disables, and audits a local-password account', async () => {
    const provision = await request(app.getHttpServer())
      .post('/api/v1/auth/accounts')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        email: 'operator@ba-helper.local',
        name: 'Operator',
        password: 'initial-password-123',
        role: 'REVIEWER',
      })
      .expect(201);

    const userId = provision.body.userId as string;
    const firstLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'operator@ba-helper.local',
        password: 'initial-password-123',
      })
      .expect(200);

    await request(app.getHttpServer())
      .post(`/api/v1/auth/accounts/${userId}/reset-password`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ password: 'replacement-password-123' })
      .expect(201);

    await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${firstLogin.body.accessToken}`)
      .expect(401);

    const secondLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'operator@ba-helper.local',
        password: 'replacement-password-123',
      })
      .expect(200);

    await request(app.getHttpServer())
      .post(`/api/v1/auth/accounts/${userId}/disable`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(201);

    await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${secondLogin.body.accessToken}`)
      .expect(401);
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'operator@ba-helper.local',
        password: 'replacement-password-123',
      })
      .expect(401);

    const events = await prisma.domainEvent.findMany({
      where: {
        eventType: {
          in: [
            'ACCOUNT_PROVISIONED',
            'ACCOUNT_PASSWORD_RESET',
            'ACCOUNT_DISABLED',
            'AUTH_LOGIN_SUCCEEDED',
            'AUTH_LOGIN_FAILED',
          ],
        },
      },
    });
    expect(new Set(events.map((event) => event.eventType))).toEqual(
      new Set([
        'ACCOUNT_PROVISIONED',
        'ACCOUNT_PASSWORD_RESET',
        'ACCOUNT_DISABLED',
        'AUTH_LOGIN_SUCCEEDED',
        'AUTH_LOGIN_FAILED',
      ]),
    );
    expect(JSON.stringify(events)).not.toContain('replacement-password-123');
  }, 30_000);

  it('normalizes account emails: case-insensitive login and rejects case-variant duplicates', async () => {
    const provision = await request(app.getHttpServer())
      .post('/api/v1/auth/accounts')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        email: '  Mixed.Case@Example.COM ',
        name: 'Mixed',
        password: 'initial-password-123',
        role: 'REVIEWER',
      })
      .expect(201);

    // Stored in canonical (normalized) form.
    const stored = await prisma.user.findUniqueOrThrow({
      where: { id: provision.body.userId as string },
    });
    expect(stored.email).toBe('mixed.case@example.com');

    // Login succeeds regardless of the casing the user types.
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'MIXED.case@example.com', password: 'initial-password-123' })
      .expect(200);
    expect(login.body.user.email).toBe('mixed.case@example.com');

    // A case-variant of an existing address is a duplicate, not a new account.
    await request(app.getHttpServer())
      .post('/api/v1/auth/accounts')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        email: 'mixed.CASE@Example.com',
        name: 'Dup',
        password: 'initial-password-123',
        role: 'REVIEWER',
      })
      .expect(409);

    const count = await prisma.user.count({ where: { email: 'mixed.case@example.com' } });
    expect(count).toBe(1);
  });

  it('completes the account lifecycle (list/get/role/enable/self-password) and audits every step', async () => {
    const provision = await request(app.getHttpServer())
      .post('/api/v1/auth/accounts')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        email: 'lifecycle-op@ba-helper.local',
        name: 'Lifecycle Operator',
        password: 'initial-password-123',
        role: 'REVIEWER',
      })
      .expect(201);
    const userId = provision.body.userId as string;

    // List is admin-only.
    await request(app.getHttpServer())
      .get('/api/v1/auth/accounts')
      .set('Authorization', `Bearer ${reviewerToken}`)
      .expect(403);
    const list = await request(app.getHttpServer())
      .get('/api/v1/auth/accounts')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(
      list.body.items.some(
        (a: { id: string; status: string }) => a.id === userId && a.status === 'ACTIVE',
      ),
    ).toBe(true);

    // Get single account.
    const detail = await request(app.getHttpServer())
      .get(`/api/v1/auth/accounts/${userId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(detail.body).toMatchObject({ id: userId, role: 'REVIEWER', status: 'ACTIVE' });

    // Role update revokes existing sessions (credentialsVersion bump).
    const opLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'lifecycle-op@ba-helper.local', password: 'initial-password-123' })
      .expect(200);
    await request(app.getHttpServer())
      .post(`/api/v1/auth/accounts/${userId}/role`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: 'VIEWER' })
      .expect(201);
    await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${opLogin.body.accessToken}`)
      .expect(401);
    // Admin cannot change their own role (lockout guard).
    await request(app.getHttpServer())
      .post(`/api/v1/auth/accounts/${adminUserId}/role`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: 'VIEWER' })
      .expect(400);

    // Disable then re-enable restores login.
    await request(app.getHttpServer())
      .post(`/api/v1/auth/accounts/${userId}/disable`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(201);
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'lifecycle-op@ba-helper.local', password: 'initial-password-123' })
      .expect(401);
    await request(app.getHttpServer())
      .post(`/api/v1/auth/accounts/${userId}/enable`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(201);
    const reLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'lifecycle-op@ba-helper.local', password: 'initial-password-123' })
      .expect(200);

    // Self change-password: verifies current password and revokes other sessions.
    await request(app.getHttpServer())
      .post('/api/v1/auth/me/change-password')
      .set('Authorization', `Bearer ${reLogin.body.accessToken}`)
      .send({ currentPassword: 'wrong-password', newPassword: 'brand-new-password-123' })
      .expect(401);
    await request(app.getHttpServer())
      .post('/api/v1/auth/me/change-password')
      .set('Authorization', `Bearer ${reLogin.body.accessToken}`)
      .send({ currentPassword: 'initial-password-123', newPassword: 'brand-new-password-123' })
      .expect(201);
    await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${reLogin.body.accessToken}`)
      .expect(401);
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'lifecycle-op@ba-helper.local', password: 'brand-new-password-123' })
      .expect(200);

    // Audit trail is admin-only and records every account operation with an actor.
    await request(app.getHttpServer())
      .get('/api/v1/auth/accounts/audit')
      .set('Authorization', `Bearer ${reviewerToken}`)
      .expect(403);
    const audit = await request(app.getHttpServer())
      .get('/api/v1/auth/accounts/audit')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const auditedTypes = new Set(
      audit.body.items.map((e: { eventType: string }) => e.eventType),
    );
    expect([...auditedTypes]).toEqual(
      expect.arrayContaining([
        'ACCOUNT_PROVISIONED',
        'ACCOUNT_ROLE_UPDATED',
        'ACCOUNT_DISABLED',
        'ACCOUNT_ENABLED',
        'ACCOUNT_PASSWORD_CHANGED',
      ]),
    );
    expect(
      audit.body.items.every(
        (e: { subjectUserId: string | null; actorUserId: string | null }) =>
          e.subjectUserId && e.actorUserId,
      ),
    ).toBe(true);
  }, 30000); // Several real password hashes/verifications and HTTP transactions.

  it('enforces admin-only project creation', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/projects')
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({ name: 'Viewer Project' })
      .expect(403);

    const res = await request(app.getHttpServer())
      .post('/api/v1/projects')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Admin Project' })
      .expect(201);

    expect(res.body.name).toBe('Admin Project');
    const member = await prisma.projectMember.findFirst({
      where: {
        projectId: res.body.projectId,
      },
    });
    expect(member).toMatchObject({
      userId: expect.any(String),
      role: 'OWNER',
    });
  });

  it('lets project owner create password user and does not overwrite existing user password', async () => {
    const project = await prisma.project.create({
      data: { id: crypto.randomUUID(), name: 'Member Password Project' },
    });
    await grantProjectMembership(prisma, {
      projectId: project.id,
      userId: adminUserId,
      role: 'OWNER',
    });

    await request(app.getHttpServer())
      .post(`/api/v1/projects/${project.id}/members`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        email: 'new-member@ba-helper.local',
        name: 'New Member',
        initialPassword: 'member-password-123',
        role: 'ANALYST',
      })
      .expect(201);

    const created = await prisma.user.findUniqueOrThrow({
      where: { email: 'new-member@ba-helper.local' },
    });
    expect(created.passwordHash).toEqual(expect.stringMatching(/^scrypt\$/));
    expect(created.passwordHash).not.toContain('member-password-123');

    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'new-member@ba-helper.local', password: 'member-password-123' })
      .expect(200);

    const originalHash = created.passwordHash;
    await request(app.getHttpServer())
      .post(`/api/v1/projects/${project.id}/members`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        email: 'new-member@ba-helper.local',
        initialPassword: 'replacement-password-123',
        role: 'REVIEWER',
      })
      .expect(201);

    const afterUpsert = await prisma.user.findUniqueOrThrow({
      where: { email: 'new-member@ba-helper.local' },
    });
    expect(afterUpsert.passwordHash).toBe(originalHash);
  });

  it('blocks non-owner from creating project members', async () => {
    const project = await prisma.project.create({
      data: { id: crypto.randomUUID(), name: 'Blocked Member Project' },
    });
    await grantProjectMembership(prisma, {
      projectId: project.id,
      userId: viewerUserId,
      role: 'VIEWER',
    });

    await request(app.getHttpServer())
      .post(`/api/v1/projects/${project.id}/members`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({
        email: 'blocked-member@ba-helper.local',
        initialPassword: 'member-password-123',
        role: 'VIEWER',
      })
      .expect(403);

    await expect(
      prisma.user.findUnique({ where: { email: 'blocked-member@ba-helper.local' } }),
    ).resolves.toBeNull();
  });

  it('blocks reviewer from admin-only setup, scan, requirement, base-analysis, and finalize operations', async () => {
    const project = await prisma.project.create({
      data: { id: crypto.randomUUID(), name: 'RBAC Project' },
    });
    await Promise.all([
      grantProjectMembership(prisma, {
        projectId: project.id,
        userId: adminUserId,
        role: 'OWNER',
      }),
      grantProjectMembership(prisma, {
        projectId: project.id,
        userId: reviewerUserId,
        role: 'REVIEWER',
      }),
      grantProjectMembership(prisma, {
        projectId: project.id,
        userId: viewerUserId,
        role: 'VIEWER',
      }),
    ]);
    const repository = await prisma.repository.create({
      data: {
        id: crypto.randomUUID(),
        projectId: project.id,
        canonicalUrl: 'https://github.com/example/repo',
      },
    });
    const target = await prisma.repositoryTarget.create({
      data: {
        id: crypto.randomUUID(),
        repositoryId: repository.id,
        targetKey: 'main',
        requestedRef: 'main',
        resolvedRefType: 'BRANCH',
        latestObservedCommitSha: 'abc1234',
        lastObservedAt: new Date(),
      },
    });
    const snapshot = await prisma.repositorySnapshot.create({
      data: {
        id: crypto.randomUUID(),
        repositoryId: repository.id,
        commitSha: 'abc1234',
        analyzerVersion: '1.0.0',
        coverageStatus: 'READY',
      },
    });
    const requirement = await prisma.requirement.create({
      data: { id: crypto.randomUUID(), projectId: project.id },
    });
    const revision = await prisma.requirementRevision.create({
      data: {
        id: crypto.randomUUID(),
        requirementId: requirement.id,
        title: 'Refund paid bookings',
        rawText: 'Allow users to cancel paid bookings and receive refund.',
        normalizedText: 'Allow users to cancel paid bookings and receive refund.',
        readinessStatus: 'READY_FOR_ANALYSIS',
      },
    });
    const analysis = await prisma.impactAnalysis.create({
      data: {
        id: crypto.randomUUID(),
        requirementRevisionId: revision.id,
        requirementId: requirement.id,
        projectId: project.id,
        repositoryId: snapshot.repositoryId,
        snapshotId: snapshot.id,
        sourceTargetId: target.id,
        requestKey: crypto.randomUUID(),
        status: 'WAITING_FOR_REVIEW',
        stage: 'DONE',
      },
    });

    await request(app.getHttpServer())
      .post(`/api/v1/projects/${project.id}/repositories`)
      .set('Authorization', `Bearer ${reviewerToken}`)
      .send({ url: 'https://github.com/example/other' })
      .expect(403);

    await request(app.getHttpServer())
      .post(`/api/v1/repositories/${repository.id}/scan-jobs`)
      .set('Authorization', `Bearer ${reviewerToken}`)
      .send({ requestKey: crypto.randomUUID(), ref: 'main' })
      .expect(403);

    await request(app.getHttpServer())
      .post(`/api/v1/projects/${project.id}/requirements`)
      .set('Authorization', `Bearer ${reviewerToken}`)
      .send({ requestKey: crypto.randomUUID(), title: 'Reviewer requirement', rawText: 'text' })
      .expect(403);

    await request(app.getHttpServer())
      .post(`/api/v1/requirement-revisions/${revision.id}/impact-analyses`)
      .set('Authorization', `Bearer ${reviewerToken}`)
      .send({
        snapshotId: snapshot.id,
        sourceTargetId: target.id,
        allowPartialSnapshot: false,
        requestKey: crypto.randomUUID(),
      })
      .expect(403);

    await request(app.getHttpServer())
      .post(`/api/v1/impact-analyses/${analysis.id}/finalize`)
      .set('Authorization', `Bearer ${reviewerToken}`)
      .send({ acknowledgeUnreviewed: true })
      .expect(403);
  });

  it('blocks viewers but allows reviewer insight and traceability review', async () => {
    const { insightId, linkId } = await seedAnalysisGraph('WAITING_FOR_REVIEW');

    await request(app.getHttpServer())
      .post(`/api/v1/insights/${insightId}/review`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({ reviewStatus: 'CONFIRMED' })
      .expect(403);

    await request(app.getHttpServer())
      .post(`/api/v1/insights/${insightId}/review`)
      .set('Authorization', `Bearer ${reviewerToken}`)
      .send({ reviewStatus: 'CONFIRMED' })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/v1/traceability-links/${linkId}/confirm`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .expect(403);

    await request(app.getHttpServer())
      .post(`/api/v1/traceability-links/${linkId}/confirm`)
      .set('Authorization', `Bearer ${reviewerToken}`)
      .expect(201);
  });

  it('blocks viewers but allows reviewer clarification creation and answer', async () => {
    const { analysisId, insightId } = await seedAnalysisGraph('WAITING_FOR_REVIEW');

    await request(app.getHttpServer())
      .post(`/api/v1/impact-analyses/${analysisId}/clarifications`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({ sourceInsightId: insightId })
      .expect(403);

    const createRes = await request(app.getHttpServer())
      .post(`/api/v1/impact-analyses/${analysisId}/clarifications`)
      .set('Authorization', `Bearer ${reviewerToken}`)
      .send({ sourceInsightId: insightId })
      .expect(201);
    const created = ClarificationItemDtoSchema.parse(createRes.body);
    expect(created).toMatchObject({ impactAnalysisId: analysisId, sourceInsightId: insightId, status: 'OPEN' });

    await request(app.getHttpServer())
      .patch(`/api/v1/clarifications/${created.id}/answer`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({ answer: 'Refund is handled by payment service.' })
      .expect(403);

    const answerRes = await request(app.getHttpServer())
      .patch(`/api/v1/clarifications/${created.id}/answer`)
      .set('Authorization', `Bearer ${reviewerToken}`)
      .send({ answer: 'Refund is handled by payment service.' })
      .expect(200);
    expect(ClarificationItemDtoSchema.parse(answerRes.body)).toMatchObject({
      id: created.id,
      status: 'ANSWERED',
      answer: 'Refund is handled by payment service.',
    });

    const dismissInsight = await prisma.baInsight.create({
      data: {
        impactAnalysisId: analysisId,
        insightKey: 'unknown-refund-trigger',
        insightType: 'UNKNOWN',
        certainty: 'UNKNOWN',
        reviewStatus: 'NEEDS_REVIEW',
        title: 'What triggers the refund?',
        description: 'The payment trigger is unknown.',
      },
    });
    const dismissCreate = await request(app.getHttpServer())
      .post(`/api/v1/impact-analyses/${analysisId}/clarifications`)
      .set('Authorization', `Bearer ${reviewerToken}`)
      .send({ sourceInsightId: dismissInsight.id })
      .expect(201);
    const dismissItem = ClarificationItemDtoSchema.parse(dismissCreate.body);
    const dismissRes = await request(app.getHttpServer())
      .patch(`/api/v1/clarifications/${dismissItem.id}/dismiss`)
      .set('Authorization', `Bearer ${reviewerToken}`)
      .send({ reason: 'Resolved by the payment owner.' })
      .expect(200);
    expect(ClarificationItemDtoSchema.parse(dismissRes.body)).toMatchObject({
      id: dismissItem.id,
      status: 'DISMISSED',
    });

    const listRes = await request(app.getHttpServer())
      .get(`/api/v1/impact-analyses/${analysisId}/clarifications`)
      .set('Authorization', `Bearer ${reviewerToken}`)
      .expect(200);
    expect(ClarificationListResponseSchema.parse(listRes.body).items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: created.id, status: 'ANSWERED' }),
        expect.objectContaining({ id: dismissItem.id, status: 'DISMISSED' }),
      ]),
    );
  });

  it('keeps convert-to-revision admin-only and review notes reviewer-capable', async () => {
    const { analysisId, insightId } = await seedAnalysisGraph('WAITING_FOR_REVIEW');

    const clarification = await prisma.clarificationItem.create({
      data: {
        impactAnalysisId: analysisId,
        sourceInsightId: insightId,
        question: 'How is refund triggered?',
        answer: 'Refund is triggered after cancellation succeeds.',
        status: 'ANSWERED',
      },
    });

    await request(app.getHttpServer())
      .post(`/api/v1/clarifications/${clarification.id}/convert-to-revision`)
      .set('Authorization', `Bearer ${reviewerToken}`)
      .send({})
      .expect(403);

    const convertRes = await request(app.getHttpServer())
      .post(`/api/v1/clarifications/${clarification.id}/convert-to-revision`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({})
      .expect(201);
    expect(ConvertClarificationResponseSchema.parse(convertRes.body)).toMatchObject({
      clarificationId: clarification.id,
      requirementId: expect.any(String),
      revisionId: expect.any(String),
      status: 'CONVERTED_TO_REVISION',
    });

    await request(app.getHttpServer())
      .post(`/api/v1/impact-analyses/${analysisId}/review-notes`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({ insightId, body: 'Viewer note should be forbidden' })
      .expect(403);

    const noteRes = await request(app.getHttpServer())
      .post(`/api/v1/impact-analyses/${analysisId}/review-notes`)
      .set('Authorization', `Bearer ${reviewerToken}`)
      .send({ insightId, body: 'Reviewer note is allowed' })
      .expect(200);

    expect(noteRes.body.body).toBe('Reviewer note is allowed');
  });

  it('serves review clarification routes under /api/v1 and enforces reviewer/admin roles', async () => {
    const { analysisId } = await seedAnalysisGraph('WAITING_FOR_REVIEW');
    const adminUser = await prisma.user.findUniqueOrThrow({
      where: { email: 'admin@ba-helper.local' },
    });

    const reviewDecision = await prisma.analysisReviewDecision.create({
      data: {
        id: crypto.randomUUID(),
        analysisId,
        decision: 'NEEDS_MORE_CLARIFICATION',
        reviewedByUserId: adminUser.id,
      },
    });

    await request(app.getHttpServer())
      .post(`/api/v1/impact-analyses/${analysisId}/review-clarifications`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({ reviewDecisionId: reviewDecision.id, question: 'What triggers refund creation?' })
      .expect(403);

    const createRes = await request(app.getHttpServer())
      .post(`/api/v1/impact-analyses/${analysisId}/review-clarifications`)
      .set('Authorization', `Bearer ${reviewerToken}`)
      .send({ reviewDecisionId: reviewDecision.id, question: 'What triggers refund creation?' })
      .expect(201);

    const created = reviewClarificationRequestSchema.parse(createRes.body);
    expect(created).toMatchObject({
      analysisId,
      reviewDecisionId: reviewDecision.id,
      question: 'What triggers refund creation?',
      status: 'OPEN',
    });

    const listRes = await request(app.getHttpServer())
      .get(`/api/v1/impact-analyses/${analysisId}/review-clarifications`)
      .set('Authorization', `Bearer ${reviewerToken}`)
      .expect(200);
    expect(reviewClarificationListResponseSchema.parse(listRes.body).items).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: created.id })]),
    );

    const answerRes = await request(app.getHttpServer())
      .post(`/api/v1/review-clarifications/${created.id}/answer`)
      .set('Authorization', `Bearer ${reviewerToken}`)
      .send({ answer: 'The refund starts after payment reversal.' })
      .expect(201);
    expect(reviewClarificationRequestSchema.parse(answerRes.body)).toMatchObject({
      id: created.id,
      answer: 'The refund starts after payment reversal.',
      status: 'ANSWERED',
    });
  });

  it('keeps approved report endpoints authenticated and exportable for viewers', async () => {
    const { analysisId } = await seedAnalysisGraph('COMPLETED');

    await prisma.generatedDocument.create({
      data: {
        id: crypto.randomUUID(),
        impactAnalysisId: analysisId,
        type: 'IMPACT_REPORT',
        status: 'APPROVED',
        content: '# Approved report\n\n## Evidence Appendix\n\n- persisted',
      },
    });

    await request(app.getHttpServer())
      .get(`/api/v1/impact-analyses/${analysisId}/approved-report`)
      .expect(401);

    await request(app.getHttpServer())
      .get(`/api/v1/impact-analyses/${analysisId}/approved-report/export.md`)
      .expect(401);

    await request(app.getHttpServer())
      .get(`/api/v1/impact-analyses/${analysisId}/approved-report`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .expect(200);

    const markdownExport = await request(app.getHttpServer())
      .get(`/api/v1/impact-analyses/${analysisId}/approved-report/export.md`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .expect(200);

    expect(markdownExport.headers['content-type']).toContain('text/markdown');

    const pdfExport = await request(app.getHttpServer())
      .get(`/api/v1/impact-analyses/${analysisId}/approved-report/export.pdf`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .set('Origin', 'https://web.example.test')
      .expect(200);

    expect(pdfExport.headers['content-type']).toContain('application/pdf');
    expect(pdfExport.headers['content-disposition']).toContain('.pdf');
    expect(pdfExport.headers['access-control-allow-origin']).toBe('https://web.example.test');
    expect(pdfExport.headers['access-control-expose-headers']).toContain('Content-Disposition');
  });

  it('keeps requirement reads and writes in project scope and matches shared response contracts', async () => {
    const projectId = crypto.randomUUID();
    const peerProjectId = crypto.randomUUID();
    const hiddenProjectId = crypto.randomUUID();

    await Promise.all([
      prisma.project.create({ data: { id: projectId, name: 'Requirements Project' } }),
      prisma.project.create({ data: { id: peerProjectId, name: 'Peer Requirements Project' } }),
      prisma.project.create({ data: { id: hiddenProjectId, name: 'Hidden Requirements Project' } }),
    ]);
    await Promise.all([
      ...[projectId, peerProjectId, hiddenProjectId].map((id) =>
        grantProjectMembership(prisma, {
          projectId: id,
          userId: adminUserId,
          role: 'OWNER',
        }),
      ),
      ...[projectId, peerProjectId].map((id) =>
        grantProjectMembership(prisma, {
          projectId: id,
          userId: viewerUserId,
          role: 'VIEWER',
        }),
      ),
    ]);

    const seedRequirement = async (scopeProjectId: string, title: string) => {
      const requirementId = crypto.randomUUID();
      const revisionId = crypto.randomUUID();
      await prisma.requirement.create({ data: { id: requirementId, projectId: scopeProjectId } });
      await prisma.requirementRevision.create({
        data: {
          id: revisionId,
          requirementId,
          title,
          rawText: 'Allow users to cancel paid bookings and receive a refund.',
          normalizedText: 'Allow users to cancel paid bookings and receive a refund.',
          readinessStatus: 'READY_FOR_ANALYSIS',
        },
      });
      return { requirementId, revisionId };
    };

    const peerRequirement = await seedRequirement(peerProjectId, 'Peer requirement');
    const hiddenRequirement = await seedRequirement(hiddenProjectId, 'Hidden requirement');

    const createResponse = await request(app.getHttpServer())
      .post(`/api/v1/projects/${projectId}/requirements`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        requestKey: crypto.randomUUID(),
        title: 'Cancel paid booking',
        rawText: 'Allow users to cancel paid bookings and receive a refund.',
        submitForReadinessCheck: false,
      })
      .expect(201);
    const created = requirementCreateResponseSchema.parse(createResponse.body);
    expect(created.readinessStatus).toBe('DRAFT');

    const revisionResponse = await request(app.getHttpServer())
      .post(`/api/v1/requirements/${created.requirementId}/revisions`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Cancel paid booking and issue a refund',
        rawText: 'Allow users to cancel paid bookings and receive a refund.',
        submitForReadinessCheck: true,
      })
      .expect(201);
    const revision = requirementRevisionCreateResponseSchema.parse(revisionResponse.body);

    const qualifyResponse = await request(app.getHttpServer())
      .post(`/api/v1/requirement-revisions/${revision.revisionId}/qualify`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(201);
    expect(requirementRevisionQualifyResponseSchema.parse(qualifyResponse.body).readinessStatus)
      .toBe('READY_FOR_ANALYSIS');

    const listResponse = await request(app.getHttpServer())
      .get(`/api/v1/projects/${projectId}/requirements`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .expect(200);
    const list = requirementListResponseSchema.parse(listResponse.body);
    const createdItem = list.items.find((item) => item.id === created.requirementId);
    expect(createdItem?.latestRevision).toMatchObject({
      id: revision.revisionId,
      versionNumber: 2,
      title: 'Cancel paid booking and issue a refund',
      readinessStatus: 'READY_FOR_ANALYSIS',
    });
    expect(createdItem?.canStartAnalysis).toBe(true);

    const detailResponse = await request(app.getHttpServer())
      .get(`/api/v1/projects/${projectId}/requirements/${created.requirementId}`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .expect(200);
    expect(requirementDetailResponseSchema.parse(detailResponse.body).revisions)
      .toHaveLength(2);

    await request(app.getHttpServer())
      .get(`/api/v1/projects/${projectId}/requirements/${peerRequirement.requirementId}`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .expect(404);
    await request(app.getHttpServer())
      .get(`/api/v1/projects/${hiddenProjectId}/requirements`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .expect(404);
    await request(app.getHttpServer())
      .post(`/api/v1/projects/${hiddenProjectId}/requirements`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({ requestKey: crypto.randomUUID(), title: 'Hidden write', rawText: 'Allow paid booking cancellation with a refund.' })
      .expect(404);
    await request(app.getHttpServer())
      .post(`/api/v1/requirements/${hiddenRequirement.requirementId}/revisions`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({ title: 'Hidden revision', rawText: 'Allow paid booking cancellation with a refund.' })
      .expect(404);
    await request(app.getHttpServer())
      .post(`/api/v1/requirement-revisions/${hiddenRequirement.revisionId}/qualify`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .expect(404);
    await request(app.getHttpServer())
      .post(`/api/v1/projects/${projectId}/requirements`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({ requestKey: crypto.randomUUID(), title: 'Read only write', rawText: 'Allow paid booking cancellation with a refund.' })
      .expect(403);
  });

  it('does not persist a requirement when its creation audit event fails', async () => {
    const projectId = crypto.randomUUID();
    await prisma.project.create({ data: { id: projectId, name: 'Atomic Requirement Project' } });
    await grantProjectMembership(prisma, {
      projectId,
      userId: adminUserId,
      role: 'OWNER',
    });

    const eventSpy = jest.spyOn(EventLogService.prototype, 'recordEvent')
      .mockRejectedValue(new Error('event storage unavailable'));
    try {
      await request(app.getHttpServer())
        .post(`/api/v1/projects/${projectId}/requirements`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          requestKey: crypto.randomUUID(),
          title: 'Cancel paid booking',
          rawText: 'Allow users to cancel paid bookings and receive a refund.',
          submitForReadinessCheck: true,
        })
        .expect(500);

      const listResponse = await request(app.getHttpServer())
        .get(`/api/v1/projects/${projectId}/requirements`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect({
        requirements: requirementListResponseSchema.parse(listResponse.body).items.length,
        domainEvents: await prisma.domainEvent.count(),
      }).toEqual({ requirements: 0, domainEvents: 0 });
      expect(eventSpy).toHaveBeenCalledTimes(1);
    } finally {
      eventSpy.mockRestore();
    }
  });

  it('projects persisted event identity through the strict event-log response contract', async () => {
    const scoped = await seedAnalysisGraph();
    await prisma.domainEvent.create({
      data: {
        eventType: 'ANALYSIS_FINALIZED',
        idempotencyKey: `analysis:${scoped.analysisId}:actor-contract-probe`,
        payload: {
          actorType: 'LEGACY_INVALID',
          actorUserId: adminUserId,
          actorName: 'Admin',
          triggeredByUserId: adminUserId,
        },
      },
    });

    const response = await request(app.getHttpServer())
      .get(`/api/v1/impact-analyses/${scoped.analysisId}/events`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const events = eventLogListResponseSchema.parse(response.body);

    expect(events.items).toEqual([
      expect.objectContaining({
        eventType: 'ANALYSIS_FINALIZED',
        actorType: 'USER',
        actorName: 'Admin',
        triggeredByUserId: adminUserId,
      }),
    ]);
  });

  it('preserves system and user actors from the event writer through the API DTO', async () => {
    const scoped = await seedAnalysisGraph();
    const prefix = `impact:${scoped.analysisId}:actor-matrix`;
    const eventLog = app.get(EventLogService);

    await eventLog.recordEvent({
      eventType: 'ANALYSIS_FINALIZED',
      idempotencyKey: `${prefix}:writer-system`,
      payload: { actorName: 'Background worker' },
    });
    await eventLog.recordEvent({
      eventType: 'ANALYSIS_FINALIZED',
      idempotencyKey: `${prefix}:writer-user`,
      payload: { actorType: 'USER', actorName: 'Admin' },
      actorUserId: adminUserId,
    });
    await prisma.domainEvent.createMany({
      data: [
        {
          eventType: 'ANALYSIS_FINALIZED',
          idempotencyKey: `${prefix}:legacy-lowercase-system`,
          payload: { actorUserId: 'system' },
        },
        {
          eventType: 'ANALYSIS_FINALIZED',
          idempotencyKey: `${prefix}:legacy-missing-actor`,
          payload: {},
        },
      ],
    });

    const response = await request(app.getHttpServer())
      .get(`/api/v1/impact-analyses/${scoped.analysisId}/events`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const events = eventLogListResponseSchema.parse(response.body).items;
    const actorsByKey = Object.fromEntries(
      events.map((event) => [event.idempotencyKey, event.actorType]),
    );

    expect(actorsByKey).toMatchObject({
      [`${prefix}:writer-system`]: 'SYSTEM',
      [`${prefix}:writer-user`]: 'USER',
      [`${prefix}:legacy-lowercase-system`]: 'SYSTEM',
      [`${prefix}:legacy-missing-actor`]: 'SYSTEM',
    });
    expect(events.every((event) =>
      !Object.prototype.hasOwnProperty.call(event, 'actorUserId'),
    )).toBe(true);
  });

  it('rejects an analysis event payload outside the shared response contract', async () => {
    const { analysisId } = await seedAnalysisGraph();
    const invalidEvents = [{
      id: crypto.randomUUID(),
      eventType: 'ANALYSIS_FINALIZED',
      idempotencyKey: `analysis:${analysisId}:invalid-contract`,
      actorType: 'AUTOMATION',
      metadata: {},
      createdAt: new Date().toISOString(),
    }] as unknown as Awaited<ReturnType<EventLogService['getAnalysisEvents']>>;
    const eventSpy = jest.spyOn(EventLogService.prototype, 'getAnalysisEvents')
      .mockResolvedValueOnce(invalidEvents);

    try {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/impact-analyses/${analysisId}/events`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(eventSpy).toHaveBeenCalledTimes(1);
      expect(response.status).toBe(500);
    } finally {
      eventSpy.mockRestore();
    }
  });

  it('reuses one requirement when the same create request is retried concurrently', async () => {
    const projectId = crypto.randomUUID();
    await prisma.project.create({ data: { id: projectId, name: 'Idempotent Requirements Project' } });
    await grantProjectMembership(prisma, {
      projectId,
      userId: adminUserId,
      role: 'OWNER',
    });
    const payload = {
      requestKey: crypto.randomUUID(),
      title: 'Cancel paid booking',
      rawText: 'Allow users to cancel paid bookings and receive a refund.',
      submitForReadinessCheck: true,
    };

    const [firstResponse, retryResponse] = await Promise.all([
      request(app.getHttpServer())
        .post(`/api/v1/projects/${projectId}/requirements`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(payload),
      request(app.getHttpServer())
        .post(`/api/v1/projects/${projectId}/requirements`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(payload),
    ]);

    expect(firstResponse.status).toBe(201);
    expect(retryResponse.status).toBe(201);
    const first = requirementCreateResponseSchema.parse(firstResponse.body);
    const retry = requirementCreateResponseSchema.parse(retryResponse.body);
    expect(retry).toEqual(first);
    expect(await prisma.requirement.count({ where: { projectId } })).toBe(1);
  });

  it('rejects reusing a requirement request key with a different payload', async () => {
    const projectId = crypto.randomUUID();
    await prisma.project.create({ data: { id: projectId, name: 'Requirement Request Key Project' } });
    await grantProjectMembership(prisma, {
      projectId,
      userId: adminUserId,
      role: 'OWNER',
    });
    const requestKey = crypto.randomUUID();
    const path = `/api/v1/projects/${projectId}/requirements`;

    await request(app.getHttpServer())
      .post(path)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        requestKey,
        title: 'Cancel paid booking',
        rawText: 'Allow users to cancel paid bookings and receive a refund.',
        submitForReadinessCheck: true,
      })
      .expect(201);

    const mismatch = await request(app.getHttpServer())
      .post(path)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        requestKey,
        title: 'Cancel an unpaid booking',
        rawText: 'Allow users to cancel paid bookings and receive a refund.',
        submitForReadinessCheck: true,
      })
      .expect(409);
    expect(mismatch.body.code).toBe('REQUEST_KEY_MISMATCH');
    expect(await prisma.requirement.count({ where: { projectId } })).toBe(1);
  });

  it('returns 404 for cross-project analysis reads and exports outside membership scope', async () => {
    const projectId = crypto.randomUUID();
    const repositoryId = crypto.randomUUID();
    const targetId = crypto.randomUUID();
    const snapshotId = crypto.randomUUID();
    const requirementId = crypto.randomUUID();
    const revisionId = crypto.randomUUID();
    const analysisId = crypto.randomUUID();

    await prisma.project.create({ data: { id: projectId, name: 'Hidden Project' } });
    await grantProjectMembership(prisma, {
      projectId,
      userId: adminUserId,
      role: 'OWNER',
    });
    await prisma.repository.create({
      data: {
        id: repositoryId,
        projectId,
        canonicalUrl: 'https://github.com/example/hidden',
      },
    });
    await prisma.repositoryTarget.create({
      data: {
        id: targetId,
        repositoryId,
        targetKey: 'main',
        requestedRef: 'main',
        resolvedRefType: 'BRANCH',
        latestObservedCommitSha: 'abc1234',
        lastObservedAt: new Date(),
      },
    });
    await prisma.repositorySnapshot.create({
      data: {
        id: snapshotId,
        repositoryId,
        commitSha: 'abc1234',
        analyzerVersion: '1.0.0',
        coverageStatus: 'READY',
      },
    });
    await prisma.requirement.create({
      data: {
        id: requirementId,
        projectId,
      },
    });
    await prisma.requirementRevision.create({
      data: {
        id: revisionId,
        requirementId,
        title: 'Restricted report',
        rawText: 'restricted',
        normalizedText: 'restricted',
        readinessStatus: 'READY_FOR_ANALYSIS',
      },
    });
    await prisma.impactAnalysis.create({
      data: {
        id: analysisId,
        requirementRevisionId: revisionId,
        requirementId,
        projectId,
        repositoryId,
        snapshotId,
        sourceTargetId: targetId,
        requestKey: crypto.randomUUID(),
        status: 'COMPLETED',
        stage: 'DONE',
      },
    });
    await prisma.generatedDocument.create({
      data: {
        id: crypto.randomUUID(),
        impactAnalysisId: analysisId,
        type: 'IMPACT_REPORT',
        status: 'APPROVED',
        content: '# Restricted report',
      },
    });

    await request(app.getHttpServer())
      .get(`/api/v1/impact-analyses/${analysisId}`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .expect(404);

    await request(app.getHttpServer())
      .get(`/api/v1/impact-analyses/${analysisId}/documents`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .expect(404);
    await request(app.getHttpServer())
      .get(`/api/v1/impact-analyses/${analysisId}/approved-report`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .expect(404);
    await request(app.getHttpServer())
      .get(`/api/v1/impact-analyses/${analysisId}/approved-report/export.md`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .expect(404);
    await request(app.getHttpServer())
      .get(`/api/v1/impact-analyses/${analysisId}/approved-report/export.pdf`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .expect(404);
    await request(app.getHttpServer())
      .get(`/api/v1/impact-analyses/${analysisId}/reviewed-report-snapshot/latest`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .expect(404);
    await request(app.getHttpServer())
      .get(`/api/v1/impact-analyses/${analysisId}/final-reviewed-report?locale=vi-VN`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .expect(404);
    await request(app.getHttpServer())
      .get(`/api/v1/impact-analyses/${analysisId}/review-notes`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .expect(404);
    await request(app.getHttpServer())
      .get(`/api/v1/analyses/${analysisId}/localization/vi-VN/status`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .expect(404);
  });

  it('blocks cross-project report, note, and localization mutations before persistence', async () => {
    const scoped = await seedAnalysisGraph();
    const outsiderProjectId = crypto.randomUUID();
    const outsider = await prisma.user.create({
      data: {
        id: crypto.randomUUID(),
        email: 'report-scope-outsider@ba-helper.local',
        name: 'Report Scope Outsider',
        role: 'ADMIN',
      },
    });
    await prisma.project.create({
      data: { id: outsiderProjectId, name: 'Report Outsider Project' },
    });
    await grantProjectMembership(prisma, {
      projectId: outsiderProjectId,
      userId: outsider.id,
      role: 'OWNER',
    });
    const auth = {
      Authorization: `Bearer ${jwtService.sign({
        sub: outsider.id,
        email: outsider.email,
        role: outsider.role,
      })}`,
    };

    await request(app.getHttpServer())
      .post(`/api/v1/impact-analyses/${scoped.analysisId}/reviewed-report-snapshot`)
      .set(auth)
      .expect(404);
    await request(app.getHttpServer())
      .post(`/api/v1/impact-analyses/${scoped.analysisId}/document-jobs`)
      .set(auth)
      .send({ requestKey: crypto.randomUUID() })
      .expect(404);
    await request(app.getHttpServer())
      .post(`/api/v1/impact-analyses/${scoped.analysisId}/review-notes`)
      .set(auth)
      .send({ insightId: scoped.insightId, body: 'Cross-project note.' })
      .expect(404);
    await request(app.getHttpServer())
      .post(`/api/v1/analyses/${scoped.analysisId}/localization`)
      .set(auth)
      .send({ locale: 'vi-VN' })
      .expect(404);

    expect(await prisma.reviewedReportSnapshot.count({
      where: { analysisId: scoped.analysisId },
    })).toBe(0);
    expect(await prisma.documentJob.count({
      where: { analysisId: scoped.analysisId },
    })).toBe(0);
    expect(await prisma.reviewNote.count({
      where: { impactAnalysisId: scoped.analysisId },
    })).toBe(0);
    expect(await prisma.localizedReportArtifact.count()).toBe(0);
  });

  it('returns 404 for cross-project review mutation even when global reviewer role matches', async () => {
    const { analysisId } = await seedAnalysisGraph('COMPLETED');
    const outsiderProjectId = crypto.randomUUID();

    await prisma.project.create({
      data: { id: outsiderProjectId, name: 'Reviewer Own Project' },
    });
    await grantProjectMembership(prisma, {
      projectId: outsiderProjectId,
      userId: reviewerUserId,
      role: 'REVIEWER',
    });

    await request(app.getHttpServer())
      .post(`/api/v1/impact-analyses/${analysisId}/review-decisions`)
      .set('Authorization', `Bearer ${reviewerToken}`)
      .send({ decision: 'ACCEPTED' })
      .expect(201);

    const hiddenProjectId = crypto.randomUUID();
    const hiddenRepositoryId = crypto.randomUUID();
    const hiddenTargetId = crypto.randomUUID();
    const hiddenSnapshotId = crypto.randomUUID();
    const hiddenRequirementId = crypto.randomUUID();
    const hiddenRevisionId = crypto.randomUUID();
    const hiddenAnalysisId = crypto.randomUUID();

    await prisma.project.create({
      data: { id: hiddenProjectId, name: 'Hidden Review Project' },
    });
    await grantProjectMembership(prisma, {
      projectId: hiddenProjectId,
      userId: adminUserId,
      role: 'OWNER',
    });
    await prisma.repository.create({
      data: {
        id: hiddenRepositoryId,
        projectId: hiddenProjectId,
        canonicalUrl: 'https://github.com/example/hidden-review',
      },
    });
    await prisma.repositoryTarget.create({
      data: {
        id: hiddenTargetId,
        repositoryId: hiddenRepositoryId,
        targetKey: 'main',
        requestedRef: 'main',
        resolvedRefType: 'BRANCH',
        latestObservedCommitSha: 'hidden123',
        lastObservedAt: new Date(),
      },
    });
    await prisma.repositorySnapshot.create({
      data: {
        id: hiddenSnapshotId,
        repositoryId: hiddenRepositoryId,
        commitSha: 'hidden123',
        analyzerVersion: '1.0.0',
        coverageStatus: 'READY',
      },
    });
    await prisma.requirement.create({
      data: {
        id: hiddenRequirementId,
        projectId: hiddenProjectId,
      },
    });
    await prisma.requirementRevision.create({
      data: {
        id: hiddenRevisionId,
        requirementId: hiddenRequirementId,
        title: 'Hidden review',
        rawText: 'Hidden review',
        normalizedText: 'Hidden review',
        readinessStatus: 'READY_FOR_ANALYSIS',
      },
    });
    await prisma.impactAnalysis.create({
      data: {
        id: hiddenAnalysisId,
        requirementRevisionId: hiddenRevisionId,
        requirementId: hiddenRequirementId,
        projectId: hiddenProjectId,
        repositoryId: hiddenRepositoryId,
        snapshotId: hiddenSnapshotId,
        sourceTargetId: hiddenTargetId,
        requestKey: crypto.randomUUID(),
        status: 'COMPLETED',
        stage: 'DONE',
      },
    });

    const hiddenDecisionCountBefore = await prisma.analysisReviewDecision.count({
      where: { analysisId: hiddenAnalysisId },
    });
    const domainEventCountBefore = await prisma.domainEvent.count();

    await request(app.getHttpServer())
      .post(`/api/v1/impact-analyses/${hiddenAnalysisId}/review-decisions`)
      .set('Authorization', `Bearer ${reviewerToken}`)
      .send({ decision: 'REJECTED' })
      .expect(404);

    await expect(prisma.analysisReviewDecision.count({
      where: { analysisId: hiddenAnalysisId },
    })).resolves.toBe(hiddenDecisionCountBefore);
    await expect(prisma.domainEvent.count()).resolves.toBe(domainEventCountBefore);
    await expect(prisma.impactAnalysis.findUniqueOrThrow({
      where: { id: hiddenAnalysisId },
      select: { status: true },
    })).resolves.toEqual({ status: 'COMPLETED' });
  });

  it('denies cross-project insight and traceability reads and review mutations', async () => {
    const scoped = await seedAnalysisGraph('WAITING_FOR_REVIEW');
    const outsiderProjectId = crypto.randomUUID();
    const outsider = await prisma.user.create({
      data: {
        id: crypto.randomUUID(),
        email: 'cross-project-outsider@ba-helper.local',
        name: 'Cross Project Outsider',
        role: 'ADMIN',
      },
    });
    await prisma.project.create({
      data: { id: outsiderProjectId, name: 'Outsider Project' },
    });
    await grantProjectMembership(prisma, {
      projectId: outsiderProjectId,
      userId: outsider.id,
      role: 'OWNER',
    });
    const outsiderToken = jwtService.sign({
      sub: outsider.id,
      email: outsider.email,
      role: outsider.role,
    });
    const auth = { Authorization: `Bearer ${outsiderToken}` };

    await request(app.getHttpServer())
      .get(`/api/v1/impact-analyses/${scoped.analysisId}/insights`)
      .set(auth)
      .expect(404);
    await request(app.getHttpServer())
      .get(`/api/v1/impact-analyses/${scoped.analysisId}/traceability`)
      .set(auth)
      .expect(404);
    await request(app.getHttpServer())
      .post(`/api/v1/insights/${scoped.insightId}/confirm`)
      .set(auth)
      .expect(404);
    await request(app.getHttpServer())
      .post(`/api/v1/insights/${scoped.insightId}/reject`)
      .set(auth)
      .expect(404);
    await request(app.getHttpServer())
      .post(`/api/v1/insights/${scoped.insightId}/review`)
      .set(auth)
      .send({ reviewStatus: 'CONFIRMED' })
      .expect(404);
    await request(app.getHttpServer())
      .post(`/api/v1/traceability-links/${scoped.linkId}/confirm`)
      .set(auth)
      .expect(404);
    await request(app.getHttpServer())
      .post(`/api/v1/traceability-links/${scoped.linkId}/reject`)
      .set(auth)
      .expect(404);
    await request(app.getHttpServer())
      .post(`/api/v1/traceability-links/${scoped.linkId}/review`)
      .set(auth)
      .send({ reviewStatus: 'CONFIRMED' })
      .expect(404);
    await request(app.getHttpServer())
      .put(`/api/v1/traceability-links/${scoped.linkId}/review-decision`)
      .set(auth)
      .send({ decision: 'ACCEPTED', note: 'Cross-project attempt.' })
      .expect(404);
    await request(app.getHttpServer())
      .delete(`/api/v1/traceability-links/${scoped.linkId}/review-decision`)
      .set(auth)
      .expect(404);
    await request(app.getHttpServer())
      .post(`/api/v1/impact-analyses/${scoped.analysisId}/review-decisions`)
      .set(auth)
      .send({ decision: 'ACCEPTED' })
      .expect(404);
    await request(app.getHttpServer())
      .post(`/api/v1/impact-analyses/${scoped.analysisId}/finalize`)
      .set(auth)
      .send({ acknowledgeUnreviewed: true })
      .expect(404);
    await request(app.getHttpServer())
      .put(`/api/v1/impact-analyses/${scoped.analysisId}/review-items/${scoped.insightId}/decision`)
      .set(auth)
      .send({ target: 'insight', action: 'accept', rationale: 'Cross-project attempt.', requestKey: crypto.randomUUID() })
      .expect(404);
    await request(app.getHttpServer())
      .put(`/api/v1/impact-analyses/${scoped.analysisId}/review-items/${scoped.linkId}/decision`)
      .set(auth)
      .send({ target: 'impact', action: 'accept', rationale: 'Cross-project attempt.', requestKey: crypto.randomUUID() })
      .expect(404);

    expect(await prisma.baInsight.findUnique({
      where: { id: scoped.insightId },
      select: { reviewStatus: true },
    })).toEqual({ reviewStatus: 'NEEDS_REVIEW' });
    expect(await prisma.traceabilityLink.findUnique({
      where: { id: scoped.linkId },
      select: { reviewStatus: true },
    })).toEqual({ reviewStatus: 'NEEDS_REVIEW' });
    expect(await prisma.traceabilityReviewDecision.findUnique({
      where: { traceabilityLinkId: scoped.linkId },
    })).toBeNull();
    expect(await prisma.analysisReviewDecision.count({
      where: { analysisId: scoped.analysisId },
    })).toBe(0);
    expect(await prisma.impactAnalysis.findUniqueOrThrow({
      where: { id: scoped.analysisId },
      select: { status: true },
    })).toEqual({ status: 'WAITING_FOR_REVIEW' });
  });

  it('rejects cross-project repository IDs in repository, snapshot, and scan-job routes', async () => {
    const scoped = await seedAnalysisGraph();
    const snapshot = await prisma.repositorySnapshot.findUniqueOrThrow({
      where: { id: scoped.snapshotId },
      select: { repositoryId: true },
    });
    const scanJob = await prisma.scanJob.create({
      data: {
        id: crypto.randomUUID(),
        repositoryId: snapshot.repositoryId,
        requestKey: crypto.randomUUID(),
        requestedRef: 'main',
        status: 'QUEUED',
        stage: 'WAITING',
      },
    });
    const outsiderProjectId = crypto.randomUUID();
    const outsider = await prisma.user.create({
      data: {
        id: crypto.randomUUID(),
        email: 'repository-scope-outsider@ba-helper.local',
        name: 'Repository Scope Outsider',
        role: 'ADMIN',
      },
    });
    await prisma.project.create({
      data: { id: outsiderProjectId, name: 'Repository Outsider Project' },
    });
    await grantProjectMembership(prisma, {
      projectId: outsiderProjectId,
      userId: outsider.id,
      role: 'OWNER',
    });
    const auth = {
      Authorization: `Bearer ${jwtService.sign({
        sub: outsider.id,
        email: outsider.email,
        role: outsider.role,
      })}`,
    };
    const repositoryPath = `/api/v1/projects/${outsiderProjectId}/repositories/${snapshot.repositoryId}`;

    await request(app.getHttpServer())
      .get(`/api/v1/projects/${scoped.projectId}/repositories`)
      .set(auth)
      .expect(404);
    const repositoryCountBefore = await prisma.repository.count();
    await request(app.getHttpServer())
      .post(`/api/v1/projects/${scoped.projectId}/repositories`)
      .set(auth)
      .send({ url: 'https://github.com/example/unauthorized-repository' })
      .expect(404);
    expect(await prisma.repository.count()).toBe(repositoryCountBefore);
    await request(app.getHttpServer())
      .get(repositoryPath)
      .set(auth)
      .expect(404);
    await request(app.getHttpServer())
      .get(`${repositoryPath}/snapshots`)
      .set(auth)
      .expect(404);
    await request(app.getHttpServer())
      .get(`${repositoryPath}/snapshots/${scoped.snapshotId}/drift`)
      .set(auth)
      .expect(404);
    const scanJobPath = `/api/v1/repositories/${snapshot.repositoryId}/scan-jobs/${scanJob.id}`;
    await request(app.getHttpServer())
      .get(scanJobPath)
      .set(auth)
      .expect(404);
    await request(app.getHttpServer())
      .get(`${scanJobPath}/events`)
      .set(auth)
      .expect(404);
    const scanJobCountBefore = await prisma.scanJob.count();
    await request(app.getHttpServer())
      .post(`/api/v1/repositories/${snapshot.repositoryId}/scan-jobs`)
      .set(auth)
      .send({ requestKey: crypto.randomUUID(), ref: 'main' })
      .expect(404);
    expect(await prisma.scanJob.count()).toBe(scanJobCountBefore);
  });

  it('denies cross-project access to analysis and review clarification IDs', async () => {
    const scoped = await seedAnalysisGraph();
    const clarification = await prisma.clarificationItem.create({
      data: {
        id: crypto.randomUUID(),
        impactAnalysisId: scoped.analysisId,
        sourceInsightId: scoped.insightId,
        question: 'Which refund path applies?',
      },
    });
    const reviewDecision = await prisma.analysisReviewDecision.create({
      data: {
        id: crypto.randomUUID(),
        analysisId: scoped.analysisId,
        decision: 'ACCEPTED',
        reviewedByUserId: adminUserId,
      },
    });
    const reviewClarification = await prisma.reviewClarificationRequest.create({
      data: {
        id: crypto.randomUUID(),
        analysisId: scoped.analysisId,
        reviewDecisionId: reviewDecision.id,
        question: 'Confirm the refund boundary.',
        createdByUserId: adminUserId,
      },
    });
    const outsiderProjectId = crypto.randomUUID();
    const outsider = await prisma.user.create({
      data: {
        id: crypto.randomUUID(),
        email: 'clarification-outsider@ba-helper.local',
        name: 'Clarification Outsider',
        role: 'ADMIN',
      },
    });
    await prisma.project.create({
      data: { id: outsiderProjectId, name: 'Clarification Outsider Project' },
    });
    await grantProjectMembership(prisma, {
      projectId: outsiderProjectId,
      userId: outsider.id,
      role: 'OWNER',
    });
    const auth = {
      Authorization: `Bearer ${jwtService.sign({
        sub: outsider.id,
        email: outsider.email,
        role: outsider.role,
      })}`,
    };

    await request(app.getHttpServer())
      .get(`/api/v1/impact-analyses/${scoped.analysisId}/clarifications`)
      .set(auth)
      .expect(404);
    const clarificationCountBefore = await prisma.clarificationItem.count();
    const analysisCountBefore = await prisma.impactAnalysis.count();
    const reviewClarificationCountBefore = await prisma.reviewClarificationRequest.count();
    await request(app.getHttpServer())
      .post(`/api/v1/impact-analyses/${scoped.analysisId}/clarifications`)
      .set(auth)
      .send({ sourceInsightId: scoped.insightId })
      .expect(404);
    await request(app.getHttpServer())
      .patch(`/api/v1/clarifications/${clarification.id}/answer`)
      .set(auth)
      .send({ answer: 'Use the payment service.' })
      .expect(404);
    await request(app.getHttpServer())
      .patch(`/api/v1/clarifications/${clarification.id}/dismiss`)
      .set(auth)
      .send({ reason: 'Cross-project attempt.' })
      .expect(404);
    await request(app.getHttpServer())
      .post(`/api/v1/clarifications/${clarification.id}/convert-to-revision`)
      .set(auth)
      .expect(404);
    await request(app.getHttpServer())
      .get(`/api/v1/impact-analyses/${scoped.analysisId}/review-clarifications`)
      .set(auth)
      .expect(404);
    await request(app.getHttpServer())
      .post(`/api/v1/impact-analyses/${scoped.analysisId}/review-clarifications`)
      .set(auth)
      .send({ reviewDecisionId: reviewDecision.id, question: 'Cross-project attempt.' })
      .expect(404);
    await request(app.getHttpServer())
      .post(`/api/v1/review-clarifications/${reviewClarification.id}/answer`)
      .set(auth)
      .send({ answer: 'Use the payment service.' })
      .expect(404);
    await request(app.getHttpServer())
      .post(`/api/v1/review-clarifications/${reviewClarification.id}/derived-analyses`)
      .set(auth)
      .expect(404);

    expect(await prisma.clarificationItem.findUnique({
      where: { id: clarification.id },
      select: { answer: true, status: true },
    })).toEqual({ answer: null, status: 'OPEN' });
    expect(await prisma.reviewClarificationRequest.findUnique({
      where: { id: reviewClarification.id },
      select: { answer: true, status: true },
    })).toEqual({ answer: null, status: 'OPEN' });
    expect(await prisma.clarificationItem.count()).toBe(clarificationCountBefore);
    expect(await prisma.reviewClarificationRequest.count()).toBe(reviewClarificationCountBefore);
    expect(await prisma.impactAnalysis.count()).toBe(analysisCountBefore);
  });

  it('denies cross-project multi-repository run and review coverage reads', async () => {
    const scoped = await seedAnalysisGraph();
    const run = await prisma.multiRepoAnalysisRun.create({
      data: {
        id: crypto.randomUUID(),
        projectId: scoped.projectId,
        requirementId: scoped.requirementId,
        requirementRevisionId: scoped.revisionId,
        createdByUserId: adminUserId,
        requestKey: crypto.randomUUID(),
      },
    });
    const outsiderProjectId = crypto.randomUUID();
    const outsider = await prisma.user.create({
      data: {
        id: crypto.randomUUID(),
        email: 'multi-repo-outsider@ba-helper.local',
        name: 'Multi Repo Outsider',
        role: 'ADMIN',
      },
    });
    await prisma.project.create({
      data: { id: outsiderProjectId, name: 'Multi Repo Outsider Project' },
    });
    await grantProjectMembership(prisma, {
      projectId: outsiderProjectId,
      userId: outsider.id,
      role: 'OWNER',
    });
    const auth = {
      Authorization: `Bearer ${jwtService.sign({
        sub: outsider.id,
        email: outsider.email,
        role: outsider.role,
      })}`,
    };
    const multiRepoCreateCountBefore = await prisma.multiRepoAnalysisRun.count();

    await request(app.getHttpServer())
      .post(`/api/v1/projects/${scoped.projectId}/multi-repo-analyses`)
      .set(auth)
      .send({
        requirementRevisionId: scoped.revisionId,
        repositoryIds: [
          (await prisma.repositorySnapshot.findUniqueOrThrow({
            where: { id: scoped.snapshotId },
            select: { repositoryId: true },
          })).repositoryId,
        ],
        allowPartialSnapshot: false,
        requestKey: crypto.randomUUID(),
      })
      .expect(404);

    await request(app.getHttpServer())
      .get(`/api/v1/multi-repo-runs/${run.id}`)
      .set(auth)
      .expect(404);
    await request(app.getHttpServer())
      .get(`/api/v1/multi-repo-runs/${run.id}/review-coverage`)
      .set(auth)
      .expect(404);
    await request(app.getHttpServer())
      .get(`/api/v1/multi-repo-runs/${run.id}/impact-matrix`)
      .set(auth)
      .expect(404);
    await request(app.getHttpServer())
      .get(`/api/v1/multi-repo-runs/${run.id}/merged-report-draft`)
      .set(auth)
      .expect(404);
    await request(app.getHttpServer())
      .get(`/api/v1/multi-repo-runs/${run.id}/merged-report`)
      .set(auth)
      .expect(404);
    await request(app.getHttpServer())
      .get(`/api/v1/multi-repo-runs/${run.id}/merged-report/review-decisions`)
      .set(auth)
      .expect(404);
    await request(app.getHttpServer())
      .get(`/api/v1/multi-repo-runs/${run.id}/merged-report/review-decisions/latest`)
      .set(auth)
      .expect(404);
    await request(app.getHttpServer())
      .get(`/api/v1/multi-repo-runs/${run.id}/merged-report/export.md`)
      .set(auth)
      .expect(404);
    await request(app.getHttpServer())
      .get(`/api/v1/multi-repo-runs/${run.id}/merged-report/export.pdf`)
      .set(auth)
      .expect(404);
    await request(app.getHttpServer())
      .post(`/api/v1/multi-repo-runs/${run.id}/merged-report/finalize`)
      .set(auth)
      .expect(404);
    await request(app.getHttpServer())
      .post(`/api/v1/multi-repo-runs/${run.id}/merged-report/review-decisions`)
      .set(auth)
      .send({ decision: 'ACCEPTED', note: 'Cross-project attempt.' })
      .expect(404);

    expect(await prisma.mergedMultiRepoReport.count({
      where: { runId: run.id },
    })).toBe(0);
    expect(await prisma.mergedMultiRepoReportReviewDecision.count()).toBe(0);
    expect(await prisma.multiRepoAnalysisRun.count()).toBe(multiRepoCreateCountBefore);
  });

  it('hides a foreign analysis from a run-scoped matrix drilldown', async () => {
    const scoped = await seedAnalysisGraph();
    const foreign = await seedAnalysisGraph();
    await prisma.projectMember.delete({
      where: {
        projectId_userId: {
          projectId: foreign.projectId,
          userId: viewerUserId,
        },
      },
    });
    const run = await prisma.multiRepoAnalysisRun.create({
      data: {
        projectId: scoped.projectId,
        requirementId: scoped.requirementId,
        requirementRevisionId: scoped.revisionId,
        createdByUserId: adminUserId,
        requestKey: crypto.randomUUID(),
      },
    });
    await prisma.impactAnalysis.update({
      where: { id: scoped.analysisId },
      data: { multiRepoRunId: run.id },
    });

    await request(app.getHttpServer())
      .get(`/api/v1/multi-repo-runs/${run.id}/impact-matrix/analyses/${foreign.analysisId}/details`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .expect(404);
  });

  it('returns 404 for cross-project snapshot artifacts, graph, and evidence reads', async () => {
    const projectId = crypto.randomUUID();
    const repositoryId = crypto.randomUUID();
    const targetId = crypto.randomUUID();
    const snapshotId = crypto.randomUUID();
    const requirementId = crypto.randomUUID();
    const revisionId = crypto.randomUUID();
    const analysisId = crypto.randomUUID();
    const artifactId = crypto.randomUUID();
    const evidenceId = crypto.randomUUID();

    await prisma.project.create({ data: { id: projectId, name: 'Hidden Graph Project' } });
    await grantProjectMembership(prisma, {
      projectId,
      userId: adminUserId,
      role: 'OWNER',
    });
    await prisma.repository.create({
      data: {
        id: repositoryId,
        projectId,
        canonicalUrl: 'https://github.com/example/hidden-graph',
      },
    });
    await prisma.repositoryTarget.create({
      data: {
        id: targetId,
        repositoryId,
        targetKey: 'main',
        requestedRef: 'main',
        resolvedRefType: 'BRANCH',
        latestObservedCommitSha: 'abc1234',
        lastObservedAt: new Date(),
      },
    });
    await prisma.repositorySnapshot.create({
      data: {
        id: snapshotId,
        repositoryId,
        commitSha: 'abc1234',
        analyzerVersion: '1.0.0',
        coverageStatus: 'READY',
      },
    });
    await prisma.codeArtifact.create({
      data: {
        id: artifactId,
        snapshotId,
        artifactKey: 'src/hidden.ts:HiddenService',
        name: 'HiddenService',
        artifactType: 'SERVICE',
        filePath: 'src/hidden.ts',
      },
    });
    await prisma.requirement.create({
      data: {
        id: requirementId,
        projectId,
      },
    });
    await prisma.requirementRevision.create({
      data: {
        id: revisionId,
        requirementId,
        title: 'Hidden evidence',
        rawText: 'Hidden evidence',
        normalizedText: 'Hidden evidence',
        readinessStatus: 'READY_FOR_ANALYSIS',
      },
    });
    await prisma.impactAnalysis.create({
      data: {
        id: analysisId,
        requirementRevisionId: revisionId,
        requirementId,
        projectId,
        repositoryId,
        snapshotId,
        sourceTargetId: targetId,
        requestKey: crypto.randomUUID(),
        status: 'COMPLETED',
        stage: 'DONE',
      },
    });
    await prisma.evidence.create({
      data: {
        id: evidenceId,
        provenanceKey: 'hidden-evidence',
        sourceType: 'CODE',
        snapshotId,
        excerpt: 'hidden',
        contentHash: 'hidden-hash',
        sourcePath: 'src/hidden.ts',
      },
    });
    await prisma.insightEvidence.create({
      data: {
        insightId: (
          await prisma.baInsight.create({
            data: {
              id: crypto.randomUUID(),
              impactAnalysisId: analysisId,
              insightKey: 'hidden-insight',
              insightType: 'CLAIM',
              certainty: 'EVIDENCED',
              reviewStatus: 'NEEDS_REVIEW',
              title: 'Hidden insight',
              description: 'Hidden desc',
            },
          })
        ).id,
        evidenceId,
      },
    });

    await request(app.getHttpServer())
      .get(`/api/v1/snapshots/${snapshotId}/artifacts`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .expect(404);

    await request(app.getHttpServer())
      .get(`/api/v1/snapshots/${snapshotId}/graph`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .expect(404);

    await request(app.getHttpServer())
      .get(`/api/v1/impact-analyses/${analysisId}/evidence`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .expect(404);
  });

  it('returns 404 when an unrelated project owner reads artifact comprehension', async () => {
    const scoped = await seedAnalysisGraph();
    const outsider = await prisma.user.create({
      data: {
        id: crypto.randomUUID(),
        email: 'comprehension-scope-outsider@ba-helper.local',
        role: 'ADMIN',
      },
    });
    const outsiderProjectId = crypto.randomUUID();
    await prisma.project.create({
      data: { id: outsiderProjectId, name: 'Comprehension Outsider Project' },
    });
    await grantProjectMembership(prisma, {
      projectId: outsiderProjectId,
      userId: outsider.id,
      role: 'OWNER',
    });
    const link = await prisma.traceabilityLink.findUniqueOrThrow({
      where: { id: scoped.linkId },
      select: { artifactId: true },
    });
    const outsiderToken = jwtService.sign({
      sub: outsider.id,
      email: outsider.email,
      role: outsider.role,
    });

    await request(app.getHttpServer())
      .get(`/api/v1/snapshots/${scoped.snapshotId}/artifacts/${link.artifactId}/comprehension`)
      .set('Authorization', `Bearer ${outsiderToken}`)
      .expect(404);
  });

  it('returns 404 on the remaining analysis-scoped read surfaces for an unrelated project owner', async () => {
    const scoped = await seedAnalysisGraph();
    const outsider = await prisma.user.create({
      data: {
        id: crypto.randomUUID(),
        email: 'analysis-read-scope-outsider@ba-helper.local',
        role: 'ADMIN',
      },
    });
    const outsiderProjectId = crypto.randomUUID();
    await prisma.project.create({
      data: { id: outsiderProjectId, name: 'Analysis Read Outsider Project' },
    });
    await grantProjectMembership(prisma, {
      projectId: outsiderProjectId,
      userId: outsider.id,
      role: 'OWNER',
    });
    const auth = {
      Authorization: `Bearer ${jwtService.sign({
        sub: outsider.id,
        email: outsider.email,
        role: outsider.role,
      })}`,
    };
    const analysisPath = `/api/v1/impact-analyses/${scoped.analysisId}`;
    const projectPath = `/api/v1/projects/${scoped.projectId}`;
    const hiddenReadPaths = [
      `${projectPath}/requirements`,
      `${projectPath}/requirements/${scoped.requirementId}`,
      `${projectPath}/analyses`,
      `${projectPath}/analyses/${scoped.analysisId}/drift-freshness`,
      `${projectPath}/multi-repo-runs`,
      analysisPath,
      `${analysisPath}/events`,
      `${analysisPath}/lineage`,
      `${analysisPath}/graph`,
      `${analysisPath}/workspace`,
      `${analysisPath}/qa-coverage`,
      `${analysisPath}/qa-coverage/evidence/${crypto.randomUUID()}`,
      `${analysisPath}/review-queue`,
      `${analysisPath}/diff`,
      `${analysisPath}/review-decisions`,
      `${analysisPath}/review-decisions/latest`,
      `${analysisPath}/review-completion`,
      `${analysisPath}/evidence`,
      `${analysisPath}/insights`,
      `${analysisPath}/traceability`,
      `${analysisPath}/clarifications`,
      `${analysisPath}/review-clarifications`,
      `${analysisPath}/documents`,
      `${analysisPath}/approved-report`,
      `${analysisPath}/approved-report/export.md`,
      `${analysisPath}/approved-report/export.pdf`,
      `${analysisPath}/reviewed-report-snapshot/latest`,
      `${analysisPath}/final-reviewed-report?locale=vi-VN`,
      `${analysisPath}/review-notes`,
      `/api/v1/analyses/${scoped.analysisId}/localization/vi-VN/status`,
    ];

    for (const path of hiddenReadPaths) {
      const response = await request(app.getHttpServer())
        .get(path)
        .set(auth)
        .expect(404);
      expect(JSON.stringify(response.body)).not.toContain('Refund paid bookings');
      expect(JSON.stringify(response.body)).not.toContain('Refund path needs clarification');
    }
  });

  it('hides a foreign snapshot ID supplied to an authorized analysis-create route', async () => {
    const scoped = await seedAnalysisGraph();
    const foreignProjectId = crypto.randomUUID();
    const foreignRepositoryId = crypto.randomUUID();
    const foreignTargetId = crypto.randomUUID();
    const foreignSnapshotId = crypto.randomUUID();

    await prisma.project.create({
      data: { id: foreignProjectId, name: 'Hidden Snapshot Project' },
    });
    await prisma.repository.create({
      data: {
        id: foreignRepositoryId,
        projectId: foreignProjectId,
        canonicalUrl: 'https://github.com/example/hidden-snapshot',
      },
    });
    await prisma.repositoryTarget.create({
      data: {
        id: foreignTargetId,
        repositoryId: foreignRepositoryId,
        targetKey: 'main',
        requestedRef: 'main',
        resolvedRefType: 'BRANCH',
        latestObservedCommitSha: 'foreign-commit',
        lastObservedAt: new Date(),
      },
    });
    await prisma.repositorySnapshot.create({
      data: {
        id: foreignSnapshotId,
        repositoryId: foreignRepositoryId,
        commitSha: 'foreign-commit',
        analyzerVersion: '1.0.0',
        coverageStatus: 'READY',
      },
    });

    const analysisCountBefore = await prisma.impactAnalysis.count();
    const analysisEventCountBefore = await prisma.domainEvent.count({
      where: { eventType: 'ANALYSIS_STARTED' },
    });

    await request(app.getHttpServer())
      .post(`/api/v1/requirement-revisions/${scoped.revisionId}/impact-analyses`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        snapshotId: foreignSnapshotId,
        sourceTargetId: foreignTargetId,
        allowPartialSnapshot: false,
        requestKey: crypto.randomUUID(),
      })
      .expect(404);

    expect(await prisma.impactAnalysis.count()).toBe(analysisCountBefore);
    expect(await prisma.domainEvent.count({
      where: { eventType: 'ANALYSIS_STARTED' },
    })).toBe(analysisEventCountBefore);
  });

  it('hides a foreign requirement revision supplied to an analysis-create route', async () => {
    const scoped = await seedAnalysisGraph();
    const foreign = await seedAnalysisGraph();
    await prisma.projectMember.delete({
      where: {
        projectId_userId: {
          projectId: foreign.projectId,
          userId: adminUserId,
        },
      },
    });
    const analysisCountBefore = await prisma.impactAnalysis.count();
    const eventCountBefore = await prisma.domainEvent.count();

    await request(app.getHttpServer())
      .post(`/api/v1/requirement-revisions/${foreign.revisionId}/impact-analyses`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        snapshotId: scoped.snapshotId,
        sourceTargetId: scoped.targetId,
        allowPartialSnapshot: false,
        requestKey: crypto.randomUUID(),
      })
      .expect(404);

    expect(await prisma.impactAnalysis.count()).toBe(analysisCountBefore);
    expect(await prisma.domainEvent.count()).toBe(eventCountBefore);
  });

  it('hides a foreign insight ID supplied to a clarification mutation', async () => {
    const scoped = await seedAnalysisGraph();
    const foreign = await seedAnalysisGraph();
    await prisma.projectMember.delete({
      where: {
        projectId_userId: {
          projectId: foreign.projectId,
          userId: adminUserId,
        },
      },
    });
    const clarificationCountBefore = await prisma.clarificationItem.count();

    await request(app.getHttpServer())
      .post(`/api/v1/impact-analyses/${scoped.analysisId}/clarifications`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ sourceInsightId: foreign.insightId })
      .expect(404);

    expect(await prisma.clarificationItem.count()).toBe(clarificationCountBefore);
  });

  it('hides foreign review-note target IDs in a project-scoped mutation', async () => {
    const scoped = await seedAnalysisGraph();
    const foreign = await seedAnalysisGraph();
    await prisma.projectMember.delete({
      where: {
        projectId_userId: {
          projectId: foreign.projectId,
          userId: adminUserId,
        },
      },
    });
    const noteCountBefore = await prisma.reviewNote.count();

    await request(app.getHttpServer())
      .post(`/api/v1/impact-analyses/${scoped.analysisId}/review-notes`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ insightId: foreign.insightId, body: 'Hidden target note.' })
      .expect(404);
    await request(app.getHttpServer())
      .post(`/api/v1/impact-analyses/${scoped.analysisId}/review-notes`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ traceabilityLinkId: foreign.linkId, body: 'Hidden target note.' })
      .expect(404);

    expect(await prisma.reviewNote.count()).toBe(noteCountBefore);
  });

  it('hides a foreign review-decision ID in a clarification request', async () => {
    const scoped = await seedAnalysisGraph();
    const foreign = await seedAnalysisGraph();
    await prisma.projectMember.delete({
      where: {
        projectId_userId: {
          projectId: foreign.projectId,
          userId: adminUserId,
        },
      },
    });
    const foreignDecision = await prisma.analysisReviewDecision.create({
      data: {
        id: crypto.randomUUID(),
        analysisId: foreign.analysisId,
        decision: 'NEEDS_MORE_CLARIFICATION',
        reviewedByUserId: adminUserId,
      },
    });
    const clarificationCountBefore = await prisma.reviewClarificationRequest.count();

    await request(app.getHttpServer())
      .post(`/api/v1/impact-analyses/${scoped.analysisId}/review-clarifications`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        reviewDecisionId: foreignDecision.id,
        question: 'Does the hidden payment path issue a refund?',
      })
      .expect(404);

    expect(await prisma.reviewClarificationRequest.count()).toBe(clarificationCountBefore);
  });

  it('hides a foreign parent analysis ID supplied to analysis creation', async () => {
    const scoped = await seedAnalysisGraph();
    const foreign = await seedAnalysisGraph();
    await prisma.projectMember.delete({
      where: {
        projectId_userId: {
          projectId: foreign.projectId,
          userId: adminUserId,
        },
      },
    });
    const analysisCountBefore = await prisma.impactAnalysis.count();
    const eventCountBefore = await prisma.domainEvent.count();

    await request(app.getHttpServer())
      .post(`/api/v1/requirement-revisions/${scoped.revisionId}/impact-analyses`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        snapshotId: scoped.snapshotId,
        sourceTargetId: scoped.targetId,
        allowPartialSnapshot: false,
        requestKey: crypto.randomUUID(),
        derivedFromAnalysisId: foreign.analysisId,
      })
      .expect(404);

    expect(await prisma.impactAnalysis.count()).toBe(analysisCountBefore);
    expect(await prisma.domainEvent.count()).toBe(eventCountBefore);
  });

  it('rejects unknown analysis-create fields instead of silently dropping them', async () => {
    const scoped = await seedAnalysisGraph();
    const analysisCountBefore = await prisma.impactAnalysis.count();
    const eventCountBefore = await prisma.domainEvent.count();

    await request(app.getHttpServer())
      .post(`/api/v1/requirement-revisions/${scoped.revisionId}/impact-analyses`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        snapshotId: scoped.snapshotId,
        sourceTargetId: scoped.targetId,
        allowPartialSnapshot: false,
        requestKey: crypto.randomUUID(),
        derivedFromAnalysysId: scoped.analysisId,
      })
      .expect(400);

    expect(await prisma.impactAnalysis.count()).toBe(analysisCountBefore);
    expect(await prisma.domainEvent.count()).toBe(eventCountBefore);
  });

  it('hides a foreign source clarification ID supplied to analysis creation', async () => {
    const scoped = await seedAnalysisGraph();
    const foreign = await seedAnalysisGraph();
    await prisma.projectMember.delete({
      where: {
        projectId_userId: {
          projectId: foreign.projectId,
          userId: adminUserId,
        },
      },
    });
    const sourceClarification = await prisma.clarificationItem.create({
      data: {
        impactAnalysisId: foreign.analysisId,
        sourceInsightId: foreign.insightId,
        status: 'CONVERTED_TO_REVISION',
        question: 'Foreign source clarification',
        convertedRequirementRevisionId: foreign.revisionId,
      },
    });
    const analysisCountBefore = await prisma.impactAnalysis.count();
    const eventCountBefore = await prisma.domainEvent.count();

    await request(app.getHttpServer())
      .post(`/api/v1/requirement-revisions/${scoped.revisionId}/impact-analyses`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        snapshotId: scoped.snapshotId,
        sourceTargetId: scoped.targetId,
        allowPartialSnapshot: false,
        requestKey: crypto.randomUUID(),
        derivedFromAnalysisId: scoped.analysisId,
        sourceClarificationId: sourceClarification.id,
      })
      .expect(404);

    expect(await prisma.impactAnalysis.count()).toBe(analysisCountBefore);
    expect(await prisma.domainEvent.count()).toBe(eventCountBefore);
  });

  it('persists valid clarification lineage and binds lineage to the idempotency key', async () => {
    const scoped = await seedAnalysisGraph();
    const nextRevision = await prisma.requirementRevision.create({
      data: {
        requirementId: scoped.requirementId,
        title: 'Refund paid bookings with clarification',
        rawText: 'Clarified refund behavior.',
        normalizedText: 'Clarified refund behavior.',
        readinessStatus: 'READY_FOR_ANALYSIS',
      },
    });
    const clarification = await prisma.clarificationItem.create({
      data: {
        impactAnalysisId: scoped.analysisId,
        sourceInsightId: scoped.insightId,
        status: 'CONVERTED_TO_REVISION',
        question: 'Clarified refund behavior',
        convertedRequirementRevisionId: nextRevision.id,
      },
    });
    const competingParent = await prisma.impactAnalysis.create({
      data: {
        requirementRevisionId: scoped.revisionId,
        requirementId: scoped.requirementId,
        projectId: scoped.projectId,
        repositoryId: scoped.repositoryId,
        snapshotId: scoped.snapshotId,
        sourceTargetId: scoped.targetId,
        requestKey: crypto.randomUUID(),
        status: 'COMPLETED',
        stage: 'DONE',
      },
    });
    const requestKey = crypto.randomUUID();
    const endpoint = `/api/v1/requirement-revisions/${nextRevision.id}/impact-analyses`;
    const basePayload = {
      snapshotId: scoped.snapshotId,
      sourceTargetId: scoped.targetId,
      allowPartialSnapshot: false,
      requestKey,
    };
    const analysisCountBeforeDeniedRequest = await prisma.impactAnalysis.count();

    await request(app.getHttpServer())
      .post(endpoint)
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({
        ...basePayload,
        derivedFromAnalysisId: scoped.analysisId,
        sourceClarificationId: clarification.id,
      })
      .expect(403);

    expect(await prisma.impactAnalysis.count()).toBe(analysisCountBeforeDeniedRequest);

    const created = await request(app.getHttpServer())
      .post(endpoint)
      .set('Authorization', `Bearer ${reviewerToken}`)
      .send({
        ...basePayload,
        derivedFromAnalysisId: scoped.analysisId,
        sourceClarificationId: clarification.id,
      })
      .expect(201);

    expect(await prisma.impactAnalysis.findUniqueOrThrow({
      where: { id: created.body.id },
      select: {
        derivedFromAnalysisId: true,
        sourceClarificationId: true,
      },
    })).toEqual({
      derivedFromAnalysisId: scoped.analysisId,
      sourceClarificationId: clarification.id,
    });

    const rerunKey = crypto.randomUUID();
    const rerun = await request(app.getHttpServer())
      .post(endpoint)
      .set('Authorization', `Bearer ${reviewerToken}`)
      .send({
        ...basePayload,
        requestKey: rerunKey,
        derivedFromAnalysisId: scoped.analysisId,
      })
      .expect(201);
    expect(await prisma.impactAnalysis.findUniqueOrThrow({
      where: { id: rerun.body.id },
      select: {
        derivedFromAnalysisId: true,
        sourceClarificationId: true,
      },
    })).toEqual({
      derivedFromAnalysisId: scoped.analysisId,
      sourceClarificationId: null,
    });

    await request(app.getHttpServer())
      .post(endpoint)
      .set('Authorization', `Bearer ${reviewerToken}`)
      .send({
        ...basePayload,
        derivedFromAnalysisId: competingParent.id,
      })
      .expect(409);

    expect(await prisma.impactAnalysis.count({ where: { requestKey } })).toBe(1);
  });

  it('returns universalKind for same-project snapshot artifact reads', async () => {
    const seeded = await seedAnalysisGraph('WAITING_FOR_REVIEW');

    const response = await request(app.getHttpServer())
      .get(`/api/v1/snapshots/${seeded.snapshotId}/artifacts`)
      .set('Authorization', `Bearer ${reviewerToken}`)
      .expect(200);

    const parsed = artifactListResponseSchema.parse(response.body);
    expect(parsed.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          artifactType: 'SERVICE',
          universalKind: 'DOMAIN_SERVICE',
        }),
      ]),
    );
  });

  it('does not include a foreign snapshot artifact through a mismatched dependency edge', async () => {
    const scoped = await seedAnalysisGraph();
    const foreignProject = await prisma.project.create({
      data: { id: crypto.randomUUID(), name: 'Hidden edge project' },
    });
    const foreignRepository = await prisma.repository.create({
      data: {
        id: crypto.randomUUID(),
        projectId: foreignProject.id,
        canonicalUrl: 'https://github.com/example/hidden-edge',
      },
    });
    const foreignSnapshot = await prisma.repositorySnapshot.create({
      data: {
        id: crypto.randomUUID(),
        repositoryId: foreignRepository.id,
        commitSha: 'hidden-edge-commit',
        analyzerVersion: '1.0.0',
        coverageStatus: 'READY',
      },
    });
    const foreignArtifact = await prisma.codeArtifact.create({
      data: {
        id: crypto.randomUUID(),
        snapshotId: foreignSnapshot.id,
        artifactKey: 'hidden:PaymentSecrets.refundCustomer',
        name: 'PaymentSecrets.refundCustomer',
        artifactType: 'SERVICE_METHOD',
        filePath: 'src/private/payment-secrets.ts',
      },
    });
    const selectedArtifact = await prisma.traceabilityLink.findFirstOrThrow({
      where: { impactAnalysisId: scoped.analysisId },
      select: { artifactId: true },
    });

    // Simulate a corrupted persisted edge: its snapshot is project A's, but its source artifact is project B's.
    await expect(prisma.dependencyEdge.create({
      data: {
        snapshotId: scoped.snapshotId,
        fromArtifactId: foreignArtifact.id,
        toArtifactId: selectedArtifact.artifactId,
        type: 'CALLS',
      },
    })).rejects.toMatchObject({ code: 'P2003' });
    await expect(prisma.dependencyEdge.create({
      data: {
        snapshotId: scoped.snapshotId,
        fromArtifactId: selectedArtifact.artifactId,
        toArtifactId: foreignArtifact.id,
        type: 'REFERENCES',
      },
    })).rejects.toMatchObject({ code: 'P2003' });

    const response = await request(app.getHttpServer())
      .get(`/api/v1/impact-analyses/${scoped.analysisId}/graph`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const graph = impactGraphResponseSchema.parse(response.body);
    expect(graph.nodes.some((node) => node.id === `artifact-${foreignArtifact.id}`)).toBe(false);
    expect(JSON.stringify(graph)).not.toContain('PaymentSecrets.refundCustomer');
    expect(JSON.stringify(graph)).not.toContain('src/private/payment-secrets.ts');
  });

  it('does not list evidence whose snapshot conflicts with the analysis revision', async () => {
    const scoped = await seedAnalysisGraph();
    const foreignProject = await prisma.project.create({
      data: { id: crypto.randomUUID(), name: 'Foreign evidence project' },
    });
    const foreignRepository = await prisma.repository.create({
      data: { projectId: foreignProject.id, canonicalUrl: 'https://github.com/example/foreign-evidence' },
    });
    const foreignSnapshot = await prisma.repositorySnapshot.create({
      data: { repositoryId: foreignRepository.id, commitSha: 'foreign-evidence-commit',
        analyzerVersion: '1.0.0', coverageStatus: 'READY' },
    });
    const foreignArtifact = await prisma.codeArtifact.create({
      data: { snapshotId: foreignSnapshot.id, artifactKey: 'private:payment-refund',
        name: 'PrivatePaymentRefund', artifactType: 'SERVICE', filePath: 'src/private/payment-refund.ts' },
    });
    const localLink = await prisma.traceabilityLink.findUniqueOrThrow({
      where: { id: scoped.linkId }, select: { artifactId: true },
    });
    await prisma.evidence.createMany({ data: [
      { provenanceKey: 'local-snapshot-evidence', sourceType: 'CODE', snapshotId: scoped.snapshotId,
        artifactId: localLink.artifactId, sourcePath: 'src/orders/orders.service.ts',
        excerpt: 'LOCAL SNAPSHOT EVIDENCE', contentHash: 'local-snapshot-evidence-hash' },
      { provenanceKey: 'local-requirement-evidence', sourceType: 'REQUIREMENT_INPUT',
        requirementRevisionId: scoped.revisionId, sourcePath: 'requirement',
        excerpt: 'LOCAL REQUIREMENT EVIDENCE', contentHash: 'local-requirement-evidence-hash' },
      { provenanceKey: 'foreign-snapshot-for-local-revision', sourceType: 'CODE',
        snapshotId: foreignSnapshot.id, artifactId: foreignArtifact.id, requirementRevisionId: scoped.revisionId,
        sourcePath: 'src/private/payment-refund.ts', excerpt: 'FOREIGN PAYMENT REFUND SOURCE',
        contentHash: 'foreign-evidence-hash' },
      { provenanceKey: 'foreign-snapshot-for-foreign-artifact', sourceType: 'CODE',
        snapshotId: foreignSnapshot.id, artifactId: foreignArtifact.id,
        sourcePath: 'src/private/payment-refund.ts', excerpt: 'FOREIGN ARTIFACT EVIDENCE',
        contentHash: 'foreign-artifact-evidence-hash' },
    ] });

    const response = await request(app.getHttpServer())
      .get(`/api/v1/impact-analyses/${scoped.analysisId}/evidence`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const evidence = evidenceListResponseSchema.parse(response.body);

    expect(evidence.items.some((item) => item.excerpt.includes('FOREIGN PAYMENT REFUND SOURCE'))).toBe(false);
    expect(evidence.items.some((item) => item.excerpt.includes('FOREIGN ARTIFACT EVIDENCE'))).toBe(false);
    expect(evidence.items.some((item) => item.excerpt.includes('LOCAL SNAPSHOT EVIDENCE'))).toBe(true);
    expect(evidence.items.some((item) => item.excerpt.includes('LOCAL REQUIREMENT EVIDENCE'))).toBe(true);
    expect(JSON.stringify(evidence)).not.toContain('src/private/payment-refund.ts');
  });

  it('rejects a traceability link whose artifact belongs to another snapshot', async () => {
    const scoped = await seedAnalysisGraph();
    const foreignProject = await prisma.project.create({ data: { name: 'Foreign traceability project' } });
    const foreignRepository = await prisma.repository.create({
      data: { projectId: foreignProject.id, canonicalUrl: 'https://github.com/example/foreign-traceability' },
    });
    const foreignSnapshot = await prisma.repositorySnapshot.create({
      data: { repositoryId: foreignRepository.id, commitSha: 'foreign-traceability-commit',
        analyzerVersion: '1.0.0', coverageStatus: 'READY' },
    });
    const foreignArtifact = await prisma.codeArtifact.create({
      data: { snapshotId: foreignSnapshot.id, artifactKey: 'private:foreign-traceability',
        name: 'ForeignTraceability', artifactType: 'SERVICE', filePath: 'src/private/foreign-traceability.ts' },
    });

    await expect(prisma.traceabilityLink.create({
      data: { impactAnalysisId: scoped.analysisId, snapshotId: scoped.snapshotId, artifactId: foreignArtifact.id,
        linkType: 'AFFECTED', linkBasis: 'INFERRED', reviewStatus: 'NEEDS_REVIEW' },
    })).rejects.toMatchObject({ code: 'P2003' });
    await expect(prisma.traceabilityLink.count({
      where: { impactAnalysisId: scoped.analysisId, artifactId: foreignArtifact.id },
    })).resolves.toBe(0);
  });

  it('does not expose cross-snapshot artifacts or evidence in analysis projections', async () => {
    const scoped = await seedAnalysisGraph();
    const foreignProject = await prisma.project.create({
      data: { id: crypto.randomUUID(), name: 'Foreign linked evidence project' },
    });
    const foreignRepository = await prisma.repository.create({
      data: { projectId: foreignProject.id, canonicalUrl: 'https://github.com/example/foreign-linked-evidence' },
    });
    const foreignSnapshot = await prisma.repositorySnapshot.create({
      data: { repositoryId: foreignRepository.id, commitSha: 'foreign-linked-evidence-commit',
        analyzerVersion: '1.0.0', coverageStatus: 'READY' },
    });
    const foreignArtifact = await prisma.codeArtifact.create({
      data: { snapshotId: foreignSnapshot.id, artifactKey: 'private:foreign-refund',
        name: 'ForeignRefund', artifactType: 'SERVICE', filePath: 'src/private/foreign-refund.ts' },
    });
    await expect(prisma.traceabilityLink.create({
      data: { impactAnalysisId: scoped.analysisId, snapshotId: scoped.snapshotId, artifactId: foreignArtifact.id,
        linkType: 'AFFECTED', linkBasis: 'INFERRED', reviewStatus: 'NEEDS_REVIEW' },
    })).rejects.toMatchObject({ code: 'P2003' });
    const foreignEvidence = await prisma.evidence.create({
      data: { provenanceKey: 'foreign-snapshot-linked-evidence', sourceType: 'CODE',
        snapshotId: foreignSnapshot.id, artifactId: foreignArtifact.id,
        requirementRevisionId: scoped.revisionId, sourcePath: 'src/private/payment-refund.ts',
        excerpt: 'FOREIGN SNAPSHOT LINKED EVIDENCE', contentHash: 'foreign-linked-evidence-hash' },
    });
    const foreignArtifactEvidence = await prisma.evidence.create({
      data: { provenanceKey: 'foreign-snapshot-linked-artifact-evidence', sourceType: 'CODE',
        snapshotId: foreignSnapshot.id, artifactId: foreignArtifact.id,
        sourcePath: 'src/private/foreign-refund.ts', excerpt: 'FOREIGN ARTIFACT LINKED EVIDENCE',
        contentHash: 'foreign-artifact-linked-evidence-hash' },
    });
    await prisma.insightEvidence.createMany({ data: [
      { insightId: scoped.insightId, evidenceId: foreignEvidence.id },
      { insightId: scoped.insightId, evidenceId: foreignArtifactEvidence.id },
    ] });
    await prisma.traceabilityEvidence.createMany({ data: [
      { traceabilityLinkId: scoped.linkId, evidenceId: foreignEvidence.id },
      { traceabilityLinkId: scoped.linkId, evidenceId: foreignArtifactEvidence.id },
    ] });
    const baseline = await prisma.impactAnalysis.create({
      data: { requirementRevisionId: scoped.revisionId, requirementId: scoped.requirementId, projectId: scoped.projectId,
        repositoryId: scoped.repositoryId, snapshotId: scoped.snapshotId,
        sourceTargetId: scoped.targetId, requestKey: crypto.randomUUID(), status: 'COMPLETED', stage: 'DONE' },
    });
    await prisma.impactAnalysis.update({
      where: { id: scoped.analysisId }, data: { derivedFromAnalysisId: baseline.id },
    });
    const run = await prisma.multiRepoAnalysisRun.create({
      data: { projectId: scoped.projectId, requirementId: scoped.requirementId,
        requirementRevisionId: scoped.revisionId,
        createdByUserId: adminUserId, requestKey: crypto.randomUUID() },
    });
    await prisma.impactAnalysis.update({
      where: { id: scoped.analysisId }, data: { multiRepoRunId: run.id },
    });

    const paths = [
      `/api/v1/impact-analyses/${scoped.analysisId}/evidence`,
      `/api/v1/impact-analyses/${scoped.analysisId}/insights`,
      `/api/v1/impact-analyses/${scoped.analysisId}/traceability`,
      `/api/v1/impact-analyses/${scoped.analysisId}/graph`,
      `/api/v1/impact-analyses/${scoped.analysisId}/workspace`,
      `/api/v1/impact-analyses/${scoped.analysisId}/diff`,
      `/api/v1/multi-repo-runs/${run.id}/impact-matrix`,
      `/api/v1/multi-repo-runs/${run.id}/review-coverage`,
      `/api/v1/multi-repo-runs/${run.id}/impact-matrix/analyses/${scoped.analysisId}/details`,
    ];
    for (const path of paths) {
      const response = await request(app.getHttpServer())
        .get(path)
        .set('Authorization', `Bearer ${adminToken}`);
      if (response.status !== 200) {
        throw new Error(`${path}: ${response.status} ${JSON.stringify(response.body)}`);
      }
      expect(JSON.stringify(response.body)).not.toContain('FOREIGN SNAPSHOT LINKED EVIDENCE');
      expect(JSON.stringify(response.body)).not.toContain('FOREIGN ARTIFACT LINKED EVIDENCE');
      expect(JSON.stringify(response.body)).not.toContain('src/private/payment-refund.ts');
      expect(JSON.stringify(response.body)).not.toContain('src/private/foreign-refund.ts');
      expect(JSON.stringify(response.body)).not.toContain('ForeignRefund');
    }
    const matrix = await request(app.getHttpServer())
      .get(`/api/v1/multi-repo-runs/${run.id}/impact-matrix`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(matrix.body.summary.totalArtifacts).toBe(1);
    const coverage = await request(app.getHttpServer())
      .get(`/api/v1/multi-repo-runs/${run.id}/review-coverage`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(reviewCoverageResponseSchema.parse(coverage.body).summary.impactedArtifacts).toBe(1);

    const completion = await request(app.getHttpServer())
      .get(`/api/v1/impact-analyses/${scoped.analysisId}/review-completion`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(reviewCompletionResponseSchema.parse(completion.body)).toMatchObject({
      analysisId: scoped.analysisId,
      totalLinks: 1,
      needsReview: 1,
    });
  });
});
