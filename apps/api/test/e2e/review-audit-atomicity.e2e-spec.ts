import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { randomUUID } from 'crypto';
import { JwtService } from '@nestjs/jwt';
import { EventLogService, PrismaService } from '@ba-helper/backend-runtime';
import { createTestApp } from './helpers/test-app';
import { resetDatabase } from './helpers/reset-db';
import { createReviewAuditFixture } from './helpers/review-audit-fixture';

describe('Review audit atomicity (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;
  let adminToken: string;
  let adminUserId: string;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    jwtService = app.get(JwtService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
    const user = await prisma.user.create({
      data: {
        id: randomUUID(),
        email: 'review-audit@ba-helper.local',
        name: 'Review Audit',
        role: 'ADMIN',
      },
    });
    adminUserId = user.id;
    adminToken = jwtService.sign({ sub: user.id, email: user.email, role: user.role });
  });

  function failAuditWrite() {
    return jest.spyOn(EventLogService.prototype, 'recordEvent')
      .mockRejectedValue(new Error('event storage unavailable'));
  }

  it('rolls back the target-aware traceability decision when audit fails', async () => {
    const { analysisId, traceabilityLinkId } = await createReviewAuditFixture(prisma, adminUserId);
    const eventSpy = failAuditWrite();
    try {
      await request(app.getHttpServer())
        .put(`/api/v1/impact-analyses/${analysisId}/review-items/${traceabilityLinkId}/decision`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ target: 'impact', action: 'accept', rationale: 'Looks correct' })
        .expect(500);

      expect(await prisma.traceabilityLink.findUnique({
        where: { id: traceabilityLinkId },
        select: { reviewStatus: true },
      })).toEqual({ reviewStatus: 'NEEDS_REVIEW' });
      expect(await prisma.traceabilityReviewDecision.findUnique({
        where: { traceabilityLinkId },
      })).toBeNull();
      expect(eventSpy).toHaveBeenCalledTimes(1);
    } finally {
      eventSpy.mockRestore();
    }
  });

  it('rolls back the target-aware insight decision and rationale when audit fails', async () => {
    const { analysisId, insightId } = await createReviewAuditFixture(prisma, adminUserId);
    const eventSpy = failAuditWrite();
    try {
      await request(app.getHttpServer())
        .put(`/api/v1/impact-analyses/${analysisId}/review-items/${insightId}/decision`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ target: 'insight', action: 'accept', rationale: 'Reviewed carefully' })
        .expect(500);

      expect(await prisma.baInsight.findUnique({
        where: { id: insightId },
        select: { reviewStatus: true, reviewNote: { select: { body: true } } },
      })).toEqual({ reviewStatus: 'NEEDS_REVIEW', reviewNote: null });
      expect(eventSpy).toHaveBeenCalledTimes(1);
    } finally {
      eventSpy.mockRestore();
    }
  });

  it('rolls back legacy traceability status changes when audit fails', async () => {
    const { traceabilityLinkId } = await createReviewAuditFixture(prisma, adminUserId);
    const eventSpy = failAuditWrite();
    try {
      await request(app.getHttpServer())
        .post(`/api/v1/traceability-links/${traceabilityLinkId}/review`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reviewStatus: 'CONFIRMED' })
        .expect(500);

      expect(await prisma.traceabilityLink.findUnique({
        where: { id: traceabilityLinkId },
        select: { reviewStatus: true },
      })).toEqual({ reviewStatus: 'NEEDS_REVIEW' });
      expect(eventSpy).toHaveBeenCalledTimes(1);
    } finally {
      eventSpy.mockRestore();
    }
  });

  it('rolls back legacy insight status changes when audit fails', async () => {
    const { insightId } = await createReviewAuditFixture(prisma, adminUserId);
    const eventSpy = failAuditWrite();
    try {
      await request(app.getHttpServer())
        .post(`/api/v1/insights/${insightId}/review`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reviewStatus: 'CONFIRMED' })
        .expect(500);

      expect(await prisma.baInsight.findUnique({
        where: { id: insightId },
        select: { reviewStatus: true },
      })).toEqual({ reviewStatus: 'NEEDS_REVIEW' });
      expect(eventSpy).toHaveBeenCalledTimes(1);
    } finally {
      eventSpy.mockRestore();
    }
  });

  it('rolls back the legacy traceability decision upsert when audit fails', async () => {
    const { analysisId, traceabilityLinkId } = await createReviewAuditFixture(prisma, adminUserId);
    const eventSpy = failAuditWrite();
    try {
      await request(app.getHttpServer())
        .put(`/api/v1/traceability-links/${traceabilityLinkId}/review-decision`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ decision: 'ACCEPTED', note: 'Looks correct' })
        .expect(500);

      expect(await prisma.traceabilityLink.findUnique({
        where: { id: traceabilityLinkId },
        select: { reviewStatus: true },
      })).toEqual({ reviewStatus: 'NEEDS_REVIEW' });
      expect(await prisma.traceabilityReviewDecision.findUnique({
        where: { traceabilityLinkId },
      })).toBeNull();
      expect(eventSpy).toHaveBeenCalledTimes(1);
    } finally {
      eventSpy.mockRestore();
    }
  });

  it('rolls back the legacy traceability decision delete when audit fails', async () => {
    const { analysisId, traceabilityLinkId } = await createReviewAuditFixture(prisma, adminUserId);
    await prisma.traceabilityLink.update({
      where: { id: traceabilityLinkId },
      data: { reviewStatus: 'CONFIRMED' },
    });
    await prisma.traceabilityReviewDecision.create({
      data: {
        analysisId,
        traceabilityLinkId,
        decision: 'ACCEPTED',
        note: 'Already accepted',
        reviewedByUserId: adminUserId,
      },
    });
    const eventSpy = failAuditWrite();
    try {
      await request(app.getHttpServer())
        .delete(`/api/v1/traceability-links/${traceabilityLinkId}/review-decision`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(500);

      expect(await prisma.traceabilityLink.findUnique({
        where: { id: traceabilityLinkId },
        select: { reviewStatus: true },
      })).toEqual({ reviewStatus: 'CONFIRMED' });
      expect(await prisma.traceabilityReviewDecision.findUnique({
        where: { traceabilityLinkId },
      })).not.toBeNull();
      expect(eventSpy).toHaveBeenCalledTimes(1);
    } finally {
      eventSpy.mockRestore();
    }
  });
});
