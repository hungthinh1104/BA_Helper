import { z } from 'zod';
import { workspaceModeSchema } from './project.contract';

export const systemDependencyStatusSchema = z.enum(['up', 'down']);

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
});

export type SystemHealthResponse = z.infer<typeof systemHealthResponseSchema>;
