import 'reflect-metadata';
import 'dotenv/config';
import {
  approvedImpactReportResponseSchema,
  currentWorkspaceResponseSchema,
  insightListResponseSchema,
  repositoryCreateResponseSchema,
  repositoryDetailResponseSchema,
  requirementCreateResponseSchema,
  scanJobResponseSchema,
  systemHealthResponseSchema,
  impactAnalysisResponseSchema,
  ReviewQueueResponse,
} from '@ba-helper/contracts';
import * as process from 'node:process';
import { writeFile } from 'node:fs/promises';
import * as path from 'node:path';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import {
  assertApprovedReport,
  assertCompletedScan,
  assertPreflight,
  assertReviewableAnalysis,
  assertTempWorkspaceCleanup,
  buildSmokeSummary,
  countTempScanWorkspaces,
  formatFailureSummary,
  getPollDeadline,
  getRunbookPath,
  normalizeApiBaseUrl,
  wait,
} from './smoke/public-github-smoke.helpers';
import { publicGitHubSmokeManifest } from './smoke/public-github-smoke.manifest';

const API_URL = normalizeApiBaseUrl(
  process.env.SMOKE_API_URL ??
    process.env.NEXT_PUBLIC_API_URL ??
    `http://localhost:${process.env.PORT ?? '3001'}`,
);
const POLL_INTERVAL_MS = Number(process.env.SMOKE_POLL_INTERVAL_MS ?? '2000');
const REQUEST_TIMEOUT_MS = Number(process.env.SMOKE_REQUEST_TIMEOUT_MS ?? '15000');

async function main() {
  const tempDirsBefore = await countTempScanWorkspaces();
  let partial: Record<string, unknown> = {};

  const pool = new Pool({ connectionString: process.env.DATABASE_URL ?? 'postgresql://ba_helper:ba_helper@localhost/ba_helper' });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter } as any);

  try {
    let health;
    for (let i = 0; i < 15; i++) {
      try {
        health = await apiGet('/api/v1/system/health', systemHealthResponseSchema);
        break;
      } catch (e: any) {
        if (i === 14) throw e;
        await wait(2000);
      }
    }
    const workspace = await apiGet(
      '/api/v1/workspace/current',
      currentWorkspaceResponseSchema,
    );
    assertPreflight(health!, workspace);

    const repositoryResponse = await apiPost(
      `/api/v1/projects/${workspace.projectId}/repositories`,
      { url: publicGitHubSmokeManifest.repositoryUrl },
      repositoryCreateResponseSchema,
    );
    partial = { ...partial, repositoryId: repositoryResponse.repositoryId };

    const scanJob = await apiPost(
      `/api/v1/repositories/${repositoryResponse.repositoryId}/scan-jobs`,
      {
        ref: publicGitHubSmokeManifest.requestedRef,
        requestKey: crypto.randomUUID(),
      },
      scanJobResponseSchema,
    );
    partial = { ...partial, scanJobId: scanJob.id };

    const scanStartTime = Date.now();
    const completedScanJob = await pollScanJob(
      repositoryResponse.repositoryId,
      scanJob.id,
      publicGitHubSmokeManifest.expected.maxScanDurationMs,
    );
    const scanDurationMs = Date.now() - scanStartTime;

    const repositoryDetail = await apiGet(
      `/api/v1/projects/${workspace.projectId}/repositories/${repositoryResponse.repositoryId}`,
      repositoryDetailResponseSchema,
    );
    const scanResult = assertCompletedScan(
      publicGitHubSmokeManifest,
      completedScanJob,
      repositoryDetail,
    );
    partial = { ...partial, snapshotId: scanResult.snapshotId };

    if (process.env.REAL_PATH_SMOKE === 'true') {
      const vectorReadyStartTime = Date.now();
      let vectorReady = false;
      while (Date.now() - vectorReadyStartTime < 60000) {
        const repoCheck = await apiGet(
          `/api/v1/projects/${workspace.projectId}/repositories/${repositoryResponse.repositoryId}`,
          repositoryDetailResponseSchema,
        );
        const idxStatus = repoCheck.latestSnapshot?.indexStatus;
        if (idxStatus === 'VECTOR_READY') {
          vectorReady = true;
          break;
        } else if (idxStatus === 'VECTOR_FAILED') {
          throw new Error('Vector embedding failed (indexStatus is VECTOR_FAILED)');
        }
        await wait(2000);
      }
      if (!vectorReady) {
        // Fetch current snapshot and chunks for debugging
        const diagSnapshot = await prisma.repositorySnapshot.findUnique({
          where: { id: scanResult.snapshotId },
          select: { indexStatus: true },
        });
        const chunkCount = await prisma.embeddingChunk.count({
          where: { snapshotId: scanResult.snapshotId },
        });
        throw new Error(
          `Timeout waiting for snapshot to reach VECTOR_READY. ` +
          `Current status: ${diagSnapshot?.indexStatus}, Chunks in DB: ${chunkCount}`
        );
      }
    }

    const requirement = await apiPost(
      `/api/v1/projects/${workspace.projectId}/requirements`,
      {
        rawText: publicGitHubSmokeManifest.changeRequestRawText,
        title: publicGitHubSmokeManifest.changeRequestTitle,
        submitForReadinessCheck: true,
      },
      requirementCreateResponseSchema,
    );
    partial = { ...partial, requirementId: requirement.requirementId, revisionId: requirement.revisionId };

    const analysis = await apiPost(
      `/api/v1/requirement-revisions/${requirement.revisionId}/impact-analyses`,
      {
        snapshotId: scanResult.snapshotId,
        sourceTargetId: scanResult.sourceTargetId,
        allowPartialSnapshot: scanResult.coverageStatus === 'PARTIAL',
        requestKey: crypto.randomUUID(),
      },
      impactAnalysisResponseSchema,
    );
    partial = { ...partial, analysisId: analysis.id };

    const analysisStartTime = Date.now();
    const completedAnalysis = await pollAnalysis(
      analysis.id,
      publicGitHubSmokeManifest.expected.maxAnalysisDurationMs,
    );
    const analysisDurationMs = Date.now() - analysisStartTime;
    const insights = await apiGet(
      `/api/v1/impact-analyses/${completedAnalysis.id}/insights`,
      insightListResponseSchema,
    );
    assertReviewableAnalysis(publicGitHubSmokeManifest, completedAnalysis, insights);

    const reviewableInsight =
      insights.items.find((item) => item.reviewStatus === 'NEEDS_REVIEW') ??
      insights.items[0];
    if (!reviewableInsight) {
      throw new Error('Analysis returned no reviewable insights.');
    }

    await apiPost(`/api/v1/insights/${reviewableInsight.id}/confirm`, undefined);

    const reviewQueue = await apiGet<ReviewQueueResponse>(
      `/api/v1/impact-analyses/${completedAnalysis.id}/review-queue`,
      { parse: (x) => x as ReviewQueueResponse }, // Using rough any since schema isn't fully exported or just trust the backend. Actually let's use as unknown as ReviewQueueResponse
    );

    const finalizedAnalysis = await apiPost(
      `/api/v1/impact-analyses/${completedAnalysis.id}/finalize`,
      { acknowledgeUnreviewed: true },
      impactAnalysisResponseSchema,
    );

    const approvedReport = await apiGet(
      `/api/v1/impact-analyses/${completedAnalysis.id}/approved-report`,
      approvedImpactReportResponseSchema,
    );
    assertApprovedReport(approvedReport, finalizedAnalysis, scanResult.commitSha);

    await wait(500);
    const tempDirsAfter = await countTempScanWorkspaces();
    const snapshotDb = await prisma.repositorySnapshot.findUnique({ where: { id: scanResult.snapshotId } });
    const chunkCount = await prisma.embeddingChunk.count({ where: { snapshotId: scanResult.snapshotId } });
    const analysisDb = await prisma.impactAnalysis.findUnique({ where: { id: completedAnalysis.id } });
    const metadata = analysisDb?.metadata as any || {};
    
    const vectorInfo = {
      indexStatus: snapshotDb?.indexStatus ?? 'UNKNOWN',
      embeddingChunkCount: chunkCount,
      embeddingModel: 'text-embedding-3-small', // hardcode for smoke or fetch if needed
      vectorSignalCount: metadata?.retrieval?.vectorSignalCount ?? 0,
      hybridSignalCount: metadata?.retrieval?.artifactCount ?? 0,
    };
    const llmInfo = {
      provider: metadata?.llm?.provider ?? 'unknown',
      model: metadata?.llm?.model ?? 'unknown',
      promptVersion: metadata?.llm?.promptVersion ?? 'unknown',
      parseMode: metadata?.llm?.parseMode ?? 'unknown',
      inputTokens: metadata?.llm?.inputTokens ?? 0,
      outputTokens: metadata?.llm?.outputTokens ?? 0,
    };
    await prisma.$disconnect();
    await pool.end();

    const summary = buildSmokeSummary({
      afterTempDirCount: tempDirsAfter,
      analysis: finalizedAnalysis,
      beforeTempDirCount: tempDirsBefore,
      insights,
      manifest: publicGitHubSmokeManifest,
      report: approvedReport,
      repository: { id: repositoryResponse.repositoryId },
      repositoryDetail,
      scanJob: completedScanJob,
      workspace,
      scanDurationMs,
      analysisDurationMs,
      vectorInfo,
      llmInfo,
      reviewQueue,
    });
    assertTempWorkspaceCleanup(summary);

    if (process.env.REAL_PATH_SMOKE === 'true') {
      if (vectorInfo.indexStatus !== 'VECTOR_READY') {
        throw new Error(`Expected VECTOR_READY, got ${vectorInfo.indexStatus}`);
      }
      if (vectorInfo.embeddingChunkCount <= 0) {
        throw new Error('Expected embeddingChunkCount > 0');
      }
      if (vectorInfo.vectorSignalCount <= 0 && vectorInfo.hybridSignalCount <= 0) {
        throw new Error('Expected vectorSignalCount or hybridSignalCount > 0');
      }

      // Phase 6A: Real LLM provider assertions
      const aiProvider = process.env.AI_PROVIDER ?? 'fake';
      if (aiProvider !== 'fake') {
        if (llmInfo.provider === 'fake' || llmInfo.provider === 'unknown') {
          throw new Error(`Expected real LLM provider in metadata, got: ${llmInfo.provider}`);
        }
        if (!llmInfo.model.includes('gemini') && !llmInfo.model.includes('gpt') && !llmInfo.model.includes('claude')) {
          throw new Error(`Expected recognizable real model, got: ${llmInfo.model}`);
        }
        if (llmInfo.parseMode !== 'raw') {
          throw new Error(`Expected parseMode=raw from structured output provider, got: ${llmInfo.parseMode}. Investigate Gemini response format.`);
        }
        if (!llmInfo.promptVersion || llmInfo.promptVersion === 'unknown' || llmInfo.promptVersion === '') {
          throw new Error('Expected promptVersion to be set. Check promptVersion propagation from renderPrompt().');
        }
        if ((llmInfo.inputTokens ?? 0) <= 0) {
          throw new Error('Expected inputTokens > 0 from real provider. Check usageMetadata.');
        }
        // Validate combo: real vector retrieval + real LLM reasoning
        if (vectorInfo.indexStatus !== 'VECTOR_READY') {
          throw new Error(`Expected VECTOR_READY snapshot for real LLM smoke, got: ${vectorInfo.indexStatus}`);
        }
        console.log(
          `\n✅ Phase 6A LLM Assertions Passed:\n` +
          `   provider=${llmInfo.provider} | model=${llmInfo.model}\n` +
          `   promptVersion=${llmInfo.promptVersion} | parseMode=${llmInfo.parseMode}\n` +
          `   inputTokens=${llmInfo.inputTokens} | outputTokens=${llmInfo.outputTokens}\n`,
        );
      }
    }

    const outStr = JSON.stringify({ status: 'ok', summary }, null, 2);
    process.stdout.write(`${outStr}\n`);
    
    const runbookDir = path.dirname(getRunbookPath());
    const isRealPath = process.env.REAL_PATH_SMOKE === 'true';
    const isRealLlm = process.env.REAL_LLM_SMOKE === 'true';
    const summaryFileName = isRealPath ? 'public-github-smoke-real-path-output.json' : (isRealLlm ? 'public-github-smoke-real-llm-output.json' : 'public-github-smoke-summary.json');
    await writeFile(path.join(runbookDir, summaryFileName), outStr);
    
  } catch (error) {
    const errorSummary = formatFailureSummary(error, {
        apiUrl: API_URL,
        manifest: publicGitHubSmokeManifest.name,
        runbook: getRunbookPath(),
        ...partial,
      });
    process.stderr.write(`${errorSummary}\n`);
    
    try {
      const runbookDir = path.dirname(getRunbookPath());
      const isRealPath = process.env.REAL_PATH_SMOKE === 'true';
      const isRealLlm = process.env.REAL_LLM_SMOKE === 'true';
      const failedFileName = isRealPath ? 'public-github-smoke-real-path-failed.json' : (isRealLlm ? 'public-github-smoke-real-llm-failed.json' : 'public-github-smoke-last-failed.json');
      await writeFile(path.join(runbookDir, failedFileName), errorSummary);
    } catch {}
    
    process.exit(1);
  }
}

async function pollScanJob(
  repositoryId: string,
  scanJobId: string,
  timeoutMs: number,
) {
  const deadline = getPollDeadline(timeoutMs);

  for (;;) {
    const job = await apiGet(
      `/api/v1/repositories/${repositoryId}/scan-jobs/${scanJobId}`,
      scanJobResponseSchema,
    );

    if (job.status === 'COMPLETED') {
      return job;
    }

    if (job.status === 'FAILED' || job.status === 'CANCELLED') {
      throw new Error(
        `Scan job failed with status=${job.status} code=${job.error?.code ?? 'UNKNOWN'}`,
      );
    }

    if (Date.now() >= deadline) {
      if (job.status === 'QUEUED') {
        throw new Error('WORKER_NOT_PROCESSING: Scan job timed out while still QUEUED. Check if worker is running and consuming jobs.');
      }
      throw new Error('Scan job timed out before reaching COMPLETED.');
    }

    await wait(POLL_INTERVAL_MS);
  }
}

async function pollAnalysis(analysisId: string, timeoutMs: number) {
  const deadline = getPollDeadline(timeoutMs);

  for (;;) {
    const analysis = await apiGet(
      `/api/v1/impact-analyses/${analysisId}`,
      impactAnalysisResponseSchema,
    );

    if (analysis.status === 'WAITING_FOR_REVIEW' || analysis.status === 'COMPLETED') {
      return analysis;
    }

    if (analysis.status === 'FAILED' || analysis.status === 'CANCELLED') {
      throw new Error(`Impact analysis failed with status=${analysis.status}`);
    }

    if (Date.now() >= deadline) {
      if (analysis.status === 'QUEUED') {
        throw new Error('WORKER_NOT_PROCESSING: Impact analysis timed out while still QUEUED. Check if worker is running and consuming jobs.');
      }
      throw new Error('Impact analysis timed out before reaching a reviewable state.');
    }

    await wait(POLL_INTERVAL_MS);
  }
}

async function apiGet<T>(
  path: string,
  schema: { parse: (input: unknown) => T },
): Promise<T> {
  const response = await fetchWithTimeout(`${API_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    method: 'GET',
  });
  const payload = await parseJson(response);

  if (!response.ok) {
    throw new Error(
      `GET ${path} failed with ${response.status}: ${getApiErrorMessage(payload)}`,
    );
  }

  return schema.parse(payload);
}

async function apiPost<T>(
  path: string,
  body: unknown,
  schema?: { parse: (input: unknown) => T },
): Promise<T> {
  const response = await fetchWithTimeout(`${API_URL}${path}`, {
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
  });
  const payload = await parseJson(response);

  if (!response.ok) {
    throw new Error(
      `POST ${path} failed with ${response.status}: ${getApiErrorMessage(payload)}`,
    );
  }

  return schema ? schema.parse(payload) : (payload as T);
}

async function fetchWithTimeout(
  input: string,
  init: RequestInit,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    try {
      return await fetch(input, {
        ...init,
        signal: controller.signal,
      });
    } catch (error) {
      const reason =
        error instanceof Error && error.name === 'AbortError'
          ? `request timed out after ${REQUEST_TIMEOUT_MS}ms`
          : error instanceof Error
            ? error.message
            : 'unknown network error';
      throw new Error(`Cannot reach API at ${API_URL}: ${reason}`);
    }
  } finally {
    clearTimeout(timeout);
  }
}

async function parseJson(response: Response): Promise<unknown> {
  return response.json().catch(() => null);
}

function getApiErrorMessage(payload: unknown): string {
  if (
    typeof payload === 'object' &&
    payload !== null &&
    'message' in payload &&
    typeof payload.message === 'string'
  ) {
    return payload.message;
  }

  return 'Unknown error';
}

void main();
