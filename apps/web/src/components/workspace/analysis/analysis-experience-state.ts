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
  | "continue_review"
  | "finalize"
  | "view_report"
  | "rerun"

export interface AnalysisExperienceState {
  primaryAction: AnalysisPrimaryAction
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

  const isStale = workspace.driftStatus.isStale
  const report = workspace.reportStatus
  const canFinalize = report.canFinalize
  const reportReady = report.canViewReport
  const blockingReasons = report.finalizeBlockingReasons

  const primaryAction = resolvePrimaryAction({
    isStale,
    pending,
    canFinalize,
    reportReady,
  })

  return {
    primaryAction,
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
  isStale: boolean
  pending: number
  canFinalize: boolean
  reportReady: boolean
}): AnalysisPrimaryAction {
  // A stale snapshot is surfaced first: the analysis no longer reflects the
  // repository, so re-running takes priority over reviewing outdated impacts.
  if (params.isStale) return "rerun"
  if (params.pending > 0) return "continue_review"
  if (params.canFinalize) return "finalize"
  if (params.reportReady) return "view_report"
  return "continue_review"
}

function recommendedMode(action: AnalysisPrimaryAction): AnalysisWorkspaceMode {
  switch (action) {
    case "continue_review":
    case "finalize":
      return "review"
    case "view_report":
      return "summary"
    case "rerun":
      return "history"
  }
}
