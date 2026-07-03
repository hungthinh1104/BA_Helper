import { useEffect, useRef } from "react"
import { toast } from "sonner"
import { useQueryClient } from "@tanstack/react-query"
import { useTranslations } from "next-intl"
import { queryKeys } from "@/lib/api/query-keys"
import { useRepositoryDetail } from "../api/use-repositories"
import { useAnalysisDetail } from "../api/use-analyses"
import { isScanJobActive, isScanJobTerminal, isAnalysisActive, isAnalysisTerminal } from "@/lib/status-helpers"

export function useRepositoryStatusWatcher(projectId: string | undefined, repositoryId: string) {
  const t = useTranslations("statusWatcher")
  const { data } = useRepositoryDetail(projectId, repositoryId)
  const queryClient = useQueryClient()
  
  const prevStatusRef = useRef<string | undefined>(undefined)

  useEffect(() => {
    if (!data?.latestScanJob) return

    const currentStatus = data.latestScanJob.status
    const prevStatus = prevStatusRef.current

    if (
      prevStatus &&
      isScanJobActive(prevStatus) &&
      isScanJobTerminal(currentStatus)
    ) {
      const toastId = `repo-scan:${data.id}:${currentStatus}`
      
      if (currentStatus === "COMPLETED") {
        toast.success(t("repositoryScanCompleted"), { id: toastId })
      } else if (currentStatus === "FAILED") {
        toast.error(t("scanFailed", { code: data.latestScanJob.error?.code || "UNKNOWN" }), {
          description: data.latestScanJob.error?.message,
          id: toastId,
        })
      }

      // Invalidate related lists
      queryClient.invalidateQueries({ queryKey: queryKeys.repositories.list(projectId ?? "__workspace-pending__") })
      queryClient.invalidateQueries({ queryKey: queryKeys.repositories.detail(repositoryId) })
      // Might also want to invalidate analyses prerequisites
      queryClient.invalidateQueries({ queryKey: queryKeys.analyses.all })
    }

    prevStatusRef.current = currentStatus
  }, [data, projectId, repositoryId, queryClient, t])
}

export function useAnalysisStatusWatcher(projectId: string | undefined, analysisId: string) {
  const t = useTranslations("statusWatcher")
  const { data } = useAnalysisDetail(analysisId)
  const queryClient = useQueryClient()
  
  const prevStatusRef = useRef<string | undefined>(undefined)

  useEffect(() => {
    if (!data) return

    const currentStatus = data.status
    const prevStatus = prevStatusRef.current

    if (
      prevStatus &&
      isAnalysisActive(prevStatus) &&
      isAnalysisTerminal(currentStatus)
    ) {
      const toastId = `analysis:${data.id}:${currentStatus}`
      
      if (currentStatus === "WAITING_FOR_REVIEW") {
        toast.success(t("analysisReadyForReview"), { id: toastId })
        // Invalidate review related queries
        queryClient.invalidateQueries({ queryKey: queryKeys.analyses.insights(analysisId) })
        queryClient.invalidateQueries({ queryKey: queryKeys.analyses.traceability(analysisId) })
      } else if (currentStatus === "COMPLETED") {
        toast.success(t("analysisFinalized"), { id: toastId })
        queryClient.invalidateQueries({ queryKey: queryKeys.analyses.report(analysisId) })
      } else if (currentStatus === "FAILED") {
        toast.error(t("analysisFailed", { code: data.error?.code || "UNKNOWN" }), {
          description: data.error?.message || t("somethingWentWrong"),
          id: toastId,
        })
      }

      // Always invalidate the lists and detail
      queryClient.invalidateQueries({ queryKey: queryKeys.analyses.list(projectId ?? "__workspace-pending__") })
      queryClient.invalidateQueries({ queryKey: queryKeys.analyses.detail(analysisId) })
    }

    prevStatusRef.current = currentStatus
  }, [data, projectId, analysisId, queryClient, t])
}
