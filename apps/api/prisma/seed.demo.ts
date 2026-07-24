import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as crypto from 'crypto';

const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl) {
  throw new Error('DATABASE_URL is required to run the demo seed.');
}

const pool = new Pool({ connectionString: databaseUrl });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({
  adapter,
} as ConstructorParameters<typeof PrismaClient>[0]);

const DEMO_PROJECT_NAME = 'BA Helper Demo: Booking Cancellation';
const DEMO_REPOSITORY_URL = 'demo://booking-cancellation';
const DEMO_REQUIREMENT_TEXT =
  'When a booking is cancelled after payment, the system must release room inventory, mark the booking as cancelled, and prevent duplicate refund requests.';

const DEMO_USER_EMAIL = 'demo@ba-helper.local';
const DEMO_USER_NAME = 'Demo Analyst';
const DEMO_USER_PASSWORD = 'demo-password-2026';

// --- Seed-local password hashing ---
// Uses N=16_384 (lower than production N=131_072) so the seed script
// completes in ~100ms instead of ~3s. This is intentional for local dev
// only; real users created via the API use the full PasswordHashService
// which enforces N=131_072.
const SEED_SCRYPT_N = 16_384;

// Promise wrapper matching the pattern in PasswordHashService but with
// lower N for seed speed. Not used in production paths.
function scryptForSeed(
  password: string,
  salt: Buffer,
  keylen: number,
  options: crypto.ScryptOptions,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, keylen, options, (err, derivedKey) => {
      if (err) reject(err);
      else resolve(Buffer.isBuffer(derivedKey) ? derivedKey : Buffer.from(derivedKey));
    });
  });
}

async function hashPasswordForSeed(password: string): Promise<string> {
  const salt = crypto.randomBytes(16);
  const derived = await scryptForSeed(password, salt, 64, {
    N: SEED_SCRYPT_N,
    r: 8,
    p: 1,
    maxmem: 32 * 1024 * 1024,
  });

  return [
    'scrypt',
    'v=1',
    `N=${SEED_SCRYPT_N}`,
    'r=8',
    'p=1',
    'keylen=64',
    salt.toString('base64url'),
    derived.toString('base64url'),
  ].join('$');
}

async function main() {
  console.log('🌱 Starting BA Helper Demo Seed...');

  // 0. Upsert demo user (idempotent — refreshes passwordHash on every run)
  const passwordHash = await hashPasswordForSeed(DEMO_USER_PASSWORD);
  const demoUser = await prisma.user.upsert({
    where: { email: DEMO_USER_EMAIL },
    update: { passwordHash },
    create: {
      email: DEMO_USER_EMAIL,
      name: DEMO_USER_NAME,
      passwordHash,
      role: 'ADMIN',
    },
  });
  console.log(`✅ Demo user ready: ${DEMO_USER_EMAIL} (id: ${demoUser.id})`);

  // 1. Idempotent cleanup for demo project only
  const existingProject = await prisma.project.findFirst({
    where: { name: DEMO_PROJECT_NAME },
  });

  if (existingProject) {
    console.log(`🧹 Cleaning up existing demo project: ${existingProject.id}`);

    const repos = await prisma.repository.findMany({
      where: { projectId: existingProject.id },
    });
    const reqs = await prisma.requirement.findMany({
      where: { projectId: existingProject.id },
    });

    for (const repo of repos) {
      const snapshots = await prisma.repositorySnapshot.findMany({
        where: { repositoryId: repo.id },
      });
      for (const snap of snapshots) {
        await prisma.evidence.deleteMany({ where: { snapshotId: snap.id } });
        await prisma.codeArtifact.deleteMany({ where: { snapshotId: snap.id } });
        await prisma.impactAnalysis.deleteMany({ where: { snapshotId: snap.id } });
      }
      await prisma.scanJob.deleteMany({ where: { repositoryId: repo.id } });
      await prisma.repositorySnapshot.deleteMany({ where: { repositoryId: repo.id } });
      await prisma.repositoryTarget.deleteMany({ where: { repositoryId: repo.id } });
    }
    await prisma.repository.deleteMany({ where: { projectId: existingProject.id } });

    for (const req of reqs) {
      await prisma.requirementRevision.deleteMany({
        where: { requirementId: req.id },
      });
    }
    await prisma.requirement.deleteMany({ where: { projectId: existingProject.id } });
    await prisma.projectMember.deleteMany({ where: { projectId: existingProject.id } });

    await prisma.project.delete({ where: { id: existingProject.id } });
  }

  // 2. Create Project
  const project = await prisma.project.create({
    data: { name: DEMO_PROJECT_NAME },
  });
  console.log(`✅ Created Demo Project: ${project.id}`);

  // 3. Add demo user as OWNER of the project
  await prisma.projectMember.create({
    data: {
      projectId: project.id,
      userId: demoUser.id,
      role: 'OWNER',
    },
  });
  console.log(`✅ Demo user added as OWNER of project`);

  // 4. Create Requirement & Revision
  const requirement = await prisma.requirement.create({
    data: { projectId: project.id },
  });

  const revision = await prisma.requirementRevision.create({
    data: {
      requirementId: requirement.id,
      title: 'Refund cancelled bookings',
      rawText: DEMO_REQUIREMENT_TEXT,
      normalizedText: DEMO_REQUIREMENT_TEXT,
      readinessStatus: 'READY_FOR_ANALYSIS',
    },
  });

  // 5. Create Repository, Target, Snapshot, and ScanJob
  const repository = await prisma.repository.create({
    data: {
      projectId: project.id,
      canonicalUrl: DEMO_REPOSITORY_URL,
    },
  });

  const target = await prisma.repositoryTarget.create({
    data: {
      repositoryId: repository.id,
      targetKey: 'main',
      requestedRef: 'main',
      resolvedRefType: 'BRANCH',
      latestObservedCommitSha: 'demo-commit-sha-12345',
      lastObservedAt: new Date(),
    },
  });

  const snapshot = await prisma.repositorySnapshot.create({
    data: {
      repositoryId: repository.id,
      commitSha: 'demo-commit-sha-12345',
      analyzerVersion: '1.0.0',
      coverageStatus: 'READY',
      indexStatus: 'VECTOR_READY',
      diagnostics: [{ code: 'SCAN_HEALTH', message: 'Seeded demo repository snapshot' }],
    },
  });

  await prisma.scanJob.create({
    data: {
      repositoryId: repository.id,
      requestKey: 'demo-scan-job-key',
      requestedRef: 'main',
      status: 'COMPLETED',
      stage: 'DONE',
      progress: 100,
      sourceTargetId: target.id,
      snapshotId: snapshot.id,
    },
  });

  // 6. Create Artifacts
  const [bookingSvc, refundCtrl, inventorySvc] = await Promise.all([
    prisma.codeArtifact.create({
      data: {
        snapshotId: snapshot.id,
        artifactKey: 'api:booking.service.cancelBooking',
        name: 'BookingService.cancelBooking',
        artifactType: 'SERVICE_METHOD',
        filePath: 'src/booking/booking.service.ts',
        startLine: 45,
        endLine: 60,
      },
    }),
    prisma.codeArtifact.create({
      data: {
        snapshotId: snapshot.id,
        artifactKey: 'api:refund.controller.processRefund',
        name: 'RefundController.processRefund',
        artifactType: 'CONTROLLER_METHOD',
        filePath: 'src/billing/refund.controller.ts',
        startLine: 20,
        endLine: 35,
      },
    }),
    prisma.codeArtifact.create({
      data: {
        snapshotId: snapshot.id,
        artifactKey: 'api:inventory.service.releaseRoom',
        name: 'InventoryService.releaseRoom',
        artifactType: 'SERVICE_METHOD',
        filePath: 'src/inventory/inventory.service.ts',
        startLine: 100,
        endLine: 115,
      },
    }),
  ]);

  // 7. Create Evidence
  const [evBooking, evRefund, evInventory] = await Promise.all([
    prisma.evidence.create({
      data: {
        provenanceKey: `demo:evidence:${bookingSvc.id}`,
        sourceType: 'CODE',
        snapshotId: snapshot.id,
        artifactId: bookingSvc.id,
        sourcePath: bookingSvc.filePath,
        startLine: bookingSvc.startLine,
        endLine: bookingSvc.endLine,
        excerpt:
          "async cancelBooking(id: string) {\n  const booking = await this.repo.findById(id);\n  booking.status = 'CANCELLED';\n  await this.repo.save(booking);\n}",
        contentHash: crypto.createHash('md5').update('booking_excerpt').digest('hex'),
      },
    }),
    prisma.evidence.create({
      data: {
        provenanceKey: `demo:evidence:${refundCtrl.id}`,
        sourceType: 'CODE',
        snapshotId: snapshot.id,
        artifactId: refundCtrl.id,
        sourcePath: refundCtrl.filePath,
        startLine: refundCtrl.startLine,
        endLine: refundCtrl.endLine,
        excerpt:
          "@Post(':id/refund')\nasync processRefund(@Param('id') id: string) {\n  // Missing check for already refunded state!\n  return this.billingGateway.issueRefund(id);\n}",
        contentHash: crypto.createHash('md5').update('refund_excerpt').digest('hex'),
      },
    }),
    prisma.evidence.create({
      data: {
        provenanceKey: `demo:evidence:${inventorySvc.id}`,
        sourceType: 'CODE',
        snapshotId: snapshot.id,
        artifactId: inventorySvc.id,
        sourcePath: inventorySvc.filePath,
        startLine: inventorySvc.startLine,
        endLine: inventorySvc.endLine,
        excerpt:
          "async releaseRoom(roomId: string) {\n  await this.db.query('UPDATE inventory SET available = true WHERE room_id = $1', [roomId]);\n}",
        contentHash: crypto.createHash('md5').update('inventory_excerpt').digest('hex'),
      },
    }),
  ]);

  // 8. Scenario A: WAITING_FOR_REVIEW — open review queue
  //    Deliberately includes one INFERRED link to demonstrate:
  //    - the amber badge + confidence bar in the UI (Phase A)
  //    - the INFERRED_LINKS_UNREVIEWED finalize gate block (Phase B)
  const analysisA = await prisma.impactAnalysis.create({
    data: {
      requirementRevisionId: revision.id,
      snapshotId: snapshot.id,
      sourceTargetId: target.id,
      requestKey: 'demo-analysis-scenario-a',
      status: 'WAITING_FOR_REVIEW',
      stage: 'DONE',
      progress: 100,
      metadata: { demoNote: 'Synthetic demo evidence and deterministic links' },
    },
  });

  const insightA1 = await prisma.baInsight.create({
    data: {
      impactAnalysisId: analysisA.id,
      insightKey: 'demo:insight:a1',
      insightType: 'CLAIM',
      certainty: 'EVIDENCED',
      reviewStatus: 'NEEDS_REVIEW',
      title: 'Booking state must be updated to CANCELLED',
      description:
        'The booking service handles the status transition, but needs to orchestrate inventory and refund.',
    },
  });
  await prisma.insightEvidence.create({
    data: { insightId: insightA1.id, evidenceId: evBooking.id },
  });

  const insightA2 = await prisma.baInsight.create({
    data: {
      impactAnalysisId: analysisA.id,
      insightKey: 'demo:insight:a2',
      insightType: 'QA_SCENARIO',
      certainty: 'UNKNOWN',
      reviewStatus: 'NEEDS_REVIEW',
      title: 'Risk: Duplicate Refund Prevention is Missing',
      description:
        'The RefundController does not explicitly check if a booking has already been refunded before calling the gateway.',
    },
  });
  await prisma.insightEvidence.create({
    data: { insightId: insightA2.id, evidenceId: evRefund.id },
  });

  await Promise.all([
    // EVIDENCED link — green badge, confidence 95%
    prisma.traceabilityLink
      .create({
        data: {
          impactAnalysisId: analysisA.id,
          artifactId: bookingSvc.id,
          linkType: 'AFFECTED',
          linkBasis: 'EVIDENCED',
          confidence: 0.95,
          reviewStatus: 'NEEDS_REVIEW',
        },
      })
      .then((link) =>
        prisma.traceabilityEvidence.create({
          data: { traceabilityLinkId: link.id, evidenceId: evBooking.id },
        }),
      ),

    // EVIDENCED link — green badge, confidence 88%
    prisma.traceabilityLink
      .create({
        data: {
          impactAnalysisId: analysisA.id,
          artifactId: refundCtrl.id,
          linkType: 'AFFECTED',
          linkBasis: 'EVIDENCED',
          confidence: 0.88,
          reviewStatus: 'NEEDS_REVIEW',
        },
      })
      .then((link) =>
        prisma.traceabilityEvidence.create({
          data: { traceabilityLinkId: link.id, evidenceId: evRefund.id },
        }),
      ),

    // INFERRED link — amber badge, confidence 62%, blocks finalize gate
    prisma.traceabilityLink
      .create({
        data: {
          impactAnalysisId: analysisA.id,
          artifactId: inventorySvc.id,
          linkType: 'AFFECTED',
          linkBasis: 'INFERRED',
          confidence: 0.62,
          reviewStatus: 'NEEDS_REVIEW',
        },
      })
      .then((link) =>
        prisma.traceabilityEvidence.create({
          data: { traceabilityLinkId: link.id, evidenceId: evInventory.id },
        }),
      ),
  ]);

  console.log(`✅ Seeded Scenario A: WAITING_FOR_REVIEW (Analysis ID: ${analysisA.id})`);

  // 9. Scenario B: reviewed and finalized
  const analysisB = await prisma.impactAnalysis.create({
    data: {
      requirementRevisionId: revision.id,
      snapshotId: snapshot.id,
      sourceTargetId: target.id,
      requestKey: 'demo-analysis-scenario-b',
      status: 'WAITING_FOR_REVIEW',
      stage: 'DONE',
      progress: 100,
    },
  });

  await Promise.all([
    prisma.traceabilityLink.create({
      data: {
        impactAnalysisId: analysisB.id,
        artifactId: bookingSvc.id,
        linkType: 'AFFECTED',
        linkBasis: 'EVIDENCED',
        confidence: 0.95,
        reviewStatus: 'CONFIRMED',
      },
    }),
    prisma.traceabilityLink.create({
      data: {
        impactAnalysisId: analysisB.id,
        artifactId: refundCtrl.id,
        linkType: 'AFFECTED',
        linkBasis: 'EVIDENCED',
        confidence: 0.88,
        reviewStatus: 'CONFIRMED',
      },
    }),
    prisma.traceabilityLink.create({
      data: {
        impactAnalysisId: analysisB.id,
        artifactId: inventorySvc.id,
        linkType: 'AFFECTED',
        linkBasis: 'EVIDENCED',
        confidence: 0.72,
        reviewStatus: 'REJECTED',
      },
    }),
  ]);

  await prisma.reviewedReportSnapshot.create({
    data: {
      analysisId: analysisB.id,
      markdown: '# BA Helper Final Report\n\nSynthetic deterministic export for Scenario B.',
      reviewDecisionsSnapshot: [
        { artifactKey: 'api:booking.service.cancelBooking', decision: 'ACCEPTED' },
        { artifactKey: 'api:refund.controller.processRefund', decision: 'ACCEPTED' },
        { artifactKey: 'api:inventory.service.releaseRoom', decision: 'REJECTED' },
      ],
      evidenceQualitySummarySnapshot: { EVIDENCED: 3 },
      createdByUserId: demoUser.id,
    },
  });

  await prisma.impactAnalysis.update({
    where: { id: analysisB.id },
    data: { status: 'COMPLETED' },
  });

  console.log(`✅ Seeded Scenario B: COMPLETED with Snapshot (Analysis ID: ${analysisB.id})`);

  const divider = '─'.repeat(60);
  console.log(`\n${divider}`);
  console.log(`🎉 Seed Complete!`);
  console.log(divider);
  console.log(`\nLogin credentials:`);
  console.log(`  Email    : ${DEMO_USER_EMAIL}`);
  console.log(`  Password : ${DEMO_USER_PASSWORD}`);
  console.log(`\nProject   : ${DEMO_PROJECT_NAME}`);
  console.log(`Project ID: ${project.id}`);
  console.log(`\nScenario A (open review): ${analysisA.id}`);
  console.log(`Scenario B (finalized)  : ${analysisB.id}`);
  console.log(`${divider}\n`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
