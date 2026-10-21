import * as c from '@ba-helper/contracts';
import { operation as op, type ControllerDocs } from './operation-doc';

const staticTrace = 'This is a persisted static source-reference projection, not test execution, pass/fail, assertion coverage or runtime coverage. Paths may include mocks. NO_TEST_FOUND is bounded by the returned traceContext limits; it does not prove the absence of tests.';

export const analysisDocs: Record<string, ControllerDocs> = {
  ImpactAnalysisLifecycleController: { tag: 'Impact analyses', operations: {
    create: op('Start an analysis for an immutable requirement revision', c.impactAnalysisResponseSchema, {
      body: c.impactAnalysisCreateRequestSchema, permission: 'analysis:create',
      errors: { 400: 'Requirement, snapshot or project/target preconditions are not satisfied.', 409: 'Request key conflicts or analysis source is stale.' },
      description: 'Requires an analysis-ready revision and a snapshot belonging to the selected source target. PARTIAL snapshots require explicit acknowledgement. Reuse requestKey for the same submitted command. Poll status and backend capabilities; progress 100 alone does not authorize review or finalization. This base endpoint does not apply the optional derivedFromAnalysisId/sourceClarificationId fields; use the review-clarification derived-analyses endpoint for that workflow.',
    }),
    get: op('Read analysis state, freshness and capabilities', c.impactAnalysisResponseSchema),
    getEvents: op('Read analysis audit events', c.eventLogListResponseSchema),
    list: op('List project analyses', c.impactAnalysisListResponseSchema, { query: c.paginationQuerySchema }),
    finalize: op('Finalize an analysis explicitly', c.impactAnalysisResponseSchema, { body: c.finalizeImpactAnalysisRequestSchema, permission: 'analysis:finalize', description: 'Human action subject to review and freshness gates. Atomically persists the completed state, reviewed report snapshot and document job, then attempts queue submission. Poll final-reviewed-report for report readiness; do not create a second snapshot as a required follow-up. A completed historical analysis may later become stale. Lifecycle status and freshness remain independent.', errors: { 400: 'Review, acknowledgement or completion requirements are not satisfied.', 409: 'Analysis is stale or its lifecycle transition is invalid.' } }),
  } },
  ImpactAnalysisReadModelController: { tag: 'Analysis views & static test traces', operations: {
    getMatrixRowDetailEndpoint: op('Read evidence behind a multi-repository matrix row', c.matrixRowDetailResponseSchema),
    getLineageTimeline: op('Read analysis lineage', c.lineageTimelineResponseSchema),
    graph: op('Read the bounded impact display graph', c.impactGraphResponseSchema, { description: 'Display graph limits are independent of the static QA projection. Persisted edge confidence and provenance describe source relationships, not execution results.' }),
    workspace: op('Read the analysis workspace', c.analysisWorkspaceResponseSchema, { description: 'Backend-derived presentation model for evidence, review, risks, unknowns, reports and drift. Consumers must use returned state and capabilities.' }),
    qaCoverage: op('Inspect static code-to-test references', c.qaCoverageResponseSchema, { description: staticTrace }),
    reviewQueue: op('Read the review queue', c.reviewQueueResponseSchema),
    diff: op('Compare this analysis with its baseline', c.impactAnalysisDiffResponseSchema),
    driftFreshness: op('Read observed source freshness and rerun recommendations', c.driftFreshnessRecommendationSchema, { description: 'Freshness is based on the latest persisted source-target observation, not a live promise about remote HEAD.' }),
  } },
  TestTraceEvidenceController: { tag: 'Analysis views & static test traces', operations: {
    get: op('Read source evidence for a static test-trace step', c.testTraceEvidenceResponseSchema, { description: 'Returns redacted persisted source evidence from the analysis snapshot. Evidence must belong to an eligible trace step; unrelated or unavailable evidence returns 404. ' + staticTrace }),
  } },
  MultiRepoAnalysisController: { tag: 'Multi-repository runs', operations: {
    createMultiRepo: op('Start analyses across selected project repositories', c.multiRepoImpactAnalysisCreateResponseSchema, { body: c.multiRepoImpactAnalysisCreateRequestSchema, permission: 'analysis:create' }),
    getMultiRepoRunDetail: op('Read a multi-repository run', c.multiRepoAnalysisRunDetailResponseSchema),
    getMultiRepoRunImpactMatrix: op('Read the multi-repository impact matrix', c.multiRepoImpactMatrixResponseSchema),
    getMergedMultiRepoReportDraftEndpoint: op('Read the merged report draft', c.multiRepoMergedReportDraftResponseSchema),
    finalizeMergedMultiRepoReportEndpoint: op('Finalize the merged report', c.multiRepoApprovedReportResponseSchema, { permission: 'analysis:finalize' }),
    getApprovedMultiRepoReportEndpoint: op('Read the approved merged report', c.multiRepoApprovedReportResponseSchema),
    createMergedMultiRepoReportReviewDecisionEndpoint: op('Record a merged report review decision', c.mergedMultiRepoReportReviewDecisionCreateResponseSchema, { body: c.reviewDecisionRequestSchema, permission: 'review:write' }),
    listMergedMultiRepoReportReviewDecisionsEndpoint: op('List merged report review decisions', c.mergedMultiRepoReportReviewDecisionListResponseSchema),
    getLatestMergedMultiRepoReportReviewDecisionEndpoint: op('Read the latest merged report review decision', c.mergedMultiRepoReportReviewDecisionResponseSchema),
    exportApprovedMultiRepoReportMarkdownEndpoint: op('Download the approved merged report as Markdown', 'markdown', { permission: 'report:export' }),
    exportApprovedMultiRepoReportPdfEndpoint: op('Download the approved merged report as PDF', 'pdf', { permission: 'report:export' }),
    listMultiRepoRunsByProject: op('List project multi-repository runs', c.multiRepoAnalysisRunListResponseSchema),
  } },
};
