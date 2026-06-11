export const queryKeys = {
  repositories: {
    all: ["repositories"] as const,
    list: (projectId: string) => ["repositories", "list", projectId] as const,
    detail: (repositoryId: string) => ["repositories", "detail", repositoryId] as const,
  },
  requirements: {
    all: ["requirements"] as const,
    list: (projectId: string) => ["requirements", "list", projectId] as const,
    detail: (requirementId: string) => ["requirements", "detail", requirementId] as const,
  },
  analyses: {
    all: ["impact-analyses"] as const,
    list: (projectId: string) => ["impact-analyses", "list", projectId] as const,
    detail: (analysisId: string) => ["impact-analyses", "detail", analysisId] as const,
    report: (analysisId: string) => ["impact-analyses", "approved-report", analysisId] as const,
  },
}
