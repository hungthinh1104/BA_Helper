import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { apiGet, apiPost } from "@/lib/api-client"
import { ReviewedReportSnapshotResponse } from "@ba-helper/contracts"

const SNAPSHOT_QUERY_KEY = "reviewed-report-snapshot"

export function useLatestReviewedReportSnapshot(analysisId: string | undefined) {
  return useQuery({
    queryKey: [SNAPSHOT_QUERY_KEY, analysisId],
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
    onSuccess: (data) => {
      queryClient.setQueryData([SNAPSHOT_QUERY_KEY, analysisId], data)
    },
  })
}
