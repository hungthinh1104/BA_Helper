import { z } from 'zod';
import { workspaceModeSchema } from './project.contract';

export const systemDependencyStatusSchema = z.enum(['up', 'down']);

export const systemJobQueueSummarySchema = z.object({
  status: systemDependencyStatusSchema,
  pending: z.number().int().nonnegative(),
  running: z.number().int().nonnegative(),
  failed: z.number().int().nonnegative(),
});

export const systemHealthResponseSchema = z.object({
  status: z.enum(['ok', 'degraded']),
  serverTime: z.string(),
  apiVersion: z.string(),
  workspaceMode: workspaceModeSchema,
  dependencies: z.object({
    database: systemDependencyStatusSchema,
    pgvector: systemDependencyStatusSchema,
    queue: systemDependencyStatusSchema,
    redis: systemDependencyStatusSchema,
  }),
  operations: z.object({
    scanJobs: systemJobQueueSummarySchema,
    analysisJobs: systemJobQueueSummarySchema,
    documentJobs: systemJobQueueSummarySchema,
  }),
});

export type SystemHealthResponse = z.infer<typeof systemHealthResponseSchema>;
export type SystemJobQueueSummary = z.infer<typeof systemJobQueueSummarySchema>;
