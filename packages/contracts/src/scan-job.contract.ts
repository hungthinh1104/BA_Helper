import { z } from 'zod';
import { diagnosticItemSchema } from './diagnostic.contract';

export const scanJobCreateRequestSchema = z.object({
	ref: z.string().min(1).optional(),
	requestKey: z.string().uuid(),
});

export const scanJobStatusSchema = z.enum([
	'QUEUED',
	'RUNNING',
	'COMPLETED',
	'FAILED',
	'CANCELLED',
]);

export const scanJobStageSchema = z.enum([
	'WAITING',
	'CLONING_REPO',
	'RESOLVING_SOURCE_REF',
	'DETECTING_PROJECT',
	'FILTERING_FILES',
	'EXTRACTING_ARTIFACTS',
	'BUILDING_GRAPH',
	'GENERATING_SUMMARIES',
	'DONE',
]);

export const scanJobResponseSchema = z.object({
	id: z.string().uuid(),
	status: scanJobStatusSchema,
	stage: scanJobStageSchema,
	progress: z.number().min(0).max(100),
    diagnostics: z.array(diagnosticItemSchema).optional(),
	error: z
		.object({
			code: z.string(),
			message: z.string(),
		})
		.nullable(),
	result: z.object({
		sourceTargetId: z.string().uuid().nullable(),
		snapshotId: z.string().uuid().nullable(),
		snapshotCoverageStatus: z.enum(['READY', 'PARTIAL']).nullable(),
	}),
	capabilities: z.object({
		canCancel: z.boolean(),
		canRerun: z.boolean(),
	}),
	createdAt: z.string(),
	updatedAt: z.string(),
});

export type ScanJobCreateRequest = z.infer<typeof scanJobCreateRequestSchema>;
export type ScanJobResponse = z.infer<typeof scanJobResponseSchema>;
