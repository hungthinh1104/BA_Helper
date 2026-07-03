"use client"

import { ReviewQueueItem } from "@ba-helper/contracts"
import { useTranslations } from "next-intl"
import { CheckCircle, XCircle, SkipForward, AlertCircle, Activity } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { DecisionNoteForm } from "@/components/workspace/review/decision-note-form"
import { getPriorityBadgeClass } from "./review-queue-sidebar"

interface ReviewQueueDetailProps {
  activeItem: ReviewQueueItem | null
  activeItemIndex: number
  totalItems: number
  canReview: boolean
  isMutating: boolean
  analysisId: string
  onPrev: () => void
  onNext: () => void
  onSkip: () => void
  onConfirm: () => void
  onReject: () => void
}

export function ReviewQueueDetail({
  activeItem,
  activeItemIndex,
  totalItems,
  canReview,
  isMutating,
  analysisId,
  onPrev,
  onNext,
  onSkip,
  onConfirm,
  onReject,
}: ReviewQueueDetailProps) {
  const t = useTranslations("workspace")

  if (!activeItem) {
    return (
      <main className="flex min-w-0 flex-1 flex-col bg-surface overflow-hidden relative">
        <div className="flex items-center justify-center h-full text-[13px] text-muted-foreground">
          {t("selectQueueItem")}
        </div>
      </main>
    )
  }

  return (
    <main className="flex min-w-0 flex-1 flex-col bg-surface overflow-hidden relative">
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
            <span className="text-[11px] text-muted-foreground">{t("itemPosition", { current: activeItemIndex + 1, total: totalItems })}</span>
          </div>

          {/* Title */}
          <h1 className="text-[16px] font-bold tracking-tight text-foreground mb-4 leading-snug">{activeItem.title}</h1>

          {/* Why it matters */}
          <div className="mb-5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">{t("whyItMatters")}</p>
            <div className="border-l-2 border-border pl-3 text-[13px] text-foreground/90 leading-relaxed">
              {activeItem.reason}
              {activeItem.priorityReason && (
                <p className="text-[11px] text-danger/80 mt-2 flex items-center gap-1.5">
                  <Activity className="w-3 h-3" /> {activeItem.priorityReason}
                </p>
              )}
            </div>
          </div>

          {/* Suggested action */}
          {activeItem.suggestedAction && (
            <div className="mb-6">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-info mb-2">{t("suggestedAction")}</p>
              <div className="border-l-2 border-info/50 pl-3 text-[13px] text-foreground/90">
                {activeItem.suggestedAction}
              </div>
            </div>
          )}

          {/* Decision Note Form */}
          {canReview && (activeItem.type === "INSIGHT" || activeItem.type === "UNKNOWN" || activeItem.type === "TRACEABILITY_LINK") ? (
            <div className="mt-6 pt-5 border-t border-border pb-20">
              <DecisionNoteForm
                analysisId={analysisId}
                insightId={activeItem.type === "INSIGHT" || activeItem.type === "UNKNOWN" ? activeItem.id : undefined}
                traceabilityLinkId={activeItem.type === "TRACEABILITY_LINK" && activeItem.linkedTraceabilityLinkId ? activeItem.linkedTraceabilityLinkId : undefined}
              />
            </div>
          ) : <div className="pb-20" />}
        </div>
      </div>

      {/* Sticky Bottom Action Bar */}
      <div className="absolute bottom-0 left-0 right-0 z-10 flex flex-col items-center justify-between gap-3 border-t border-border bg-background px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] shadow-sm sm:flex-row sm:gap-0 lg:px-6">
        <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-start">
          <Button
            variant="outline"
            size="sm"
            onClick={onPrev}
            disabled={activeItemIndex === 0}
            className="h-8 shadow-none text-xs flex-1 sm:flex-none"
          >
            ← {t("prev")}
          </Button>
          <span className="text-[11px] text-muted-foreground sm:hidden">{t("itemPosition", { current: activeItemIndex + 1, total: totalItems })}</span>
          <Button
            variant="outline"
            size="sm"
            onClick={onNext}
            disabled={activeItemIndex === totalItems - 1}
            className="h-8 shadow-none text-xs flex-1 sm:flex-none"
          >
            {t("next")} →
          </Button>
        </div>
        
        <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto justify-between sm:justify-end">
          <span className="text-[11px] text-muted-foreground mr-2 hidden sm:inline">{t("itemPosition", { current: activeItemIndex + 1, total: totalItems })}</span>
          
          {activeItem.reviewStatus === "CONFIRMED" || activeItem.reviewStatus === "REJECTED" ? (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-success/30 bg-success-soft text-success text-[12px] font-medium">
              <CheckCircle className="w-3.5 h-3.5" />
              {activeItem.reviewStatus === "CONFIRMED" ? t("confirmed") : t("rejected")}
            </div>
          ) : !activeItem.requiresDecision ? (
            <span className="text-[12px] font-medium text-muted-foreground flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5" /> {t("noDecisionRequired")}
            </span>
          ) : !canReview ? (
            <span className="text-[12px] font-medium text-warning">{t("readOnlyReview")}</span>
          ) : (
            <div className="flex items-center gap-2">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                      onClick={onSkip}
                      size="sm"
                      variant="ghost"
                      className="h-8 text-xs text-muted-foreground hover:text-foreground"
                      />
                    }
                  >
                    <SkipForward className="mr-1.5 size-3.5" /> {t("skip")}
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{t("skipHint")}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <Button
                onClick={onReject}
                disabled={isMutating}
                size="sm"
                variant="outline"
                className="h-8 text-xs text-danger border-danger/30 hover:bg-danger-soft hover:border-danger/50"
              >
                <XCircle className="w-3.5 h-3.5 mr-1.5" /> {t("reject")}
              </Button>

              <Button
                onClick={onConfirm}
                disabled={isMutating}
                size="sm"
                className="h-8 text-xs bg-primary-action text-primary-action-text hover:opacity-90"
              >
                <CheckCircle className="w-3.5 h-3.5 mr-1.5" /> {t("confirm")}
              </Button>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
