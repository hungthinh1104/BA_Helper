import * as c from '@ba-helper/contracts';
import { operation as op, type ControllerDocs } from './operation-doc';

export const reviewDocs: Record<string, ControllerDocs> = {
  ImpactAnalysisReviewController: { tag: 'Review decisions & notes', operations: {
    getReviewCoverageEndpoint: op('Read multi-repository review coverage gates', c.reviewCoverageResponseSchema),
    createReviewDecisionEndpoint: op('Record an analysis review decision', c.reviewDecisionCreateResponseSchema, { body: c.reviewDecisionRequestSchema, permission: 'review:write' }),
    listReviewDecisionsEndpoint: op('List analysis review decisions', c.reviewDecisionListResponseSchema),
    getLatestReviewDecisionEndpoint: op('Read the latest analysis review decision', c.reviewDecisionResponseSchema),
  } },
  ReviewDecisionController: { tag: 'Review decisions & notes', operations: {
    submit: op('Submit a decision on an impact or insight review item', c.submitReviewItemDecisionResponseSchema, { body: c.submitReviewItemDecisionRequestSchema, permission: 'review:write', description: 'Preferred workbench mutation. The target selects the persisted item type. Review is gated by analysis state and observed source freshness.' }),
  } },
  ReviewNoteController: { tag: 'Review decisions & notes', operations: {
    listNotes: op('List analysis review notes', c.reviewNoteListResponseSchema),
    saveNote: op('Save a review note', c.reviewNoteSchema, { body: c.createReviewNoteRequestSchema, permission: 'review:write', description: 'Provide exactly one of insightId or traceabilityLinkId. Both and neither are rejected. This POST returns 200.' }),
  } },
  InsightController: { tag: 'Insights & traceability', operations: {
    list: op('Read evidence-backed insights and unknowns', c.insightListResponseSchema),
    confirm: op('Confirm an insight', c.okResponseSchema, { permission: 'review:write' }),
    reject: op('Reject an insight', c.okResponseSchema, { permission: 'review:write' }),
    review: op('Review an insight', c.okResponseSchema, { body: c.insightReviewRequestSchema, permission: 'review:write' }),
  } },
  TraceabilityController: { tag: 'Insights & traceability', operations: {
    list: op('Read requirement-to-artifact traceability links', c.traceabilityLinkListResponseSchema),
    confirm: op('Confirm a traceability link', c.okResponseSchema, { permission: 'review:write' }),
    reject: op('Reject a traceability link', c.okResponseSchema, { permission: 'review:write' }),
    review: op('Review a traceability link', c.okResponseSchema, { body: c.traceabilityReviewRequestSchema, permission: 'review:write' }),
    updateReviewDecision: op('Set a traceability review decision', c.okResponseSchema, { body: c.updateTraceabilityReviewDecisionRequestSchema, permission: 'review:write' }),
    deleteReviewDecision: op('Clear a traceability review decision', c.successResponseSchema, { permission: 'review:write' }),
    getReviewCompletionGate: op('Read review completion and blocking reasons', c.reviewCompletionResponseSchema),
  } },
  ClarificationController: { tag: 'Clarifications', operations: {
    list: op('List analysis clarifications', c.ClarificationListResponseSchema),
    create: op('Create an analysis clarification', c.ClarificationItemDtoSchema, { body: c.CreateClarificationRequestSchema, permission: 'clarification:write' }),
    answer: op('Answer an analysis clarification', c.ClarificationItemDtoSchema, { body: c.AnswerClarificationRequestSchema, permission: 'clarification:write' }),
    dismiss: op('Dismiss an analysis clarification', c.ClarificationItemDtoSchema, { body: c.DismissClarificationRequestSchema, permission: 'clarification:write' }),
    convertToRevision: op('Convert a clarification answer into a requirement revision', c.ConvertClarificationResponseSchema, { permission: 'requirement:create' }),
  } },
  ReviewClarificationController: { tag: 'Clarifications', operations: {
    create: op('Request clarification during review', c.reviewClarificationRequestSchema, { body: c.reviewClarificationCreateRequestSchema, permission: 'clarification:write' }),
    listReviewClarifications: op('List review clarification requests', c.reviewClarificationListResponseSchema),
    answer: op('Answer a review clarification request', c.reviewClarificationRequestSchema, { body: c.reviewClarificationAnswerRequestSchema, permission: 'clarification:write' }),
    createDerivedAnalysisFromClarification: op('Create a derived analysis from an answered clarification', c.impactAnalysisResponseSchema, { permission: 'analysis:create-derived' }),
  } },
};
