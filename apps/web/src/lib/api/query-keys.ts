export const queryKeys = {
  system: {
    health: ["system", "health"] as const,
  },
  repositories: {
    all: ["repositories"] as const,
    list: (projectId: string, params?: { limit?: number; offset?: number }) => ["repositories", "list", projectId, params] as const,
    detail: (repositoryId: string) => ["repositories", "detail", repositoryId] as const,
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
    report: (analysisId: string) => ["impact-analyses", "approved-report", analysisId] as const,
    graph: (analysisId: string) => ["impact-analyses", "graph", analysisId] as const,
    qaCoverage: (analysisId: string) => ["impact-analyses", "qa-coverage", analysisId] as const,
    reviewQueue: (analysisId: string) => ["impact-analyses", "review-queue", analysisId] as const,
    diff: (analysisId: string) => ["impact-analyses", "diff", analysisId] as const,
  },
}
