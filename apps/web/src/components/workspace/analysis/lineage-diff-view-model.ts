import type {
  ImpactAnalysisDiffResponse,
  LineageTimelineResponse,
} from "@ba-helper/contracts"

export type LineageDiffStatus = "available" | "not_available" | "not_applicable"

type ApiLikeError = {
  code?: string
  status?: number
  message?: string
}

export function isNoBaselineDiffError(error: unknown) {
  const apiError = error as ApiLikeError | null
  return apiError?.code === "NO_BASELINE_ANALYSIS"
}

export function getLineageParentAnalysisId(
  diff: ImpactAnalysisDiffResponse | undefined,
  lineage: LineageTimelineResponse | undefined,
) {
  if (diff?.baseAnalysisId) return diff.baseAnalysisId
  if (!lineage) return null

  const parentEvent = [...lineage.events]
    .reverse()
    .find((event) =>
      event.analysisId === lineage.currentAnalysisId &&
      event.relatedAnalysisId &&
      event.type === "DERIVED_ANALYSIS_CREATED"
    )

  return parentEvent?.relatedAnalysisId ?? null
}

export function getLineageDiffStatus(params: {
  diff?: ImpactAnalysisDiffResponse
  diffError?: unknown
}): LineageDiffStatus {
  if (params.diff) return "available"
  if (isNoBaselineDiffError(params.diffError)) return "not_applicable"
  return "not_available"
}

export function buildLineageDiffSummary(params: {
  currentAnalysisId: string
  diff?: ImpactAnalysisDiffResponse
  lineage?: LineageTimelineResponse
  diffError?: unknown
}) {
  const parentAnalysisId = getLineageParentAnalysisId(params.diff, params.lineage)
  const status = getLineageDiffStatus({
    diff: params.diff,
    diffError: params.diffError,
  })

  return {
    currentAnalysisId: params.currentAnalysisId,
    parentAnalysisId,
    diffStatus: status,
    sourceClarificationId: params.diff?.comparisonContext.sourceClarificationId ?? null,
    sourceReviewClarificationRequestId:
      params.diff?.comparisonContext.reviewClarificationRequestId ?? null,
    previousSnapshot: params.diff
      ? {
          snapshotId: params.diff.comparisonContext.baseSnapshotId,
          commitSha: params.diff.comparisonContext.baseCommitSha ?? null,
        }
      : null,
    currentSnapshot: params.diff
      ? {
          snapshotId: params.diff.comparisonContext.currentSnapshotId,
          commitSha: params.diff.comparisonContext.currentCommitSha ?? null,
        }
      : null,
  }
}

export function hasMaterialDiff(diff: ImpactAnalysisDiffResponse | undefined) {
  if (!diff) return false
  return (
    diff.addedArtifacts.length +
      diff.removedArtifacts.length +
      diff.resolvedUnknowns.length +
      diff.removedUnknowns.length +
      diff.newUnknowns.length +
      diff.addedQaScenarios.length >
    0
  )
}

export function evidenceDiffUnavailableMessage() {
  return "Evidence-level diff is not available for this analysis pair."
}
