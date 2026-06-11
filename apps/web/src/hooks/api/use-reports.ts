import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { apiGet, apiPost } from "@/lib/api-client"
import { queryKeys } from "@/lib/api/query-keys"
import { useOptionalProjectId } from "@/lib/project-context"
import {
  MultiRepoMergedReportDraftResponse,
  MultiRepoApprovedReportResponse,
  multiRepoMergedReportDraftResponseSchema,
  multiRepoApprovedReportResponseSchema,
} from "@ba-helper/contracts"

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
