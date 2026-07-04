"use client"

import React from "react"
import { useTranslations } from "next-intl"
import { ReviewQueueItem, ReviewQueueResponse } from "@ba-helper/contracts"
import { Badge } from "@/components/ui/badge"
import { SkipForward, LayoutList, AlertCircle } from "lucide-react"
import { ReviewStatusBadge } from "@/components/workspace/shared/status-badges"
import { Button } from "@/components/ui/button"
import { DenseAlert, DenseCard } from "@/components/workspace/shared/dense-card"

export function getPriorityBadgeClass(priority: string) {
  switch (priority) {
    case "HIGH":   return "bg-danger/10 text-danger border-danger/30"
    case "MEDIUM": return "bg-warning/10 text-warning border-warning/30"
    default:       return "bg-surface-muted text-muted-foreground border-border/50"
  }
}

// Extract QueueListItem to prevent full re-renders of the queue sidebar
const QueueListItem = React.memo(({ 
  item, 
  isActive, 
  isCompleted, 
  isSkipped, 
  onSelect 
}: { 
  item: ReviewQueueItem
  isActive: boolean
  isCompleted: boolean
  isSkipped: boolean
  onSelect: () => void 
}) => {
  return (
    <button
      onClick={onSelect}
      className={`
        w-full text-left px-3 py-2 border-b border-border last:border-0 transition-colors
        ${isActive ? "bg-surface-soft" : "hover:bg-surface-muted/60"}
        ${isCompleted ? "opacity-50" : ""}
      `}
    >
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-1">
            <Badge variant="outline" className={`${getPriorityBadgeClass(item.priority)} h-[18px] px-1.5 text-[10px]`}>
              {item.priority}
            </Badge>
            {isSkipped && <SkipForward className="w-3 h-3 text-muted-foreground" />}
          </div>
          <p className={`text-[13px] leading-snug line-clamp-2 ${isActive ? "text-foreground font-medium" : "text-foreground/80"}`}>
            {item.title}
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <span className="text-[11px] text-muted-foreground capitalize">{item.type.replace(/_/g, " ").toLowerCase()}</span>
            <ReviewStatusBadge status={item.reviewStatus ?? "NEEDS_REVIEW"} />
          </div>
        </div>
      </div>
    </button>
  )
})
QueueListItem.displayName = "QueueListItem"

interface ReviewQueueSidebarProps {
  items: ReviewQueueItem[]
  pagedItems: ReviewQueueItem[]
  summary: ReviewQueueResponse["summary"]
  activeItemIndex: number
  pageStart: number
  pageEnd: number
  currentPage: number
  totalPages: number
  REVIEW_QUEUE_PAGE_SIZE: number
  skippedLocal: Set<string>
  setPage: (page: number) => void
  onSelect: (idx: number) => void
}

export function ReviewQueueSidebar({
  items,
  pagedItems,
  summary,
  activeItemIndex,
  pageStart,
  pageEnd,
  currentPage,
  totalPages,
  REVIEW_QUEUE_PAGE_SIZE,
  skippedLocal,
  setPage,
  onSelect
}: ReviewQueueSidebarProps) {
  const t = useTranslations("workspace")
  const totalActiveItems = summary.totalActiveItems ?? summary.total
  const decisionRequiredRemaining = summary.decisionRequiredRemaining ?? summary.remaining
  const diagnosticRemaining = summary.diagnosticRemaining ?? Math.max(totalActiveItems - decisionRequiredRemaining, 0)
  const percentComplete = totalActiveItems > 0 ? ((totalActiveItems - decisionRequiredRemaining - diagnosticRemaining) / totalActiveItems) * 100 : 100

  return (
    <DenseCard
      role="complementary"
      aria-label={t("reviewQueue")}
      variant="muted"
      className="w-full shrink-0 rounded-none border-x-0 border-t-0 lg:w-[360px] max-lg:h-[40vh] lg:border-b-0 lg:border-r"
    >
      {/* Header */}
      <div className="px-3 py-3 border-b border-border">
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 mb-3">
          <LayoutList className="w-3.5 h-3.5" /> {t("reviewQueue")}
        </h2>

        {/* Progress bar */}
        <div className="space-y-1">
          <div className="flex justify-between text-[11px] text-muted-foreground">
            <span>{t("resolvedCount", { resolved: totalActiveItems - decisionRequiredRemaining - diagnosticRemaining, total: totalActiveItems })}</span>
            <span className="font-medium text-foreground">{t("decisionsLeft", { count: decisionRequiredRemaining })}</span>
          </div>
          <div className="bg-border h-1 w-full rounded-full overflow-hidden">
            <div
              className="bg-primary h-full"
              style={{ width: `${percentComplete}%` }}
            />
          </div>
        </div>

        {diagnosticRemaining > 0 && (
          <div className="mt-2 text-[10px] text-muted-foreground">
            {t("diagnosticOnlyItems", { count: diagnosticRemaining })}
          </div>
        )}

        {summary.highRiskRemaining > 0 && (
          <DenseAlert variant="danger" className="mt-2.5 items-center gap-1.5 px-2 py-1.5 text-[11px]">
            <AlertCircle className="w-3 h-3 shrink-0" />
            <span>{t("highRiskUnresolved", { count: summary.highRiskRemaining })}</span>
          </DenseAlert>
        )}

        {skippedLocal.size > 0 && (
          <p className="text-[10px] text-muted-foreground mt-2">
            {t("skippedThisSession", { count: skippedLocal.size })}
          </p>
        )}
      </div>

      {/* Queue items */}
      <div className="flex-1 overflow-y-auto">
        {pagedItems.map((item, idx) => {
          const absoluteIndex = pageStart + idx
          const isActive    = absoluteIndex === activeItemIndex
          const isCompleted = item.reviewStatus === "CONFIRMED" || item.reviewStatus === "REJECTED"
          const isSkipped   = skippedLocal.has(item.id)

          return (
            <QueueListItem
              key={item.id}
              item={item}
              isActive={isActive}
              isCompleted={isCompleted}
              isSkipped={isSkipped}
              onSelect={() => onSelect(absoluteIndex)}
            />
          )
        })}
      </div>

      {items.length > REVIEW_QUEUE_PAGE_SIZE && (
        <div className="flex items-center justify-between border-t border-border px-3 py-2 text-xs text-muted-foreground">
          <span>
            {t("showingRange", { start: pageStart + 1, end: pageEnd, total: items.length })}
          </span>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              className="h-8 px-2 text-xs"
              onClick={() => setPage(currentPage - 1)}
              disabled={currentPage <= 1}
            >
              {t("prev")}
            </Button>
            <span>{currentPage}/{totalPages}</span>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 px-2 text-xs"
              onClick={() => setPage(currentPage + 1)}
              disabled={currentPage >= totalPages}
            >
              {t("next")}
            </Button>
          </div>
        </div>
      )}
    </DenseCard>
  )
}
