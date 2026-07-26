import { useMutation, useQueryClient } from "@tanstack/react-query"
import { apiDelete, apiPut } from "@/lib/api-client"
import { queryKeys } from "@/lib/api/query-keys"
import { useOptionalProjectId } from "@/lib/project-context"
import { z } from "zod"
import { traceabilityReviewDecisionValueSchema } from "@ba-helper/contracts"

export function useUpdateTraceabilityReviewDecision(analysisId: string, linkId: string) {
  const queryClient = useQueryClient()
  const projectId = useOptionalProjectId()

  return useMutation({
    mutationFn: async ({
      decision,
      note,
    }: {
      decision: z.infer<typeof traceabilityReviewDecisionValueSchema>
      note?: string | null
    }) => {
      return apiPut(
        `/api/v1/traceability-links/${linkId}/review-decision`,
        { decision, note }
      )
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.analyses.report(analysisId),
      })
      queryClient.invalidateQueries({
        queryKey: queryKeys.analyses.detail(analysisId),
      })
      queryClient.invalidateQueries({
        queryKey: queryKeys.analyses.traceability(analysisId),
      })
      queryClient.invalidateQueries({ queryKey: queryKeys.analyses.workspace(analysisId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.analyses.reviewQueue(analysisId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.analyses.reviewDecisions(analysisId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.analyses.reviewCompletion(analysisId) })
      if (projectId) queryClient.invalidateQueries({ queryKey: queryKeys.analyses.list(projectId) })
    },
  })
}

export function useDeleteTraceabilityReviewDecision(analysisId: string, linkId: string) {
  const queryClient = useQueryClient()
  const projectId = useOptionalProjectId()

  return useMutation({
    mutationFn: async () => {
      return apiDelete(
        `/api/v1/traceability-links/${linkId}/review-decision`
      )
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.analyses.report(analysisId),
      })
      queryClient.invalidateQueries({
        queryKey: queryKeys.analyses.detail(analysisId),
      })
      queryClient.invalidateQueries({
        queryKey: queryKeys.analyses.traceability(analysisId),
      })
      queryClient.invalidateQueries({ queryKey: queryKeys.analyses.workspace(analysisId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.analyses.reviewQueue(analysisId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.analyses.reviewDecisions(analysisId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.analyses.reviewCompletion(analysisId) })
      if (projectId) queryClient.invalidateQueries({ queryKey: queryKeys.analyses.list(projectId) })
    },
  })
}
