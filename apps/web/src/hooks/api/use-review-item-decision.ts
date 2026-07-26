import { useMutation, useQueryClient } from "@tanstack/react-query"
import { apiDelete, apiPost, apiPut } from "@/lib/api-client"
import { queryKeys } from "@/lib/api/query-keys"
import { useOptionalProjectId } from "@/lib/project-context"
import type { AnalysisWorkspaceReviewQueueItem } from "@ba-helper/contracts"

export type ReviewDecisionAction = "accept" | "reject" | "needs_more_evidence" | "undo"

type ItemType = AnalysisWorkspaceReviewQueueItem["itemType"]

const IMPACT_DECISION: Record<Exclude<ReviewDecisionAction, "undo">, string> = {
  accept: "ACCEPTED",
  reject: "REJECTED",
  needs_more_evidence: "NEEDS_MORE_EVIDENCE",
}

const INSIGHT_STATUS: Partial<Record<ReviewDecisionAction, string>> = {
  accept: "CONFIRMED",
  reject: "REJECTED",
}

/**
 * Which decision actions the backend actually supports for an item type.
 * Impact (traceability) items support the full decision set plus undo; insight
 * items (risk / unknown / qa / evidence) only support accept/reject.
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
      const note = rationale?.trim() ? rationale.trim() : null
      if (item.itemType === "impact") {
        if (action === "undo") {
          return apiDelete(`/api/v1/traceability-links/${item.itemId}/review-decision`)
        }
        return apiPut(`/api/v1/traceability-links/${item.itemId}/review-decision`, {
          decision: IMPACT_DECISION[action],
          note,
        })
      }
      const reviewStatus = INSIGHT_STATUS[action]
      if (!reviewStatus) {
        throw new Error(`Unsupported decision "${action}" for ${item.itemType}`)
      }
      return apiPost(`/api/v1/insights/${item.itemId}/review`, { reviewStatus })
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
