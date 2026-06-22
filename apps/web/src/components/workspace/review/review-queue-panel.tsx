"use client"

import { useMemo, useState } from "react"
import { ReviewQueueItem, ReviewQueueResponse } from "@ba-helper/contracts"
import { AlertCircle, CheckCircle } from "lucide-react"
import { useReviewInsight, useReviewTraceabilityLink } from "@/hooks/api/use-analyses"
import { ReviewQueueSidebar } from "./review-queue-sidebar"
import { ReviewQueueDetail } from "./review-queue-detail"

interface ReviewQueuePanelProps {
  queueData: ReviewQueueResponse
  onSelect: (type: "INSIGHT" | "TRACEABILITY_LINK" | "GRAPH_NODE", id: string, artifactId?: string) => void
  selectedQueueItemId?: string | null
  canReview: boolean
  canViewReviewQueue: boolean
}

const REVIEW_QUEUE_PAGE_SIZE = 50

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

  const activeItem = items[activeItemIndex] || null
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

  if (!canViewReviewQueue) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8 w-full">
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
      <div className="flex flex-col items-center justify-center h-full text-center p-8 w-full">
        <div className="w-12 h-12 rounded-full bg-success/10 flex items-center justify-center mb-3">
          <CheckCircle className="w-6 h-6 text-success" />
        </div>
        <p className="text-[13px] font-medium text-foreground mb-1">Queue is clear</p>
        <p className="text-[12px] text-muted-foreground">No items require your review. You can finalize the analysis.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col lg:flex-row h-full w-full min-h-0 bg-background">
      <ReviewQueueSidebar
        items={items}
        pagedItems={pagedItems}
        summary={summary}
        activeItemIndex={activeItemIndex}
        pageStart={pageStart}
        pageEnd={pageEnd}
        currentPage={currentPage}
        totalPages={totalPages}
        REVIEW_QUEUE_PAGE_SIZE={REVIEW_QUEUE_PAGE_SIZE}
        skippedLocal={skippedLocal}
        setPage={setPage}
        onSelect={handleSelect}
      />

      <ReviewQueueDetail
        activeItem={activeItem}
        activeItemIndex={activeItemIndex}
        totalItems={items.length}
        canReview={canReview}
        isMutating={isMutating}
        analysisId={queueData.analysisId}
        onPrev={handlePrev}
        onNext={handleNext}
        onSkip={handleSkip}
        onConfirm={handleConfirm}
        onReject={handleReject}
      />
    </div>
  )
}
