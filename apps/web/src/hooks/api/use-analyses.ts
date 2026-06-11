import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { apiGet, apiPost } from "@/lib/api-client"
import { queryKeys } from "@/lib/api/query-keys"
import {
  ImpactAnalysisListResponse,
  ImpactAnalysisDetailResponse,
  ImpactAnalysisCreateRequest,
  ImpactAnalysisResponse,
  MultiRepoImpactAnalysisCreateRequest,
  MultiRepoImpactAnalysisCreateResponse,
  MultiRepoAnalysisRunDetailResponse,
  MultiRepoAnalysisRunListResponse,
  MultiRepoMergedReportDraftResponse,
  MultiRepoApprovedReportResponse,
  MergedMultiRepoReportReviewDecisionResponse,
  MergedMultiRepoReportReviewDecisionListResponse,
  MergedMultiRepoReportReviewDecisionCreateResponse,
  InsightListResponse,
  TraceabilityLinkListResponse,
  InsightReviewRequest,
  impactAnalysisListResponseSchema,
  impactAnalysisResponseSchema,
  multiRepoImpactAnalysisCreateResponseSchema,
  multiRepoAnalysisRunDetailResponseSchema,
  multiRepoAnalysisRunListResponseSchema,
  multiRepoMergedReportDraftResponseSchema,
  multiRepoApprovedReportResponseSchema,
  mergedMultiRepoReportReviewDecisionResponseSchema,
  mergedMultiRepoReportReviewDecisionListResponseSchema,
  mergedMultiRepoReportReviewDecisionCreateResponseSchema,
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

export function useCreateMultiRepoAnalyses(projectId?: string) {
  const activeProjectId = useOptionalProjectId()
  const effectiveProjectId = projectId ?? activeProjectId
  const projectQueryKey = effectiveProjectId ?? "__workspace-pending__"
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: {
      requirementRevisionId: string
      repositoryIds: string[]
      allowPartialSnapshot: boolean
      requestKey: string
    }) => {
      if (!effectiveProjectId) {
        throw new Error("No active project selected.")
      }

      const request: MultiRepoImpactAnalysisCreateRequest = {
        requirementRevisionId: data.requirementRevisionId,
        repositoryIds: data.repositoryIds,
        allowPartialSnapshot: data.allowPartialSnapshot,
        requestKey: data.requestKey,
      }

      return apiPost<MultiRepoImpactAnalysisCreateResponse>(
        `/api/v1/projects/${effectiveProjectId}/multi-repo-analyses`,
        request,
        multiRepoImpactAnalysisCreateResponseSchema,
      )
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.analyses.list(projectQueryKey),
      })
      queryClient.invalidateQueries({
        queryKey: queryKeys.analyses.all,
      })
      queryClient.invalidateQueries({
        queryKey: queryKeys.analyses.runs.list(projectQueryKey),
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

export function useMultiRepoAnalysisRunDetail(runId: string) {
  return useQuery({
    queryKey: queryKeys.analyses.runs.detail(runId),
    queryFn: async () => {
      return apiGet<MultiRepoAnalysisRunDetailResponse>(
        `/api/v1/multi-repo-runs/${runId}`,
        multiRepoAnalysisRunDetailResponseSchema,
      )
    },
    enabled: Boolean(runId),
    refetchOnWindowFocus: true,
  })
}

export function useMultiRepoImpactMatrix(runId: string) {
  return useQuery({
    queryKey: [...queryKeys.analyses.runs.detail(runId), "impact-matrix"],
    queryFn: async () => {
      const { multiRepoImpactMatrixResponseSchema } = await import("@ba-helper/contracts")
      return apiGet<import("@ba-helper/contracts").MultiRepoImpactMatrixResponse>(
        `/api/v1/multi-repo-runs/${runId}/impact-matrix`,
        multiRepoImpactMatrixResponseSchema,
      )
    },
    enabled: Boolean(runId),
    refetchOnWindowFocus: true,
  })
}

export function useMultiRepoMergedReportDraft(runId: string) {
  return useQuery({
    queryKey: queryKeys.analyses.runs.mergedReport(runId),
    queryFn: async () => {
      return apiGet<MultiRepoMergedReportDraftResponse>(
        `/api/v1/multi-repo-runs/${runId}/merged-report-draft`,
        multiRepoMergedReportDraftResponseSchema,
      )
    },
    enabled: Boolean(runId),
    refetchOnWindowFocus: true,
  })
}

export function useApprovedMultiRepoReport(runId: string) {
  return useQuery({
    queryKey: queryKeys.analyses.runs.approvedReport(runId),
    queryFn: async () => {
      return apiGet<MultiRepoApprovedReportResponse>(
        `/api/v1/multi-repo-runs/${runId}/merged-report`,
        multiRepoApprovedReportResponseSchema,
      )
    },
    enabled: Boolean(runId),
    refetchOnWindowFocus: true,
  })
}

export function useMultiRepoAnalysisRuns(projectId?: string) {
  const activeProjectId = useOptionalProjectId()
  const effectiveProjectId = projectId ?? activeProjectId

  return useQuery({
    queryKey: queryKeys.analyses.runs.list(
      effectiveProjectId ?? "__workspace-pending__",
    ),
    queryFn: async () => {
      return apiGet<MultiRepoAnalysisRunListResponse>(
        `/api/v1/projects/${effectiveProjectId}/multi-repo-runs`,
        multiRepoAnalysisRunListResponseSchema,
      )
    },
    enabled: Boolean(effectiveProjectId),
    refetchOnWindowFocus: true,
  })
}

export function useFinalizeMultiRepoReport(runId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      return apiPost<MultiRepoApprovedReportResponse>(
        `/api/v1/multi-repo-runs/${runId}/merged-report/finalize`,
        {},
        multiRepoApprovedReportResponseSchema,
      )
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.analyses.runs.detail(runId),
      })
      queryClient.invalidateQueries({
        queryKey: queryKeys.analyses.runs.approvedReport(runId),
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
