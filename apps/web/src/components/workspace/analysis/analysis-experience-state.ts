import type { AnalysisWorkspaceResponse } from "@ba-helper/contracts"
import type { AnalysisWorkspaceMode, ReviewFilter } from "./workbench/analysis-workbench-types"

/**
 * The single source of truth for "what should the user do next" in an analysis.
 *
 * It resolves the primary call-to-action, the headline counts (blockers /
 * pending / evidence gaps), and the review surface (mode + filter) to land on,
 * purely from the workspace payload. The header CTA, navigation defaults, and
 * dashboard deep-links all derive from this so the decision → finalize → report
 * journey never forks into a legacy flow.
 */
export type AnalysisPrimaryAction =
  | "processing"
  | "failed"
  | "continue_review"
  | "finalize"
  | "report_generating"
  | "view_report"
  | "rerun"

export interface AnalysisExperienceState {
  primaryAction: AnalysisPrimaryAction
  /**
   * True only while the analysis is in a state where review decisions are
   * meaningful (waiting for review, or completed). Processing and failed
   * analyses are not reviewable, so the shell must not offer decision actions.
   */
  isReviewable: boolean
  /** Unreviewed items that block finalization. */
  blockers: number
  /** Items still awaiting a decision (needs_review). needs_more_evidence is NOT counted as reviewed. */
  pending: number
  /** Items with an explicit evidence gap (needs_more_evidence, or unreviewed with no evidence). */
  evidenceGaps: number
  isStale: boolean
  canFinalize: boolean
  reportReady: boolean
  blockingReasons: string[]
  /** Mode the primary CTA should land on. */
  recommendedMode: AnalysisWorkspaceMode
  /** Review filter the primary CTA should apply. */
  recommendedFilter: ReviewFilter
}

const PENDING = "needs_review"
const NEEDS_MORE_EVIDENCE = "needs_more_evidence"

export function resolveAnalysisExperienceState(
  workspace: AnalysisWorkspaceResponse,
): AnalysisExperienceState {
  const queue = workspace.reviewQueue
  const pending = queue.filter((item) => item.currentDecision === PENDING).length
  const blockers = queue.filter(
    (item) => item.blockingFinalize && item.currentDecision === PENDING,
  ).length
  const evidenceGaps = queue.filter(
    (item) =>
      item.currentDecision === NEEDS_MORE_EVIDENCE ||
      (item.currentDecision === PENDING && item.evidenceCount === 0),
  ).length

  const analysisStatus = workspace.overview.status.analysisStatus
  const isStale = workspace.driftStatus.isStale
  const report = workspace.reportStatus
  const canFinalize = report.canFinalize
  const reportReady = report.canViewReport
  const blockingReasons = report.finalizeBlockingReasons

  const primaryAction = resolvePrimaryAction({
    analysisStatus,
    reportStatus: report.status,
    isStale,
    pending,
    canFinalize,
    reportReady,
  })

  return {
    primaryAction,
    isReviewable:
      analysisStatus === "WAITING_FOR_REVIEW" || analysisStatus === "COMPLETED",
    blockers,
    pending,
    evidenceGaps,
    isStale,
    canFinalize,
    reportReady,
    blockingReasons,
    recommendedMode: recommendedMode(primaryAction),
    recommendedFilter: blockers > 0 ? "blocking" : "pending",
  }
}

function resolvePrimaryAction(params: {
  analysisStatus: AnalysisWorkspaceResponse["overview"]["status"]["analysisStatus"]
  reportStatus: AnalysisWorkspaceResponse["reportStatus"]["status"]
  isStale: boolean
  pending: number
  canFinalize: boolean
  reportReady: boolean
}): AnalysisPrimaryAction {
  // Lifecycle first: an analysis that is still running or has failed cannot be
  // reviewed, so we never fall through to a review/finalize CTA for it.
  if (params.analysisStatus === "QUEUED" || params.analysisStatus === "RUNNING") {
    return "processing"
  }
  if (params.analysisStatus === "FAILED" || params.analysisStatus === "CANCELLED") {
    return "failed"
  }
  // A stale snapshot is surfaced next: the analysis no longer reflects the
  // repository, so re-running takes priority over reviewing outdated impacts.
  if (params.isStale) return "rerun"
  if (params.reportStatus === "queued" || params.reportStatus === "running") {
    return "report_generating"
  }
  if (params.pending > 0) return "continue_review"
  if (params.canFinalize) return "finalize"
  if (params.reportReady) return "view_report"
  // A completed analysis with no pending work lands on its report surface even
  // if generation has not produced a viewable document yet (the report tab
  // exposes retry).
  if (params.analysisStatus === "COMPLETED") return "view_report"
  return "continue_review"
}

function recommendedMode(action: AnalysisPrimaryAction): AnalysisWorkspaceMode {
  switch (action) {
    case "continue_review":
    case "finalize":
      return "review"
    case "view_report":
    case "report_generating":
    case "processing":
    case "failed":
      return "summary"
    case "rerun":
      return "history"
  }
}
