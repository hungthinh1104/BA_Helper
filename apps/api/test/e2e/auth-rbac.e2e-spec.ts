import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import * as crypto from 'crypto';
import { JwtService } from '@nestjs/jwt';
import { createTestApp } from './helpers/test-app';
import { resetDatabase } from './helpers/reset-db';
import { grantProjectMembership } from './helpers/grant-project-membership';
import {
  artifactListResponseSchema,
  requirementCreateResponseSchema,
  requirementDetailResponseSchema,
  requirementListResponseSchema,
  requirementRevisionCreateResponseSchema,
  requirementRevisionQualifyResponseSchema,
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

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    jwtService = app.get(JwtService);
    passwordHashService = app.get(PasswordHashService);
  });

  afterAll(async () => {
    await app.close();
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

    await request(app.getHttpServer())
      .patch(`/api/v1/clarifications/${createRes.body.id}/answer`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({ answer: 'Refund is handled by payment service.' })
      .expect(403);

    await request(app.getHttpServer())
      .patch(`/api/v1/clarifications/${createRes.body.id}/answer`)
      .set('Authorization', `Bearer ${reviewerToken}`)
      .send({ answer: 'Refund is handled by payment service.' })
      .expect(200);
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

    await request(app.getHttpServer())
      .post(`/api/v1/clarifications/${clarification.id}/convert-to-revision`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({})
      .expect(201);

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

    expect(createRes.body.question).toBe('What triggers refund creation?');
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
      .expect(200);

    expect(pdfExport.headers['content-type']).toContain('application/pdf');
    expect(pdfExport.headers['content-disposition']).toContain('.pdf');
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
      .get(`/api/v1/impact-analyses/${analysisId}/approved-report/export.md`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .expect(404);
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
        snapshotId: hiddenSnapshotId,
        sourceTargetId: hiddenTargetId,
        requestKey: crypto.randomUUID(),
        status: 'COMPLETED',
        stage: 'DONE',
      },
    });

    await request(app.getHttpServer())
      .post(`/api/v1/impact-analyses/${hiddenAnalysisId}/review-decisions`)
      .set('Authorization', `Bearer ${reviewerToken}`)
      .send({ decision: 'REJECTED' })
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
});
