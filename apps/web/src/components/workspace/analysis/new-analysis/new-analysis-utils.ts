import { ApiError } from "@/lib/api-error"
import type { RepositoryListItemResponse } from "@ba-helper/contracts"

export function getScannerMaturity(repo: RepositoryListItemResponse) {
  const profile = repo.latestSnapshot?.profile
  if (!profile) return "—"
  if (profile.language === "TYPESCRIPT" && profile.framework === "NESTJS") return "STABLE"
  if (profile.language === "JAVA" && profile.framework === "SPRING_BOOT") return "PARTIAL"
  if (profile.framework !== "UNKNOWN") return "EXPERIMENTAL"
  return "UNKNOWN"
}

export function getScannerProfileLabel(repo: RepositoryListItemResponse) {
  const profile = repo.latestSnapshot?.profile
  if (!profile) return "—"
  return `${profile.language} / ${profile.framework}`
}

export function repositoryNeedsPartialAcknowledgement(repo: RepositoryListItemResponse) {
  const maturity = getScannerMaturity(repo)
  return (
    repo.latestSnapshot?.coverageStatus === "PARTIAL" ||
    maturity === "PARTIAL" ||
    maturity === "EXPERIMENTAL"
  )
}

export function getAnalysisErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    switch (error.code) {
      case "REPOSITORY_NOT_ANALYZABLE":
        return "One selected repository does not have a usable observed target or published snapshot. The batch stops on the first invalid repository in this phase."
      case "REPOSITORY_NOT_FOUND":
      case "INPUT_PROJECT_MISMATCH":
        return "One selected repository is not available in the current project. The batch stops on the first invalid repository in this phase."
      case "SNAPSHOT_PARTIAL_NOT_ALLOWED":
        return "At least one selected repository has partial coverage and requires acknowledgement before analysis can start."
      default:
        return error.message || "Please try again."
    }
  }

  if (error instanceof Error) {
    return error.message
  }

  return "Please try again."
}
