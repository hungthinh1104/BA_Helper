"use client"

import { useMemo, useState } from "react"
import { ReviewQueueItem, ReviewQueueResponse } from "@ba-helper/contracts"
import { CheckCircle, XCircle, SkipForward, AlertCircle, Activity, LayoutList } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useReviewInsight, useReviewTraceabilityLink } from "@/hooks/api/use-analyses"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { DecisionNoteForm } from "@/components/workspace/review/decision-note-form"
import { ReviewStatusBadge } from "@/components/workspace/shared/status-badges"

interface ReviewQueuePanelProps {
  queueData: ReviewQueueResponse
  onSelect: (type: "INSIGHT" | "TRACEABILITY_LINK" | "GRAPH_NODE", id: string, artifactId?: string) => void
  selectedQueueItemId?: string | null
  canReview: boolean
  canViewReviewQueue: boolean
}

const REVIEW_QUEUE_PAGE_SIZE = 50

function getPriorityBadgeClass(priority: string) {
  switch (priority) {
    case "HIGH":   return "badge-risk"
    case "MEDIUM": return "badge-inferred"
    default:       return "badge-neutral"
  }
}

export function ReviewQueuePanel({
  queueData,
  onSelect,
  selectedQueueItemId,
  canReview,
  canViewReviewQueue,
}: ReviewQueuePanelProps) {
  const { summary, items } = queueData

  const [skippedLocal, setSkippedLocal] = useState<Set<string>>(new Set())
  const [page, setPage] = useState(1)
  const reviewInsight = useReviewInsight(undefined, queueData.analysisId)
  const reviewLink = useReviewTraceabilityLink(undefined, queueData.analysisId)

  const activeItemIndex = useMemo(() => {
    if (selectedQueueItemId) {
      const idx = items.findIndex((i: ReviewQueueItem) => i.id === selectedQueueItemId)
      if (idx !== -1) return idx
    }
    const first = items.findIndex((i: ReviewQueueItem) =>
      !skippedLocal.has(i.id) &&
      i.reviewStatus !== "CONFIRMED" &&
      i.reviewStatus !== "REJECTED"
    )
    return first !== -1 ? first : 0
  }, [items, skippedLocal, selectedQueueItemId])

  const activeItem = items[activeItemIndex]
  const totalPages = Math.max(1, Math.ceil(items.length / REVIEW_QUEUE_PAGE_SIZE))
  const currentPage = Math.min(
    selectedQueueItemId ? Math.floor(activeItemIndex / REVIEW_QUEUE_PAGE_SIZE) + 1 : page,
    totalPages,
  )
  const pageStart = (currentPage - 1) * REVIEW_QUEUE_PAGE_SIZE
  const pageEnd = Math.min(pageStart + REVIEW_QUEUE_PAGE_SIZE, items.length)
  const pagedItems = items.slice(pageStart, pageEnd)

  const handleSelect = (idx: number) => {
    const item = items[idx]
    if (!item) return
    setPage(Math.floor(idx / REVIEW_QUEUE_PAGE_SIZE) + 1)
    if (item.type === "INSIGHT" && item.linkedInsightId) {
      onSelect("INSIGHT", item.linkedInsightId)
    } else if (item.type === "TRACEABILITY_LINK" && item.linkedTraceabilityLinkId && item.linkedArtifactId) {
      onSelect("TRACEABILITY_LINK", item.linkedTraceabilityLinkId, item.linkedArtifactId)
    } else if (item.linkedArtifactId) {
      onSelect("GRAPH_NODE", `artifact-${item.linkedArtifactId}`, item.linkedArtifactId)
    }
  }

  const handleNext = () => { if (activeItemIndex < items.length - 1) handleSelect(activeItemIndex + 1) }
  const handlePrev = () => { if (activeItemIndex > 0) handleSelect(activeItemIndex - 1) }

  const handleSkip = () => {
    if (!activeItem) return
    setSkippedLocal(prev => { const next = new Set(prev); next.add(activeItem.id); return next })
    handleNext()
  }

  const handleConfirm = () => {
    if (!activeItem?.requiresDecision || !canReview) return
    if (activeItem.type === "INSIGHT" || activeItem.type === "UNKNOWN") {
      reviewInsight.mutate({ insightId: activeItem.id, data: { reviewStatus: "CONFIRMED" } }, { onSuccess: handleNext })
    } else if (activeItem.type === "TRACEABILITY_LINK" && activeItem.linkedTraceabilityLinkId) {
      reviewLink.mutate({ traceabilityLinkId: activeItem.linkedTraceabilityLinkId, data: { reviewStatus: "CONFIRMED" } }, { onSuccess: handleNext })
    }
  }

  const handleReject = () => {
    if (!activeItem?.requiresDecision || !canReview) return
    if (activeItem.type === "INSIGHT" || activeItem.type === "UNKNOWN") {
      reviewInsight.mutate({ insightId: activeItem.id, data: { reviewStatus: "REJECTED" } }, { onSuccess: handleNext })
    } else if (activeItem.type === "TRACEABILITY_LINK" && activeItem.linkedTraceabilityLinkId) {
      reviewLink.mutate({ traceabilityLinkId: activeItem.linkedTraceabilityLinkId, data: { reviewStatus: "REJECTED" } }, { onSuccess: handleNext })
    }
  }

  const isMutating = reviewInsight.isPending || reviewLink.isPending
  const percentComplete = summary.total > 0 ? ((summary.total - summary.remaining) / summary.total) * 100 : 100

  if (!canViewReviewQueue) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8">
        <AlertCircle className="w-8 h-8 text-muted-foreground mb-3" />
        <p className="text-[13px] font-medium text-foreground mb-1">Review queue unavailable</p>
        <p className="text-[12px] text-muted-foreground">
          Your current project role does not include review queue access.
        </p>
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8">
        <div className="w-12 h-12 rounded-full bg-success/10 flex items-center justify-center mb-3">
          <CheckCircle className="w-6 h-6 text-success" />
        </div>
        <p className="text-[13px] font-medium text-foreground mb-1">Queue is clear</p>
        <p className="text-[12px] text-muted-foreground">No items require your review. You can finalize the analysis.</p>
      </div>
    )
  }

  return (
    <div className="flex h-full w-full flex-col overflow-hidden lg:flex-row">

      {/* ── Left sidebar: queue list ── */}
      <div className="flex w-full shrink-0 flex-col border-b border-border bg-surface-muted/30 lg:w-72 lg:border-b-0 lg:border-r">

        {/* Header */}
        <div className="px-3 py-3 border-b border-border">
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 mb-3">
            <LayoutList className="w-3.5 h-3.5" /> Review Queue
          </h2>

          {/* Progress bar */}
          <div className="space-y-1">
            <div className="flex justify-between text-[11px] text-muted-foreground">
              <span>{summary.total - summary.remaining} / {summary.total} reviewed</span>
              <span className="font-medium text-foreground">{summary.remaining} left</span>
            </div>
            <div className="bg-border h-1 w-full rounded-full overflow-hidden">
              <div
                className="bg-primary h-full transition-all duration-300"
                style={{ width: `${percentComplete}%` }}
              />
            </div>
          </div>

          {summary.highRiskRemaining > 0 && (
            <div className="flex items-center gap-1.5 text-[11px] text-danger mt-2.5 bg-danger/8 px-2 py-1.5 rounded border border-danger/20">
              <AlertCircle className="w-3 h-3 shrink-0" />
              <span>{summary.highRiskRemaining} high-risk unresolved</span>
            </div>
          )}

          {skippedLocal.size > 0 && (
            <p className="text-[10px] text-muted-foreground mt-2">
              {skippedLocal.size} skipped in this session. Review status is unchanged.
            </p>
          )}
        </div>

        {/* Queue items */}
        <div className="flex-1 overflow-y-auto py-1">
          {pagedItems.map((item: ReviewQueueItem, idx: number) => {
            const absoluteIndex = pageStart + idx
            const isActive    = absoluteIndex === activeItemIndex
            const isCompleted = item.reviewStatus === "CONFIRMED" || item.reviewStatus === "REJECTED"
            const isSkipped   = skippedLocal.has(item.id)

            return (
              <button
                key={item.id}
                onClick={() => handleSelect(absoluteIndex)}
                className={`
                  w-full text-left px-3 py-2.5 border-b border-border last:border-0 text-sm transition-colors
                  ${isActive ? "bg-surface-soft" : "hover:bg-surface-muted/60"}
                  ${isCompleted ? "opacity-50" : ""}
                `}
              >
                {/* Accent line */}
                <div className={`flex items-start gap-2`}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <Badge className={`${getPriorityBadgeClass(item.priority)} h-5 px-2 text-[11px]`}>
                        {item.priority}
                      </Badge>
                      {isSkipped && <SkipForward className="w-3 h-3 text-muted-foreground" />}
                    </div>
                    <p className={`text-sm leading-snug line-clamp-2 ${isActive ? "text-foreground font-medium" : "text-foreground/80"}`}>
                      {item.title}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <span className="text-xs text-muted-foreground capitalize">{item.type.replace(/_/g, " ").toLowerCase()}</span>
                      <ReviewStatusBadge status={item.reviewStatus ?? "NEEDS_REVIEW"} />
                    </div>
                  </div>
                </div>
              </button>
            )
          })}
        </div>

        {items.length > REVIEW_QUEUE_PAGE_SIZE ? (
          <div className="flex items-center justify-between border-t border-border px-3 py-2 text-xs text-muted-foreground">
            <span>
              Showing {pageStart + 1}-{pageEnd} of {items.length}
            </span>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="ghost"
                className="h-8 px-2 text-xs"
                onClick={() => setPage(currentPage - 1)}
                disabled={currentPage <= 1}
              >
                Prev
              </Button>
              <span>{currentPage}/{totalPages}</span>
              <Button
                size="sm"
                variant="ghost"
                className="h-8 px-2 text-xs"
                onClick={() => setPage(currentPage + 1)}
                disabled={currentPage >= totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        ) : null}
      </div>

      {/* ── Right: active item detail ── */}
      <div className="flex min-h-0 flex-1 flex-col bg-surface">
        {activeItem ? (
          <div className="flex-1 overflow-y-auto p-4 lg:p-6">
            <div className="mx-auto max-w-2xl">

            {/* Type + priority row */}
            <div className="flex items-center gap-2 mb-4">
              <Badge className={`${getPriorityBadgeClass(activeItem.priority)} px-2 py-0.5 text-[10px]`}>
                {activeItem.priority}
              </Badge>
              <span className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">
                {activeItem.type.replace(/_/g, " ").toLowerCase()}
              </span>
              <span className="text-[11px] text-muted-foreground">·</span>
              <span className="text-[11px] text-muted-foreground">{activeItemIndex + 1} of {items.length}</span>
            </div>

            {/* Title */}
            <h1 className="text-[16px] font-bold tracking-tight text-foreground mb-4 leading-snug">{activeItem.title}</h1>

            {/* Why it matters */}
            <div className="bg-surface-muted/50 border border-border rounded-lg p-3 mb-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Why it matters</p>
              <p className="text-[13px] text-muted-foreground/90 leading-relaxed">{activeItem.reason}</p>
              {activeItem.priorityReason && (
                <p className="text-[11px] text-muted-foreground mt-2 flex items-center gap-1.5">
                  <Activity className="w-3 h-3" /> {activeItem.priorityReason}
                </p>
              )}
            </div>

            {/* Suggested action */}
            {activeItem.suggestedAction && (
              <div className="bg-info-soft border border-info/20 rounded-lg p-3 mb-4">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-info mb-1">Suggested Action</p>
                <p className="text-[13px] text-foreground">{activeItem.suggestedAction}</p>
              </div>
            )}

            {/* Review actions */}
            <div className="mt-6 pt-4 border-t border-border">
              <h4 className="text-[12px] font-semibold text-foreground mb-3">Reviewer Action</h4>
              {activeItem.reviewStatus === "CONFIRMED" || activeItem.reviewStatus === "REJECTED" ? (
                <div className="flex items-center gap-2.5 p-3 rounded-lg border border-success/30 bg-success-soft text-success">
                  <CheckCircle className="w-4 h-4 shrink-0" />
                  <div>
                    <p className="text-[13px] font-medium">
                      {activeItem.reviewStatus === "CONFIRMED" ? "Confirmed" : "Rejected"}
                    </p>
                    <p className="text-[11px] opacity-80">This item has been removed from the remaining queue.</p>
                  </div>
                </div>
              ) : (
                <div>
                  {!activeItem.requiresDecision && (
                    <p className="text-[12px] text-muted-foreground mb-3 flex items-center gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      No explicit decision needed — this item warns of potential issues only.
                    </p>
                  )}
                  {activeItem.requiresDecision && (
                    <p className="text-[12px] text-muted-foreground mb-3">
                      {canReview
                        ? "Review the evidence in the inspector panel, then decide."
                        : "Review queue is read-only for your role. Reviewer or Owner required to submit evidence decisions."}
                    </p>
                  )}

                  <div className="flex items-center gap-2 flex-wrap">
                    {activeItem.requiresDecision && canReview && (
                      <>
                        <Button
                          onClick={handleConfirm}
                          disabled={isMutating}
                          size="sm"
                          className="h-8 bg-primary-action text-primary-action-text hover:opacity-90"
                        >
                          <CheckCircle className="w-3.5 h-3.5 mr-1.5" /> Confirm
                        </Button>
                        <Button
                          onClick={handleReject}
                          disabled={isMutating}
                          size="sm"
                          variant="outline"
                          className="h-8 text-danger border-danger/30 hover:bg-danger-soft hover:border-danger/50"
                        >
                          <XCircle className="w-3.5 h-3.5 mr-1.5" /> Reject
                        </Button>
                      </>
                    )}
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger render={<span className="inline-block" />}>
                          <Button
                            onClick={handleSkip}
                            size="sm"
                            variant="ghost"
                            className="h-9 text-muted-foreground hover:text-foreground"
                          >
                            <SkipForward className="w-3.5 h-3.5 mr-1.5" /> Skip in this session
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>This does not change persisted review status.</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </div>
              )}
            </div>

            {/* Decision Note Form */}
            {canReview && (activeItem.type === "INSIGHT" || activeItem.type === "UNKNOWN" || activeItem.type === "TRACEABILITY_LINK") ? (
              <DecisionNoteForm
                analysisId={queueData.analysisId}
                insightId={activeItem.type === "INSIGHT" || activeItem.type === "UNKNOWN" ? activeItem.id : undefined}
                traceabilityLinkId={activeItem.type === "TRACEABILITY_LINK" && activeItem.linkedTraceabilityLinkId ? activeItem.linkedTraceabilityLinkId : undefined}
              />
            ) : null}

            {/* Prev / Next navigation */}
            <div className="flex justify-between items-center mt-8 pt-3 border-t border-border-subtle">
              <Button
                variant="ghost"
                size="sm"
                onClick={handlePrev}
                disabled={activeItemIndex === 0}
                className="h-9 px-3 text-sm text-muted-foreground"
              >
                ← Previous
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleNext}
                disabled={activeItemIndex === items.length - 1}
                className="h-9 px-3 text-sm text-muted-foreground"
              >
                Next →
              </Button>
            </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-[13px] text-muted-foreground">
            Select an item from the queue
          </div>
        )}
      </div>
    </div>
  )
}
