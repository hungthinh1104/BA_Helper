import { z } from 'zod';


export const repositoryRefTypeSchema = z.enum(['BRANCH', 'TAG', 'COMMIT']);

export const repositoryTargetSchema = z.object({
  id: z.string().uuid(),
  repositoryId: z.string().uuid(),
  targetRef: z.string(),
  targetType: repositoryRefTypeSchema.optional(),
  resolvedCommitSha: z.string().optional(),
  lastResolvedAt: z.string().datetime().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const repositoryTargetResponseSchema = repositoryTargetSchema;

export const repositoryTargetListResponseSchema = z.object({
  items: z.array(repositoryTargetResponseSchema),
});

export const createRepositoryTargetRequestSchema = z.object({
  targetRef: z.string().min(1),
  targetType: repositoryRefTypeSchema.optional(),
});

export type RepositoryTarget = z.infer<typeof repositoryTargetSchema>;
export type RepositoryTargetResponse = z.infer<typeof repositoryTargetResponseSchema>;
export type RepositoryTargetListResponse = z.infer<typeof repositoryTargetListResponseSchema>;
export type CreateRepositoryTargetRequest = z.infer<typeof createRepositoryTargetRequestSchema>;
export type RepositoryRefType = z.infer<typeof repositoryRefTypeSchema>;
