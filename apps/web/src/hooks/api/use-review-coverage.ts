import { useQuery } from "@tanstack/react-query"
import { apiGet } from "@/lib/api-client"
import { queryKeys } from "@/lib/api/query-keys"
import {
  ReviewCoverageResponse,
  reviewCoverageResponseSchema,
} from "@ba-helper/contracts"

export function useReviewCoverage(runId: string) {
  return useQuery({
    queryKey: queryKeys.analyses.runs.reviewCoverage(runId),
    queryFn: async () => {
      return apiGet<ReviewCoverageResponse>(
        `/api/v1/multi-repo-runs/${runId}/review-coverage`,
        reviewCoverageResponseSchema,
      )
    },
    enabled: Boolean(runId),
    refetchOnWindowFocus: false,
  })
}
