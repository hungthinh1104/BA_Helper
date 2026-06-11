import { z } from 'zod';

export const requirementCreateRequestSchema = z.object({
	title: z.string().trim().min(1).max(200),
	rawText: z.string().trim().min(1).max(5000),
	submitForReadinessCheck: z.boolean().default(true),
});

export const requirementCreateResponseSchema = z.object({
	requirementId: z.string().uuid(),
	revisionId: z.string().uuid(),
	title: z.string(),
	readinessStatus: z.enum([
		'DRAFT',
		'READY_FOR_ANALYSIS',
		'NEEDS_CLARIFICATION',
		'ARCHIVED',
	]),
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
	readinessStatus: z.enum([
		'DRAFT',
		'READY_FOR_ANALYSIS',
		'NEEDS_CLARIFICATION',
		'ARCHIVED',
	]),
	validationIssues: z.array(z.string()).default([]),
});

export type RequirementCreateRequest = z.infer<
	typeof requirementCreateRequestSchema
>;
export type RequirementCreateResponse = z.infer<
	typeof requirementCreateResponseSchema
>;
export type RequirementRevisionCreateRequest = z.infer<
	typeof requirementRevisionCreateRequestSchema
>;
export type RequirementRevisionCreateResponse = z.infer<
	typeof requirementRevisionCreateResponseSchema
>;
export type RequirementRevisionQualifyResponse = z.infer<
	typeof requirementRevisionQualifyResponseSchema
>;
