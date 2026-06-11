import { useQuery } from '@tanstack/react-query'
import { apiGet } from '@/lib/api-client'
import { queryKeys } from '@/lib/api/query-keys'
import { ReviewQueueResponse, reviewQueueResponseSchema } from '@ba-helper/contracts'

export function useReviewQueue(analysisId: string | undefined) {
  return useQuery<ReviewQueueResponse>({
    queryKey: queryKeys.analyses.reviewQueue(analysisId ?? ''),
    queryFn: () =>
      apiGet<ReviewQueueResponse>(
        `/api/v1/impact-analyses/${analysisId}/review-queue`,
        reviewQueueResponseSchema,
      ),
    enabled: Boolean(analysisId),
  })
}
