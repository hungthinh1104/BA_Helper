import * as c from '@ba-helper/contracts';
import { operation as op, type ControllerDocs } from './operation-doc';

export const reportSystemDocs: Record<string, ControllerDocs> = {
  DocumentController: { tag: 'Reviewed reports & exports', operations: {
    list: op('List generated analysis documents', c.documentListResponseSchema),
    getApprovedReportEndpoint: op('Read the approved impact report', c.approvedImpactReportResponseSchema),
    exportApprovedReportEndpoint: op('Download the approved impact report as Markdown', 'markdown', { permission: 'report:export' }),
    exportApprovedReportPdfEndpoint: op('Download the approved impact report as PDF', 'pdf', { permission: 'report:export' }),
    createSnapshot: op('Save an immutable reviewed report snapshot', c.reviewedReportSnapshotSchema, { permission: 'analysis:finalize', description: 'Freezes persisted review content and provenance, including the static trace appendix. Requires applicable state, review and freshness gates.' }),
    getLatestSnapshot: op('Read the latest immutable reviewed report snapshot', c.reviewedReportSnapshotSchema),
    getFinalReviewedReportGate: op('Read final report availability and saved content', c.finalReviewedReportResponseSchema, { query: c.localeAwareReportQuerySchema, description: 'Use backend capabilities and blocking reasons to determine available actions. Historical saved content retains its original immutable provenance.' }),
    enqueueJob: op('Queue or reuse reviewed report generation', c.documentJobSchema, { body: c.documentJobCreateRequestSchema, optionalBody: true, permission: 'report:export', description: 'Requires a completed, non-stale analysis with a saved reviewed report snapshot. retry=true requeues a failed job; otherwise the existing job is reused. documentType is fixed to IMPACT_REPORT.' }),
  } },
  LocalizationController: { tag: 'Report localization', operations: {
    generateLocalizedReport: op('Generate a localized approved report', c.localizedReportArtifactSchema, { body: c.generateLocalizedReportRequestSchema, description: 'Requires analysis read access and an approved source report. Translation failure returns 500; localized content never becomes source evidence.' }),
    getLocalizationStatus: op('Read translation status against the approved source', c.localizationStatusResponseSchema),
  } },
  DomainPackController: { tag: 'Domain packs', operations: {
    listDomainPacks: op('List controlled domain terminology and risk hints', c.domainPackRegistryResponseSchema, { description: 'Domain packs are hints, not persisted source evidence. They cannot independently create EVIDENCED claims.' }),
  } },
  SystemController: { tag: 'System & operations', operations: {
    getLive: op('Check API process liveness', c.systemLivenessResponseSchema),
    getReady: op('Check database, pgvector, Redis and queue readiness', c.systemReadinessResponseSchema, { description: 'Returns HTTP 200 with status ok or degraded. Inspect the response status and dependency values; HTTP 200 alone does not mean all dependencies are healthy.' }),
    getOperations: op('Inspect operational health and queue counts', c.systemOperationsResponseSchema, { permission: 'Global ADMIN' }),
    retryFailedJob: op('Retry a failed queue job', c.retryFailedJobResponseSchema, { permission: 'Global ADMIN', description: 'Only jobs currently in the failed state are eligible; missing or no longer failed jobs return 404. The operator action is audited.' }),
  } },
};
