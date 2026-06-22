import { useQuery } from "@tanstack/react-query"
import { apiGet } from "@/lib/api-client"
import { reviewCompletionResponseSchema } from "@ba-helper/contracts"

export function useReviewCompletion(analysisId: string) {
  return useQuery({
    queryKey: ["review-completion", analysisId],
    queryFn: () =>
      apiGet(
        `/api/v1/impact-analyses/${analysisId}/review-completion`,
        reviewCompletionResponseSchema,
      ),
  })
}
