import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { apiGet, apiPost } from "@/lib/api-client"
import { queryKeys } from "@/lib/api/query-keys"
import {
  ReviewDecisionRequest,
  ReviewDecisionListResponse,
  ReviewDecisionCreateResponse,
  MergedMultiRepoReportReviewDecisionResponse,
  MergedMultiRepoReportReviewDecisionListResponse,
  MergedMultiRepoReportReviewDecisionCreateResponse,
  reviewDecisionListResponseSchema,
  reviewDecisionCreateResponseSchema,
  mergedMultiRepoReportReviewDecisionResponseSchema,
  mergedMultiRepoReportReviewDecisionListResponseSchema,
  mergedMultiRepoReportReviewDecisionCreateResponseSchema,
} from "@ba-helper/contracts"

export function useReviewDecisions(analysisId: string) {
  return useQuery({
    queryKey: [...queryKeys.analyses.detail(analysisId), "review-decisions"],
    queryFn: async () => {
      return apiGet<ReviewDecisionListResponse>(
        `/api/v1/impact-analyses/${analysisId}/review-decisions`,
        reviewDecisionListResponseSchema
      )
    },
    enabled: Boolean(analysisId),
  })
}

export function useCreateReviewDecision(analysisId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ data }: { data: ReviewDecisionRequest }) => {
      return apiPost<ReviewDecisionCreateResponse>(
        `/api/v1/impact-analyses/${analysisId}/review-decisions`,
        data,
        reviewDecisionCreateResponseSchema
      )
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [...queryKeys.analyses.detail(analysisId), "review-decisions"],
      })
      queryClient.invalidateQueries({
        queryKey: queryKeys.analyses.detail(analysisId),
      })
      queryClient.invalidateQueries({
        queryKey: queryKeys.analyses.report(analysisId),
      })
    },
  })
}

export function useMergedMultiRepoReportReviewDecisions(runId: string) {
  return useQuery({
    queryKey: queryKeys.analyses.runs.reviewDecisions(runId),
    queryFn: async () => {
      return apiGet<MergedMultiRepoReportReviewDecisionListResponse>(
        `/api/v1/multi-repo-runs/${runId}/merged-report/review-decisions`,
        mergedMultiRepoReportReviewDecisionListResponseSchema,
      )
    },
    enabled: Boolean(runId),
  })
}

export function useLatestMergedMultiRepoReportReviewDecision(runId: string) {
  return useQuery({
    queryKey: queryKeys.analyses.runs.latestReviewDecision(runId),
    queryFn: async () => {
      return apiGet<MergedMultiRepoReportReviewDecisionResponse>(
        `/api/v1/multi-repo-runs/${runId}/merged-report/review-decisions/latest`,
        mergedMultiRepoReportReviewDecisionResponseSchema,
      )
    },
    enabled: Boolean(runId),
    retry: false,
  })
}

export function useCreateMergedMultiRepoReportReviewDecision(runId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ data }: { data: ReviewDecisionRequest }) => {
      return apiPost<MergedMultiRepoReportReviewDecisionCreateResponse>(
        `/api/v1/multi-repo-runs/${runId}/merged-report/review-decisions`,
        data,
        mergedMultiRepoReportReviewDecisionCreateResponseSchema,
      )
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.analyses.runs.reviewDecisions(runId),
      })
      queryClient.invalidateQueries({
        queryKey: queryKeys.analyses.runs.latestReviewDecision(runId),
      })
      queryClient.invalidateQueries({
        queryKey: queryKeys.analyses.runs.approvedReport(runId),
      })
      queryClient.invalidateQueries({
        queryKey: queryKeys.analyses.runs.detail(runId),
      })
    },
  })
}
