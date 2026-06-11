import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { apiGet, apiPost } from "@/lib/api-client"
import { queryKeys } from "@/lib/api/query-keys"
import {
  ImpactAnalysisListResponse,
  ImpactAnalysisDetailResponse,
  ImpactAnalysisCreateRequest,
  ImpactAnalysisResponse,
  InsightListResponse,
  TraceabilityLinkListResponse,
  InsightReviewRequest,
  impactAnalysisListResponseSchema,
  impactAnalysisResponseSchema,
  insightListResponseSchema,
  traceabilityLinkListResponseSchema,
  TraceabilityReviewRequest,
  ImpactAnalysisDiffResponse,
  impactAnalysisDiffResponseSchema,
  ReviewDecisionRequest,
  ReviewDecisionListResponse,
  ReviewDecisionCreateResponse,
  reviewDecisionListResponseSchema,
  reviewDecisionCreateResponseSchema,
} from "@ba-helper/contracts"

import { canPollAnalysisDetail } from "@/lib/status-helpers"
import { useOptionalProjectId } from "@/lib/project-context"

export function useAnalyses(params?: { projectId?: string; limit?: number; offset?: number }) {
  const activeProjectId = useOptionalProjectId()
  const effectiveProjectId = params?.projectId ?? activeProjectId
  const projectQueryKey = effectiveProjectId ?? "__workspace-pending__"
  return useQuery({
    queryKey: queryKeys.analyses.list(projectQueryKey, { limit: params?.limit, offset: params?.offset }),
    queryFn: async () => {
      const url = new URL(`/api/v1/projects/${effectiveProjectId}/analyses`, window.location.origin)
      if (params?.limit) url.searchParams.set('limit', params.limit.toString())
      if (params?.offset) url.searchParams.set('offset', params.offset.toString())
      return apiGet<ImpactAnalysisListResponse>(url.pathname + url.search, impactAnalysisListResponseSchema)
    },
    enabled: Boolean(effectiveProjectId),
    refetchOnWindowFocus: true,
  })
}

export function useAnalysisDetail(_projectId: string | undefined, analysisId: string) {
  return useQuery({
    queryKey: queryKeys.analyses.detail(analysisId),
    queryFn: async () => {
      return apiGet<ImpactAnalysisDetailResponse>(`/api/v1/impact-analyses/${analysisId}`, impactAnalysisResponseSchema)
    },
    enabled: Boolean(analysisId),
    refetchOnWindowFocus: true,
    refetchInterval: (query) => {
      const data = query.state.data;
      return data && canPollAnalysisDetail(data) ? 3000 : false;
    },
  })
}

export function useCreateAnalysis(projectId?: string) {
  const activeProjectId = useOptionalProjectId()
  const effectiveProjectId = projectId ?? activeProjectId
  const projectQueryKey = effectiveProjectId ?? "__workspace-pending__"
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ revisionId, data }: { revisionId: string, data: ImpactAnalysisCreateRequest }) => {
      return apiPost<ImpactAnalysisResponse>(`/api/v1/requirement-revisions/${revisionId}/impact-analyses`, data, impactAnalysisResponseSchema)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.analyses.list(projectQueryKey),
      })
      queryClient.invalidateQueries({
        queryKey: queryKeys.requirements.all,
      })
      queryClient.invalidateQueries({
        queryKey: queryKeys.repositories.all,
      })
    },
  })
}

export function useAnalysisInsights(_projectId: string | undefined, analysisId: string) {
  return useQuery({
    queryKey: [...queryKeys.analyses.detail(analysisId), "insights"],
    queryFn: async () => {
      return apiGet<InsightListResponse>(`/api/v1/impact-analyses/${analysisId}/insights`, insightListResponseSchema)
    },
    enabled: Boolean(analysisId),
  })
}

export function useAnalysisTraceability(_projectId: string | undefined, analysisId: string) {
  return useQuery({
    queryKey: [...queryKeys.analyses.detail(analysisId), "traceability"],
    queryFn: async () => {
      return apiGet<TraceabilityLinkListResponse>(`/api/v1/impact-analyses/${analysisId}/traceability`, traceabilityLinkListResponseSchema)
    },
    enabled: Boolean(analysisId),
  })
}

export function useReviewInsight(projectId: string | undefined, analysisId: string) {
  const activeProjectId = useOptionalProjectId()
  const effectiveProjectId = projectId ?? activeProjectId
  const projectQueryKey = effectiveProjectId ?? "__workspace-pending__"
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ insightId, data }: { insightId: string, data: InsightReviewRequest }) => {
      return apiPost(`/api/v1/insights/${insightId}/review`, data)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [...queryKeys.analyses.detail(analysisId), "insights"],
      })
      queryClient.invalidateQueries({
        queryKey: queryKeys.analyses.detail(analysisId),
      })
      queryClient.invalidateQueries({
        queryKey: queryKeys.analyses.list(projectQueryKey),
      })
      queryClient.invalidateQueries({
        queryKey: queryKeys.analyses.reviewQueue(analysisId),
      })
    }
  })
}

export function useReviewTraceabilityLink() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ traceabilityLinkId, data }: { traceabilityLinkId: string, data: TraceabilityReviewRequest }) => {
      return apiPost(`/api/v1/traceability-links/${traceabilityLinkId}/review`, data)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.analyses.all,
      })
    }
  })
}

export function useFinalizeAnalysis(projectId: string | undefined, analysisId: string) {
  const activeProjectId = useOptionalProjectId()
  const effectiveProjectId = projectId ?? activeProjectId
  const projectQueryKey = effectiveProjectId ?? "__workspace-pending__"
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      return apiPost(`/api/v1/impact-analyses/${analysisId}/finalize`, {})
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.analyses.detail(analysisId),
      })
      queryClient.invalidateQueries({
        queryKey: queryKeys.analyses.list(projectQueryKey),
      })
      queryClient.invalidateQueries({
        queryKey: queryKeys.analyses.report(analysisId),
      })
    }
  })
}

export function useAnalysisDiff(analysisId: string, enabled: boolean = true) {
  return useQuery({
    queryKey: queryKeys.analyses.diff(analysisId),
    queryFn: async () => {
      return apiGet<ImpactAnalysisDiffResponse>(
        `/api/v1/impact-analyses/${analysisId}/diff`,
        impactAnalysisDiffResponseSchema
      )
    },
    enabled: Boolean(analysisId) && enabled,
    refetchOnWindowFocus: true,
  })
}

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

export function useReviewClarifications(analysisId: string) {
  return useQuery({
    queryKey: [...queryKeys.analyses.detail(analysisId), "review-clarifications"],
    queryFn: async () => {
      const { reviewClarificationListResponseSchema } = await import("@ba-helper/contracts")
      return apiGet(
        `/api/v1/impact-analyses/${analysisId}/review-clarifications`,
        reviewClarificationListResponseSchema
      )
    },
    enabled: Boolean(analysisId),
  })
}

export function useCreateReviewClarification(analysisId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ data }: { data: import("@ba-helper/contracts").ReviewClarificationCreateRequest }) => {
      const { reviewClarificationRequestSchema } = await import("@ba-helper/contracts")
      return apiPost(
        `/api/v1/impact-analyses/${analysisId}/review-clarifications`,
        data,
        reviewClarificationRequestSchema
      )
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [...queryKeys.analyses.detail(analysisId), "review-clarifications"],
      })
    },
  })
}

export function useAnswerReviewClarification(analysisId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ clarificationId, data }: { clarificationId: string; data: { answer: string } }) => {
      const { reviewClarificationRequestSchema } = await import("@ba-helper/contracts")
      return apiPost(
        `/api/v1/review-clarifications/${clarificationId}/answer`,
        data,
        reviewClarificationRequestSchema
      )
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [...queryKeys.analyses.detail(analysisId), "review-clarifications"],
      })
    },
  })
}

export function useCreateDerivedAnalysisFromClarification(analysisId: string) {
  const queryClient = useQueryClient()
  const activeProjectId = useOptionalProjectId()

  return useMutation({
    mutationFn: async (clarificationId: string) => {
      const { impactAnalysisResponseSchema } = await import("@ba-helper/contracts")
      return apiPost(
        `/api/v1/review-clarifications/${clarificationId}/derived-analyses`,
        {},
        impactAnalysisResponseSchema
      )
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [...queryKeys.analyses.detail(analysisId), "review-clarifications"],
      })
      queryClient.invalidateQueries({
        queryKey: queryKeys.analyses.list(activeProjectId ?? "__workspace-pending__"),
      })
    },
  })
}

export function useAnalysisLineage(analysisId: string) {
  return useQuery({
    queryKey: [...queryKeys.analyses.detail(analysisId), "lineage"],
    queryFn: async () => {
      const { lineageTimelineResponseSchema } = await import("@ba-helper/contracts")
      return apiGet(
        `/api/v1/impact-analyses/${analysisId}/lineage`,
        lineageTimelineResponseSchema
      )
    },
    enabled: !!analysisId,
  })
}
