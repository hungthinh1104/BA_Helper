import { describe, expect, it } from "@jest/globals"
import type { AnalysisWorkspaceResponse } from "@ba-helper/contracts"
import {
  createAnalysisWorkbenchViewModel,
  filterReviewItems,
  getDefaultAnalysisWorkspaceMode,
  resolveReviewItemDetail,
} from "./analysis-workbench-view-model"

const workspace = (overrides: Partial<AnalysisWorkspaceResponse> = {}): AnalysisWorkspaceResponse => ({
  overview: {
    analysisId: "11111111-1111-4111-8111-111111111111",
    requirement: { revisionId: "22222222-2222-4222-8222-222222222222", title: "Cancel booking", summary: "Refund paid booking", language: "en", domainProfileId: "booking", domainPack: null },
    snapshot: { snapshotId: "33333333-3333-4333-8333-333333333333", repositoryId: "44444444-4444-4444-8444-444444444444", commitSha: "abcdef", analyzerVersion: "v1" },
    status: { analysisStatus: "WAITING_FOR_REVIEW", reviewStatus: "in_progress", snapshotStatus: "locked", reportStatus: "missing", driftStatus: "fresh" },
    counts: { impactedArtifacts: 1, evidenceItems: 1, risks: 0, unknowns: 0, qaScenarios: 0, pendingReviewItems: 2 },
  },
  impactGroups: [{ group: "primary", title: "Impacts", description: "", artifacts: [{ artifactId: "55555555-5555-4555-8555-555555555555", artifactKey: "BookingService.cancel", name: "cancel", filePath: "src/booking.ts", universalKind: "DOMAIN_SERVICE", impactBasis: "conflicting", impactReason: "", traceabilityLinkIds: [], evidenceIds: [], reviewDecision: "needs_review" }] }],
  evidenceCards: [], risks: [], unknowns: [], qaScenarios: [],
  reviewQueue: [
    { itemId: "reviewed", itemType: "risk", title: "Reviewed", currentDecision: "accepted", evidenceCount: 1, linkedArtifactKeys: [], linkedEvidenceIds: [], blockingFinalize: false, impactBasis: null, isConflicting: false, allowedActions: ["accept", "reject"], reviewNote: null, reviewedAt: null, reviewedByUserId: null },
    { itemId: "pending", itemType: "unknown", title: "Pending", currentDecision: "needs_review", evidenceCount: 1, linkedArtifactKeys: [], linkedEvidenceIds: [], blockingFinalize: false, impactBasis: null, isConflicting: false, allowedActions: ["accept", "reject"], reviewNote: null, reviewedAt: null, reviewedByUserId: null },
    { itemId: "empty", itemType: "impact", title: "Empty", currentDecision: "needs_review", evidenceCount: 0, linkedArtifactKeys: [], linkedEvidenceIds: [], blockingFinalize: false, impactBasis: null, isConflicting: false, allowedActions: ["accept", "reject", "needs_more_evidence", "undo"], reviewNote: null, reviewedAt: null, reviewedByUserId: null },
    { itemId: "more", itemType: "impact", title: "More", currentDecision: "needs_more_evidence", evidenceCount: 1, linkedArtifactKeys: [], linkedEvidenceIds: [], blockingFinalize: false, impactBasis: null, isConflicting: false, allowedActions: ["accept", "reject", "needs_more_evidence", "undo"], reviewNote: null, reviewedAt: null, reviewedByUserId: null },
    { itemId: "conflict", itemType: "impact", title: "Conflict", currentDecision: "needs_review", evidenceCount: 1, linkedArtifactKeys: ["BookingService.cancel"], linkedEvidenceIds: [], blockingFinalize: false, impactBasis: "conflicting", isConflicting: true, allowedActions: ["accept", "reject", "needs_more_evidence", "undo"], reviewNote: null, reviewedAt: null, reviewedByUserId: null },
    { itemId: "blocker", itemType: "impact", title: "Blocker", currentDecision: "needs_review", evidenceCount: 1, linkedArtifactKeys: [], linkedEvidenceIds: [], blockingFinalize: true, impactBasis: null, isConflicting: false, allowedActions: ["accept", "reject", "needs_more_evidence", "undo"], reviewNote: null, reviewedAt: null, reviewedByUserId: null },
  ],
  reviewSummary: { total: 6, pending: 4, blocking: 1, conflicting: 1, needsMoreEvidence: 1, reviewed: 1, accepted: 1, rejected: 0 },
  reportStatus: { status: "missing", generatedDocumentId: null, documentJobId: null, reviewedReportSnapshotId: null, canFinalize: false, requiresUnreviewedAcknowledgement: false, canViewReport: false, canExport: false, canRetryReportGeneration: false, finalizeBlockingReasons: [], exportBlockingReasons: [], lastGeneratedAt: null, failureMessage: null },
  driftStatus: { status: "fresh", isStale: false, basis: "pinned_commit", sourceTargetId: null, latestObservedCommitSha: null, snapshotCommitSha: "abcdef", reason: null },
  ...overrides,
})

describe("analysis workbench view model", () => {
  it("uses backend drift and pending counts for the default mode", () => {
    expect(getDefaultAnalysisWorkspaceMode(workspace())).toBe("review")
    expect(getDefaultAnalysisWorkspaceMode(workspace({ driftStatus: { ...workspace().driftStatus, isStale: true } }))).toBe("history")
    expect(getDefaultAnalysisWorkspaceMode(workspace({ overview: { ...workspace().overview, counts: { ...workspace().overview.counts, pendingReviewItems: 0 } } }))).toBe("summary")
  })

  it("orders the review queue deterministically and keeps backend order within a group", () => {
    const viewModel = createAnalysisWorkbenchViewModel(workspace())
    expect(viewModel.orderedReviewItems.map((item) => item.itemId)).toEqual(["blocker", "conflict", "more", "empty", "pending", "reviewed"])
    expect(viewModel.counts).toEqual({ total: 6, pending: 4, blocking: 1, conflicting: 1, needsMoreEvidence: 1, reviewed: 1 })
  })

  it("filters from the ordered items and safely falls back from an invalid URL item", () => {
    const viewModel = createAnalysisWorkbenchViewModel(workspace(), "missing")
    expect(viewModel.selectedItemId).toBe("blocker")
    expect(filterReviewItems(viewModel.orderedReviewItems, "blocking").map((item) => item.itemId)).toEqual(["blocker"])
    expect(filterReviewItems(viewModel.orderedReviewItems, "conflicting").map((item) => item.itemId)).toEqual(["conflict"])
  })

  it("builds detail indexes once for traceability and evidence lookups", () => {
    const viewModel = createAnalysisWorkbenchViewModel(workspace())
    expect(viewModel.indexes.artifactByKey.get("BookingService.cancel")?.name).toBe("cancel")
    expect(viewModel.indexes.evidenceById.size).toBe(0)
  })

  it("maps an evidence queue item through the persisted evidence index", () => {
    const evidenceId = "66666666-6666-4666-8666-666666666666"
    const input = workspace({
      evidenceCards: [{ evidenceId, sourceType: "code", filePath: "src/booking.ts", lineRange: { startLine: 21, endLine: 24 }, excerpt: "refund()", relevanceReason: "Cancellation calls refund.", artifactId: null, artifactKey: "BookingService.cancel", linkedInsightIds: [], linkedTraceabilityLinkIds: [] }],
      reviewQueue: [{ itemId: evidenceId, itemType: "evidence", title: "Refund call", currentDecision: "needs_review", evidenceCount: 1, linkedArtifactKeys: [], linkedEvidenceIds: [], blockingFinalize: false, impactBasis: null, isConflicting: false, allowedActions: ["accept", "reject"], reviewNote: null, reviewedAt: null, reviewedByUserId: null }],
    })
    const viewModel = createAnalysisWorkbenchViewModel(input, evidenceId)
    const detail = resolveReviewItemDetail(input, viewModel, viewModel.orderedReviewItems[0]!)
    expect(detail.evidence.map((evidence) => evidence.evidenceId)).toEqual([evidenceId])
    expect(detail.evidence[0]?.lineRange).toEqual({ startLine: 21, endLine: 24 })
  })
})
