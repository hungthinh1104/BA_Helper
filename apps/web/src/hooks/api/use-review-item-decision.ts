import { useMutation, useQueryClient } from "@tanstack/react-query"
import { apiPut } from "@/lib/api-client"
import { queryKeys } from "@/lib/api/query-keys"
import { useOptionalProjectId } from "@/lib/project-context"
import type { AnalysisWorkspaceReviewQueueItem } from "@ba-helper/contracts"

export type ReviewDecisionAction = "accept" | "reject" | "needs_more_evidence" | "undo"

type ItemType = AnalysisWorkspaceReviewQueueItem["itemType"]

/**
 * Which decision actions the review UI offers for an item type. Impact
 * (traceability) items support the full decision set plus undo; insight items
 * (risk / unknown / qa / evidence) offer accept/reject.
 */
export function supportedDecisionActions(itemType: ItemType): ReviewDecisionAction[] {
  if (itemType === "impact") return ["accept", "reject", "needs_more_evidence", "undo"]
  if (itemType === "report") return []
  return ["accept", "reject"]
}

export function decisionRequiresRationale(action: ReviewDecisionAction): boolean {
  return action === "reject" || action === "needs_more_evidence"
}

export interface ReviewDecisionInput {
  item: Pick<AnalysisWorkspaceReviewQueueItem, "itemId" | "itemType">
  action: ReviewDecisionAction
  rationale?: string | null
}

/**
 * The single mutation surface for review decisions. The review workbench is the
 * only place that mutates a decision, so this hook centralises endpoint routing
 * (impact → traceability decision, insight → insight review), cache
 * invalidation, and the in-flight guard against double submission.
 */
export function useReviewItemDecision(analysisId: string) {
  const queryClient = useQueryClient()
  const projectId = useOptionalProjectId()

  const mutation = useMutation({
    mutationFn: async ({ item, action, rationale }: ReviewDecisionInput) => {
      const target = item.itemType === "impact" ? "impact" : "insight"
      return apiPut(
        `/api/v1/impact-analyses/${analysisId}/review-items/${item.itemId}/decision`,
        {
          target,
          action,
          rationale: rationale?.trim() ? rationale.trim() : null,
        },
      )
    },
    onSuccess: () => {
      const keys = [
        queryKeys.analyses.workspace(analysisId),
        queryKeys.analyses.reviewQueue(analysisId),
        queryKeys.analyses.reviewDecisions(analysisId),
        queryKeys.analyses.reviewCompletion(analysisId),
        queryKeys.analyses.detail(analysisId),
        queryKeys.analyses.report(analysisId),
      ]
      for (const queryKey of keys) queryClient.invalidateQueries({ queryKey })
      if (projectId) queryClient.invalidateQueries({ queryKey: queryKeys.analyses.list(projectId) })
    },
  })

  return {
    decide: mutation.mutate,
    isPending: mutation.isPending,
    error: mutation.error as Error | null,
    pendingItemId: mutation.isPending ? mutation.variables?.item.itemId ?? null : null,
    reset: mutation.reset,
  }
}
