import { ApiError } from "@/lib/api-error"

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
