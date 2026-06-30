import { useQuery } from "@tanstack/react-query"
import { apiGet } from "@/lib/api-client"
import { queryKeys } from "@/lib/api/query-keys"
import { ApprovedImpactReportResponse, approvedImpactReportResponseSchema, finalReviewedReportResponseSchema, FinalReviewedReportResponse } from "@ba-helper/contracts"
import { z } from "zod"

export function useApprovedReport(analysisId: string, analysisStatus?: string) {
  return useQuery({
    queryKey: queryKeys.analyses.report(analysisId),
    queryFn: async () => {
      return apiGet<ApprovedImpactReportResponse>(`/api/v1/impact-analyses/${analysisId}/approved-report`, approvedImpactReportResponseSchema)
    },
    enabled: Boolean(analysisId) && analysisStatus === 'COMPLETED',
  })
}

export function useFinalReviewedReport(analysisId: string, locale?: string) {
  return useQuery({
    queryKey: [...queryKeys.analyses.report(analysisId), "final-reviewed", locale || "en"],
    queryFn: async () => {
      const qs = locale && locale !== 'en' ? `?locale=${locale}` : ''
      return apiGet<FinalReviewedReportResponse>(`/api/v1/impact-analyses/${analysisId}/final-reviewed-report${qs}`, finalReviewedReportResponseSchema as unknown as z.ZodType<FinalReviewedReportResponse>)
    },
    enabled: Boolean(analysisId),
  })
}
