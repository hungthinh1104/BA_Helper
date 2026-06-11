import { PrismaClient } from '@prisma/client';
import { resolve } from 'node:path';

import * as dotenv from 'dotenv';
dotenv.config();
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL ?? 'postgresql://ba_helper:ba_helper@localhost:5432/ba_helper',
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter } as any);

async function runSmokeTest() {
  console.log('--- Starting Smoke E2E Test ---');
  
  // 1. Create Project
  const project = await prisma.project.create({
    data: { name: 'Smoke Test Project' },
  });
  console.log(`[x] Project created: ${project.id}`);

  // 2. Create Requirement Revision
  const requirement = await prisma.requirement.create({
    data: { projectId: project.id },
  });
  const revision = await prisma.requirementRevision.create({
    data: {
      requirementId: requirement.id,
      title: 'Smoke Test Requirement',
      rawText: 'Allow users to cancel paid bookings.',
      normalizedText: 'Allow users to cancel paid bookings.',
      readinessStatus: 'READY_FOR_ANALYSIS',
    },
  });
  console.log(`[x] Requirement & Revision created: ${revision.id}`);

  // 3. Create Repository (local fixture)
  const repo = await prisma.repository.create({
    data: {
      projectId: project.id,
      canonicalUrl: resolve(__dirname, '../tests/fixtures/nestjs-booking-with-payment'),
    },
  });
  console.log(`[x] Repository created: ${repo.id}`);

  // We should trigger the API so it goes through BullMQ, but for a smoke script
  // we can just call the endpoints.
  
  // Let's use fetch API to hit the backend directly.
  const API_URL = 'http://localhost:3001/api/v1';
  console.log(`\nTriggering Scan Job via API at ${API_URL}`);
  
  const scanResponse = await fetch(`${API_URL}/repositories/${repo.id}/scan-jobs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      requestKey: '123e4567-e89b-12d3-a456-426614174000',
      ref: 'main',
    }),
  });
  
  if (!scanResponse.ok) {
    const errorText = await scanResponse.text();
    console.error('Failed to create scan job:', errorText);
    process.exit(1);
  }
  
  const scanJob = await scanResponse.json();
  console.log(`[x] Scan Job queued: ${scanJob.id}`);
  
  // Wait for scan job to complete
  console.log('Waiting for Scan Job to complete...');
  let completed = false;
  let finalStatus: any = null;
  for (let i = 0; i < 30; i++) {
    await new Promise(resolve => setTimeout(resolve, 1000));
    const statusResponse = await fetch(`${API_URL}/repositories/${repo.id}/scan-jobs/${scanJob.id}`);
    finalStatus = await statusResponse.json();
    console.log(`  - status: ${finalStatus.status}, progress: ${finalStatus.progress}`);
    if (finalStatus.status === 'COMPLETED') {
      completed = true;
      break;
    } else if (finalStatus.status === 'FAILED') {
      console.error('Scan job failed:', finalStatus.error);
      process.exit(1);
    }
  }
  
  if (!completed) {
    console.error('Scan job timed out');
    process.exit(1);
  }

  console.log('Final Scan Job Result:', finalStatus.result);

  // Phase D: Trigger Impact Analysis
  console.log(`\nTriggering Impact Analysis via API...`);
  const analysisResponse = await fetch(
    `${API_URL}/requirement-revisions/${revision.id}/impact-analyses`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        snapshotId: finalStatus.result.snapshotId,
        sourceTargetId: finalStatus.result.sourceTargetId,
        allowPartialSnapshot: false,
        requestKey: crypto.randomUUID(),
      }),
    }
  );

  if (!analysisResponse.ok) {
    const errorText = await analysisResponse.text();
    console.error('Failed to create impact analysis:', errorText);
    process.exit(1);
  }

  const analysis = await analysisResponse.json();
  console.log(`[x] Impact Analysis queued: ${analysis.id}`);

  console.log('Waiting for Impact Analysis to complete...');
  let analysisCompleted = false;
  for (let i = 0; i < 30; i++) {
    await new Promise(resolve => setTimeout(resolve, 1000));
    const statusResponse = await fetch(`${API_URL}/impact-analyses/${analysis.id}`);
    const aStatus = await statusResponse.json();
    console.log(`  - status: ${aStatus.status}, stage: ${aStatus.stage}, progress: ${aStatus.progress}`);
    if (aStatus.status === 'WAITING_FOR_REVIEW' || aStatus.status === 'COMPLETED') {
      analysisCompleted = true;
      break;
    } else if (aStatus.status === 'FAILED') {
      console.error('Analysis failed:', aStatus.error);
      process.exit(1);
    }
  }

  if (!analysisCompleted) {
    console.error('Impact analysis timed out');
    process.exit(1);
  }
  
  console.log('--- Smoke Test Completed Successfully! ---');
  process.exit(0);
}

runSmokeTest().catch(console.error);
