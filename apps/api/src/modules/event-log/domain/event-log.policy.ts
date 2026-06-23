import { AppError } from '../../../shared/app-error';

export const EventLogPolicy = {
  validateEventPayload: (params: {
    eventType: string;
    actorUserId: string;
    idempotencyKey?: string | null;
    isRetryable: boolean;
    metadata?: Record<string, any>;
  }) => {
    // 1. Event type must be known
    const knownEventTypes = [
      'PROJECT_CREATED',
      'REPOSITORY_CREATED',
      'SCAN_STARTED',
      'SCAN_ARTIFACTS_EXTRACTED',
      'SCAN_DEPENDENCY_EDGES_PERSISTED',
      'SCAN_COMPLETED',
      'SCAN_FAILED',
      'REPOSITORY_TARGET_OBSERVED',
      'REQUIREMENT_CREATED',
      'ANALYSIS_STARTED',
      'ANALYSIS_EVIDENCE_RETRIEVED',
      'ANALYSIS_AI_REASONING_COMPLETED',
      'ANALYSIS_WAITING_FOR_REVIEW',
      'ANALYSIS_FAILED',
      'INSIGHT_CONFIRMED',
      'INSIGHT_REJECTED',
      'TRACEABILITY_LINK_CONFIRMED',
      'TRACEABILITY_LINK_REJECTED',
      'ANALYSIS_FINALIZED',
      'DOCUMENT_EXPORTED',
      'CLARIFICATION_REQUESTED',
      'CLARIFICATION_ANSWERED',
      'REVIEW_DECISION',
      // Added missing types from codebase
      'REQUIREMENT_REVISION_CREATED',
      'REQUIREMENT_REVISION_QUALIFIED',
      'INSIGHT_REVIEWED',
      'IMPACT_ANALYSIS_QUEUED',
      'IMPACT_ANALYSIS_FINALIZED',
      'WORKSPACE_DEFAULT_PROJECT_CREATED',
      'SCAN_JOB_COMPLETED',
      'SCAN_JOB_FAILED',
      'SCAN_JOB_QUEUED',
      'TRACEABILITY_REVIEWED',
      'PROJECT_SELECTED',
      'PROJECT_MEMBER_UPSERTED',
      'PROJECT_MEMBER_UPDATED',
      'PROJECT_MEMBER_REMOVED',
      'TRACEABILITY_REVIEW_DECISION_UPDATED',
      'TRACEABILITY_REVIEW_DECISION_DELETED',
      'REVIEWED_REPORT_SNAPSHOT_CREATED',
    ];

    if (!knownEventTypes.includes(params.eventType)) {
      throw new AppError('UNKNOWN_EVENT_TYPE', `Event type ${params.eventType} is not recognized.`);
    }

    // 2. Actor must be bounded string
    if (!params.actorUserId || params.actorUserId.trim() === '') {
      throw new AppError('INVALID_ACTOR', 'Actor cannot be empty.');
    }
    if (params.actorUserId.length > 100) {
      throw new AppError('INVALID_ACTOR', 'Actor string exceeds 100 characters limit.');
    }

    // 3. Metadata size must be bounded
    if (params.metadata) {
      const size = Buffer.from(JSON.stringify(params.metadata)).length;
      if (size > 10000) { // 10KB limit
        throw new AppError('EVENT_METADATA_TOO_LARGE', 'Event metadata exceeds 10KB limit.');
      }
    }

    // 4. Idempotency Key validations
    if (params.isRetryable) {
      if (!params.idempotencyKey) {
        throw new AppError('MISSING_IDEMPOTENCY_KEY', `Retryable event ${params.eventType} must have an idempotency key.`);
      }
    }

    if (params.idempotencyKey) {
      // Format should generally be <domain>:<entityId>:<action>:<version-or-hash>
      const parts = params.idempotencyKey.split(':');
      if (parts.length < 3) {
        throw new AppError('INVALID_IDEMPOTENCY_KEY', 'Idempotency key must follow a stable format like <domain>:<entityId>:<action>[:<version>].');
      }
    }
  },
};
