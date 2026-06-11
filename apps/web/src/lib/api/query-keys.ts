export const queryKeys = {
  workspace: {
    current: ["workspace", "current"] as const,
    projects: ["workspace", "projects"] as const,
    members: (projectId: string) => ["workspace", "project-members", projectId] as const,
  },
  system: {
    health: ["system", "health"] as const,
  },
  repositories: {
    all: ["repositories"] as const,
    list: (projectId: string, params?: { limit?: number; offset?: number }) => ["repositories", "list", projectId, params] as const,
    detail: (repositoryId: string) => ["repositories", "detail", repositoryId] as const,
    snapshots: (repositoryId: string, params?: { limit?: number }) => ["repositories", "snapshots", repositoryId, params] as const,
    snapshotDrift: (repositoryId: string, baseSnapshotId: string, targetSnapshotId?: string) => ["repositories", "snapshot-drift", repositoryId, baseSnapshotId, targetSnapshotId] as const,
  },
  requirements: {
    all: ["requirements"] as const,
    list: (projectId: string) => ["requirements", "list", projectId] as const,
    detail: (requirementId: string) => ["requirements", "detail", requirementId] as const,
  },
  analyses: {
    all: ["impact-analyses"] as const,
    list: (projectId: string, params?: { limit?: number; offset?: number }) => ["impact-analyses", "list", projectId, params] as const,
    detail: (analysisId: string) => ["impact-analyses", "detail", analysisId] as const,
    runs: {
      list: (projectId: string) => ["impact-analyses", "runs", "list", projectId] as const,
      detail: (runId: string) => ["impact-analyses", "runs", "detail", runId] as const,
      mergedReport: (runId: string) => ["impact-analyses", "runs", "merged-report", runId] as const,
      approvedReport: (runId: string) => ["impact-analyses", "runs", "approved-report", runId] as const,
      reviewDecisions: (runId: string) => ["impact-analyses", "runs", "review-decisions", runId] as const,
      latestReviewDecision: (runId: string) => ["impact-analyses", "runs", "latest-review-decision", runId] as const,
      reviewCoverage: (runId: string) => ["impact-analyses", "runs", "review-coverage", runId] as const,
    },
    report: (analysisId: string) => ["impact-analyses", "approved-report", analysisId] as const,
    graph: (analysisId: string) => ["impact-analyses", "graph", analysisId] as const,
    qaCoverage: (analysisId: string) => ["impact-analyses", "qa-coverage", analysisId] as const,
    reviewQueue: (analysisId: string) => ["impact-analyses", "review-queue", analysisId] as const,
    diff: (analysisId: string) => ["impact-analyses", "diff", analysisId] as const,
    driftFreshness: (analysisId: string) => ["impact-analyses", "drift-freshness", analysisId] as const,
  },
}
