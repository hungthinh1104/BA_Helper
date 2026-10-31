import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { apiGet, apiPost } from "@/lib/api-client"
import { queryKeys } from "@/lib/api/query-keys"
import { ApprovedImpactReportResponse, approvedImpactReportResponseSchema, documentJobSchema, DocumentJob, finalReviewedReportResponseSchema, normalizeAppLocale, type ReportLocale } from "@ba-helper/contracts"
import { ApiError } from "@/lib/api-error"

export function isReportGenerationPending(error: unknown): boolean {
  if (!(error instanceof ApiError) || error.code !== "DOCUMENT_JOB_NOT_READY") return false
  if (!error.details || typeof error.details !== "object" || Array.isArray(error.details)) return false
  const status = (error.details as { status?: unknown }).status
  return status === "QUEUED" || status === "RUNNING"
}

export function isReportGenerationFailed(error: unknown): boolean {
  if (!(error instanceof ApiError) || error.code !== "DOCUMENT_JOB_NOT_READY") return false
  if (!error.details || typeof error.details !== "object" || Array.isArray(error.details)) return false
  return (error.details as { status?: unknown }).status === "FAILED"
}

export function useApprovedReport(analysisId: string, analysisStatus?: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.analyses.report(analysisId),
    queryFn: async () => {
      return apiGet<ApprovedImpactReportResponse>(`/api/v1/impact-analyses/${analysisId}/approved-report`, approvedImpactReportResponseSchema)
    },
    enabled: enabled && Boolean(analysisId) && analysisStatus === 'COMPLETED',
  })
}

export function useFinalReviewedReport(analysisId: string, locale?: ReportLocale | string) {
  const normalizedLocale = normalizeAppLocale(locale)
  return useQuery({
    queryKey: queryKeys.documents.finalReviewedReport(analysisId, normalizedLocale),
    queryFn: async () => {
      const qs = normalizedLocale !== 'en' ? `?locale=${normalizedLocale}` : ''
      return apiGet(`/api/v1/impact-analyses/${analysisId}/final-reviewed-report${qs}`, finalReviewedReportResponseSchema)
    },
    enabled: Boolean(analysisId),
    retry: false,
    refetchInterval: (query) => isReportGenerationPending(query.state.error) ? 1000 : false,
  })
}

export function useRetryReportGeneration(analysisId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () => apiPost<DocumentJob>(
      `/api/v1/impact-analyses/${analysisId}/document-jobs`,
      { requestKey: crypto.randomUUID(), retry: true },
      documentJobSchema,
    ),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.analyses.detail(analysisId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.analyses.workspace(analysisId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.analyses.report(analysisId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.documents.documentJobs(analysisId) }),
      ])
    },
  })
}
