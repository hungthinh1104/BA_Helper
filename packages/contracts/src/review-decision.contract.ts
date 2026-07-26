import { z } from 'zod';
import {
	analysisWorkspaceReviewActionSchema,
	analysisWorkspaceReviewDecisionSchema,
} from './analysis-workspace.contract';

/**
 * Which kind of review item a decision targets. `impact` maps to a traceability
 * link; `insight` covers every insight-backed item (risk / unknown / qa / evidence).
 */
export const reviewItemDecisionTargetSchema = z.enum(['impact', 'insight']);

export const submitReviewItemDecisionRequestSchema = z.object({
	target: reviewItemDecisionTargetSchema,
	action: analysisWorkspaceReviewActionSchema,
	rationale: z.string().trim().max(2000).nullish(),
});

export const submitReviewItemDecisionResponseSchema = z.object({
	itemId: z.string(),
	target: reviewItemDecisionTargetSchema,
	currentDecision: analysisWorkspaceReviewDecisionSchema,
	reviewNote: z.string().nullable(),
	/** True when the request matched the persisted state and no write occurred. */
	idempotent: z.boolean(),
});

export type ReviewItemDecisionTarget = z.infer<typeof reviewItemDecisionTargetSchema>;
export type SubmitReviewItemDecisionRequest = z.infer<
	typeof submitReviewItemDecisionRequestSchema
>;
export type SubmitReviewItemDecisionResponse = z.infer<
	typeof submitReviewItemDecisionResponseSchema
>;
