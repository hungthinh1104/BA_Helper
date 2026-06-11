import { z } from 'zod';

export const requirementReadinessStatusSchema = z.enum([
	'DRAFT',
	'READY_FOR_ANALYSIS',
	'NEEDS_CLARIFICATION',
	'ARCHIVED',
]);

export const requirementCreateRequestSchema = z.object({
	title: z.string().trim().min(1).max(200),
	rawText: z.string().trim().min(1).max(5000),
	submitForReadinessCheck: z.boolean().default(true),
});

export const requirementCreateResponseSchema = z.object({
	requirementId: z.string().uuid(),
	revisionId: z.string().uuid(),
	title: z.string(),
	readinessStatus: requirementReadinessStatusSchema,
	validationIssues: z.array(z.string()).default([]),
});

export const requirementRevisionCreateRequestSchema = z.object({
	title: z.string().trim().min(1).max(200),
	rawText: z.string().trim().min(1).max(5000),
	submitForReadinessCheck: z.boolean().default(true),
});

export const requirementRevisionCreateResponseSchema = requirementCreateResponseSchema;

export const requirementRevisionQualifyResponseSchema = z.object({
	revisionId: z.string().uuid(),
	readinessStatus: requirementReadinessStatusSchema,
	validationIssues: z.array(z.string()).default([]),
});

export const requirementRevisionSchema = z.object({
	id: z.string().uuid(),
	versionNumber: z.number().int().min(1),
	title: z.string(),
	rawText: z.string(),
	readinessStatus: requirementReadinessStatusSchema,
	validationIssues: z.array(z.string()),
	createdAt: z.string(),
});

export const requirementListItemResponseSchema = z.object({
	id: z.string().uuid(),
	latestRevision: requirementRevisionSchema,
	canStartAnalysis: z.boolean(),
});

export const requirementListResponseSchema = z.object({
	items: z.array(requirementListItemResponseSchema),
});

export const requirementDetailResponseSchema = z.object({
	id: z.string().uuid(),
	revisions: z.array(requirementRevisionSchema),
});

export type RequirementCreateRequest = z.infer<typeof requirementCreateRequestSchema>;
export type RequirementCreateResponse = z.infer<typeof requirementCreateResponseSchema>;
export type RequirementRevisionCreateRequest = z.infer<typeof requirementRevisionCreateRequestSchema>;
export type RequirementRevisionCreateResponse = z.infer<typeof requirementRevisionCreateResponseSchema>;
export type RequirementRevisionQualifyResponse = z.infer<typeof requirementRevisionQualifyResponseSchema>;

export type RequirementRevisionResponse = z.infer<typeof requirementRevisionSchema>;
export type RequirementListItemResponse = z.infer<typeof requirementListItemResponseSchema>;
export type RequirementListResponse = z.infer<typeof requirementListResponseSchema>;
export type RequirementDetailResponse = z.infer<typeof requirementDetailResponseSchema>;
