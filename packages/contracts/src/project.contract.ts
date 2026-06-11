import { z } from 'zod';

export const workspaceModeSchema = z.enum(['dev-single-user']);
export const projectRoleSchema = z.enum([
	'OWNER',
	'MAINTAINER',
	'ANALYST',
	'REVIEWER',
	'VIEWER',
]);

export const projectCreateRequestSchema = z.object({
	name: z.string().trim().min(1).max(200),
});

export const projectCreateResponseSchema = z.object({
	projectId: z.string().uuid(),
	name: z.string(),
	createdAt: z.string(),
});

export const currentWorkspaceResponseSchema = z.object({
	projectId: z.string().uuid(),
	name: z.string(),
	mode: workspaceModeSchema,
	membershipRole: projectRoleSchema.nullable(),
	createdAt: z.string(),
});

export type ProjectCreateRequest = z.infer<typeof projectCreateRequestSchema>;
export type ProjectCreateResponse = z.infer<typeof projectCreateResponseSchema>;
export type CurrentWorkspaceResponse = z.infer<typeof currentWorkspaceResponseSchema>;
export type ProjectRole = z.infer<typeof projectRoleSchema>;
