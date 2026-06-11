import { useQuery } from "@tanstack/react-query"
import { apiGet } from "@/lib/api-client"
import { queryKeys } from "@/lib/api/query-keys"
import { ApprovedImpactReportResponse, approvedImpactReportResponseSchema } from "@ba-helper/contracts"

export function useApprovedReport(analysisId: string, analysisStatus?: string) {
  return useQuery({
    queryKey: queryKeys.analyses.report(analysisId),
    queryFn: async () => {
      return apiGet<ApprovedImpactReportResponse>(`/api/v1/impact-analyses/${analysisId}/approved-report`, approvedImpactReportResponseSchema)
    },
    enabled: Boolean(analysisId) && analysisStatus === 'COMPLETED',
  })
}
