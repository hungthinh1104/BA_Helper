export const MULTI_REPO_CHILD_BLOCKING_REASON_LABEL: Record<string, string> = {
  FAILED: "Failed",
  NOT_COMPLETED: "Not completed",
  WAITING_FOR_REVIEW: "Waiting for review",
  NEEDS_MORE_CLARIFICATION: "Needs clarification",
  REJECTED: "Rejected",
  STALE: "Stale",
  NONE: "Ready",
}

export const MULTI_REPO_MERGED_REPORT_BLOCKER_LABEL: Record<string, string> = {
  CHILD_ANALYSIS_FAILED: "A child analysis failed",
  CHILD_ANALYSIS_NOT_COMPLETED: "A child analysis is not completed",
  CHILD_ANALYSIS_WAITING_FOR_REVIEW: "A child analysis is waiting for review",
  CHILD_ANALYSIS_STALE: "A child analysis is stale",
  CHILD_REVIEW_NEEDS_CLARIFICATION: "A child review needs clarification",
  CHILD_REVIEW_REJECTED: "A child review was rejected",
  CHILD_REVIEW_PENDING: "A child review is pending",
  MERGED_REPORT_CURRENT: "Approved merged report is current",
}

export function formatMultiRepoMergedReportBlockers(reasons: string[]): string {
  return reasons
    .map((reason) => MULTI_REPO_MERGED_REPORT_BLOCKER_LABEL[reason] ?? reason)
    .join("; ")
}
