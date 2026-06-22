import { useQuery } from "@tanstack/react-query"
import { apiGet } from "@/lib/api-client"
import { finalReviewedReportResponseSchema } from "@ba-helper/contracts"

export function useFinalReviewedReport(analysisId: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ["final-reviewed-report", analysisId],
    queryFn: () =>
      apiGet(
        `/api/v1/impact-analyses/${analysisId}/final-reviewed-report`,
        finalReviewedReportResponseSchema,
      ),
    enabled: options?.enabled,
    retry: false, // Do not retry if the gate blocks it
  })
}
