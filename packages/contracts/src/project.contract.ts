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

export const projectListItemResponseSchema = z.object({
	projectId: z.string().uuid(),
	name: z.string(),
	membershipRole: projectRoleSchema,
	isSelected: z.boolean(),
	createdAt: z.string(),
});

export const projectListResponseSchema = z.object({
	items: z.array(projectListItemResponseSchema),
});

export const selectProjectRequestSchema = z.object({
	projectId: z.string().uuid(),
});

export const projectMemberListItemResponseSchema = z.object({
	userId: z.string().uuid(),
	email: z.string().email(),
	name: z.string().nullable(),
	role: projectRoleSchema,
	createdAt: z.string(),
});

export const projectMemberListResponseSchema = z.object({
	items: z.array(projectMemberListItemResponseSchema),
});

export const projectMemberUpsertRequestSchema = z.object({
	email: z.string().trim().email().max(254),
	role: projectRoleSchema,
});

export const projectMemberUpdateRequestSchema = z.object({
	role: projectRoleSchema,
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
export type ProjectListItemResponse = z.infer<typeof projectListItemResponseSchema>;
export type ProjectListResponse = z.infer<typeof projectListResponseSchema>;
export type SelectProjectRequest = z.infer<typeof selectProjectRequestSchema>;
export type ProjectMemberListItemResponse = z.infer<typeof projectMemberListItemResponseSchema>;
export type ProjectMemberListResponse = z.infer<typeof projectMemberListResponseSchema>;
export type ProjectMemberUpsertRequest = z.infer<typeof projectMemberUpsertRequestSchema>;
export type ProjectMemberUpdateRequest = z.infer<typeof projectMemberUpdateRequestSchema>;
export type CurrentWorkspaceResponse = z.infer<typeof currentWorkspaceResponseSchema>;
export type ProjectRole = z.infer<typeof projectRoleSchema>;
