import type {
  ImpactAnalysisDiffResponse,
  LineageTimelineResponse,
} from "@ba-helper/contracts"
import {
  buildLineageDiffSummary,
  evidenceDiffUnavailableMessage,
  getLineageDiffStatus,
  hasMaterialDiff,
  isNoBaselineDiffError,
} from "./lineage-diff-view-model"

const makeDiff = (): ImpactAnalysisDiffResponse => ({
  baseAnalysisId: "00000000-0000-4000-8000-000000000001",
  currentAnalysisId: "00000000-0000-4000-8000-000000000002",
  comparisonContext: {
    requirementChanged: true,
    snapshotChanged: true,
    baseRequirementRevisionId: "00000000-0000-4000-8000-000000000003",
    currentRequirementRevisionId: "00000000-0000-4000-8000-000000000004",
    baseSnapshotId: "00000000-0000-4000-8000-000000000005",
    currentSnapshotId: "00000000-0000-4000-8000-000000000006",
    baseCommitSha: "base-commit",
    currentCommitSha: "current-commit",
    sourceClarificationId: "00000000-0000-4000-8000-000000000007",
    reviewClarificationRequestId: "00000000-0000-4000-8000-000000000008",
  },
  summary: {
    addedImpacts: 1,
    removedImpacts: 1,
    unchangedImpacts: 1,
    resolvedUnknowns: 1,
    removedUnknowns: 0,
    newUnknowns: 1,
    addedQaScenarios: 1,
  },
  addedArtifacts: [
    {
      artifactKey: "service:new",
      name: "NewService.run",
      artifactType: "SERVICE_METHOD",
      universalKind: "DOMAIN_SERVICE",
      filePath: "src/new.service.ts",
      reviewStatus: "NEEDS_REVIEW",
    },
  ],
  removedArtifacts: [
    {
      artifactKey: "service:old",
      name: "OldService.run",
      artifactType: "SERVICE_METHOD",
      universalKind: "DOMAIN_SERVICE",
      filePath: "src/old.service.ts",
      reviewStatus: "CONFIRMED",
    },
  ],
  unchangedArtifacts: [
    {
      artifactKey: "service:same",
      name: "SameService.run",
      artifactType: "SERVICE_METHOD",
      universalKind: "DOMAIN_SERVICE",
      filePath: "src/same.service.ts",
      reviewStatus: "CONFIRMED",
    },
  ],
  resolvedUnknowns: [
    {
      insightKey: "unknown:old",
      category: "UNKNOWN",
      statement: "Refund deadline was unclear.",
      reviewStatus: "CONFIRMED",
    },
  ],
  removedUnknowns: [],
  newUnknowns: [
    {
      insightKey: "unknown:new",
      category: "UNKNOWN",
      statement: "Inventory release timing is unclear.",
      reviewStatus: "NEEDS_REVIEW",
    },
  ],
  addedQaScenarios: [
    {
      insightKey: "qa:new",
      category: "QA_SCENARIO",
      statement: "Given paid booking, when cancelled, then refund is created once.",
      reviewStatus: "NEEDS_REVIEW",
    },
  ],
})

describe("lineage diff view model", () => {
  it("maps analysis with no parent to not applicable state", () => {
    const error = { code: "NO_BASELINE_ANALYSIS", message: "No baseline" }

    expect(isNoBaselineDiffError(error)).toBe(true)
    expect(getLineageDiffStatus({ diffError: error })).toBe("not_applicable")
    expect(buildLineageDiffSummary({
      currentAnalysisId: "00000000-0000-4000-8000-000000000002",
      diffError: error,
    })).toMatchObject({
      parentAnalysisId: null,
      diffStatus: "not_applicable",
      previousSnapshot: null,
    })
  })

  it("builds lineage summary from diff and lineage data", () => {
    const diff = makeDiff()
    const lineage: LineageTimelineResponse = {
      rootAnalysisId: diff.baseAnalysisId,
      currentAnalysisId: diff.currentAnalysisId,
      depth: 1,
      events: [],
    }

    expect(buildLineageDiffSummary({
      currentAnalysisId: diff.currentAnalysisId,
      diff,
      lineage,
    })).toEqual({
      currentAnalysisId: diff.currentAnalysisId,
      parentAnalysisId: diff.baseAnalysisId,
      diffStatus: "available",
      sourceClarificationId: diff.comparisonContext.sourceClarificationId,
      sourceReviewClarificationRequestId: diff.comparisonContext.reviewClarificationRequestId,
      previousSnapshot: {
        snapshotId: diff.comparisonContext.baseSnapshotId,
        commitSha: "base-commit",
      },
      currentSnapshot: {
        snapshotId: diff.comparisonContext.currentSnapshotId,
        commitSha: "current-commit",
      },
    })
  })

  it("reports material artifact unknown and QA diff without evidence inference", () => {
    const diff = makeDiff()

    expect(hasMaterialDiff(diff)).toBe(true)
    expect(diff.addedArtifacts).toHaveLength(1)
    expect(diff.removedArtifacts).toHaveLength(1)
    expect(diff.resolvedUnknowns).toHaveLength(1)
    expect(diff.newUnknowns).toHaveLength(1)
    expect(diff.addedQaScenarios).toHaveLength(1)
    expect(evidenceDiffUnavailableMessage()).toBe(
      "Evidence-level diff is not available for this analysis pair.",
    )
  })
})
