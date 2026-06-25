import { queryKeys } from "@/lib/api/query-keys"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { apiGet, apiPost } from "@/lib/api-client"
import { finalReviewedReportResponseSchema, ReviewedReportSnapshotResponse, type ReportLocale } from "@ba-helper/contracts"

export function useFinalReviewedReport(analysisId: string, options?: { enabled?: boolean; locale?: ReportLocale }) {
  const locale = options?.locale ?? "en"

  return useQuery({
    queryKey: queryKeys.documents.finalReviewedReport(analysisId, locale),
    queryFn: () =>
      apiGet(
        `/api/v1/impact-analyses/${analysisId}/final-reviewed-report?locale=${locale}`,
        finalReviewedReportResponseSchema,
      ),
    enabled: options?.enabled,
    retry: false, // Do not retry if the gate blocks it
  })
}

export function useLatestReviewedReportSnapshot(analysisId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.documents.reviewedReportSnapshot(analysisId || ""),
    queryFn: async () => {
      if (!analysisId) throw new Error("Analysis ID is required")
      const result = await apiGet(`/api/v1/impact-analyses/${analysisId}/reviewed-report-snapshot/latest`)
      return result as ReviewedReportSnapshotResponse
    },
    enabled: !!analysisId,
    retry: false, // Don't retry if 404 (no snapshot yet)
  })
}

export function useCreateReviewedReportSnapshot(analysisId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      const result = await apiPost(`/api/v1/impact-analyses/${analysisId}/reviewed-report-snapshot`, {})
      return result as ReviewedReportSnapshotResponse
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.documents.reviewedReportSnapshot(analysisId)
      })
    },
  })
}
