import { z } from 'zod';
import { workspaceModeSchema } from './project.contract';

export const systemDependencyStatusSchema = z.enum(['up', 'down']);

export const systemDependenciesSchema = z.object({
  database: systemDependencyStatusSchema,
  pgvector: systemDependencyStatusSchema,
  queue: systemDependencyStatusSchema,
  redis: systemDependencyStatusSchema,
});

export const systemJobQueueSummarySchema = z.object({
  status: systemDependencyStatusSchema,
  pending: z.number().int().nonnegative(),
  running: z.number().int().nonnegative(),
  failed: z.number().int().nonnegative(),
});

export const systemOperationsSummarySchema = z.object({
  scanJobs: systemJobQueueSummarySchema,
  analysisJobs: systemJobQueueSummarySchema,
  documentJobs: systemJobQueueSummarySchema,
});

/**
 * Public liveness — process is up. No dependency or operational detail, so it is
 * safe to expose unauthenticated (used by container/orchestrator probes).
 */
export const systemLivenessResponseSchema = z.object({
  status: z.literal('ok'),
  serverTime: z.string(),
  apiVersion: z.string(),
});

/**
 * Public readiness — dependency up/down only. Deliberately excludes workspace
 * configuration and queue counts so the public surface leaks no operational data.
 */
export const systemReadinessResponseSchema = z.object({
  status: z.enum(['ok', 'degraded']),
  serverTime: z.string(),
  apiVersion: z.string(),
  dependencies: systemDependenciesSchema,
});

/**
 * ADMIN-only operations view — queue counts, failed-job data, and workspace
 * configuration. Never exposed on a public endpoint.
 */
export const systemOperationsResponseSchema = z.object({
  status: z.enum(['ok', 'degraded']),
  serverTime: z.string(),
  apiVersion: z.string(),
  workspaceMode: workspaceModeSchema,
  dependencies: systemDependenciesSchema,
  operations: systemOperationsSummarySchema,
});

export type SystemDependencies = z.infer<typeof systemDependenciesSchema>;
export type SystemLivenessResponse = z.infer<typeof systemLivenessResponseSchema>;
export type SystemReadinessResponse = z.infer<typeof systemReadinessResponseSchema>;
export type SystemOperationsResponse = z.infer<typeof systemOperationsResponseSchema>;
export type SystemJobQueueSummary = z.infer<typeof systemJobQueueSummarySchema>;
export type SystemOperationsSummary = z.infer<typeof systemOperationsSummarySchema>;
