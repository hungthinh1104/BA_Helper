"use client"

import { Button } from "@/components/ui/button"
import { Check, X, Loader2 } from "lucide-react"
import { useReviewInsight, useReviewTraceabilityLink } from "@/hooks/api/use-analyses"
import { toast } from "sonner"
import { useTranslations } from "next-intl"

interface InlineReviewActionProps {
  analysisId: string
  itemId?: string
  itemType: "insight" | "impact"
  itemTitle?: string
  currentStatus: string | null | undefined
  disabled?: boolean
  isStale?: boolean
}

export function InlineReviewAction({
  analysisId,
  itemId,
  itemType,
  itemTitle,
  currentStatus,
  disabled,
  isStale,
}: InlineReviewActionProps) {
  const t = useTranslations("workspace")
  const reviewInsight = useReviewInsight(undefined, analysisId)
  const reviewLink = useReviewTraceabilityLink(undefined, analysisId)

  if (!itemId) {
    return null
  }

  const isPending = reviewInsight.isPending || reviewLink.isPending
  const isActionDisabled = disabled || isStale || isPending

  const handleReview = async (status: "CONFIRMED" | "REJECTED") => {
    try {
      if (itemType === "impact") {
        await reviewLink.mutateAsync({
          traceabilityLinkId: itemId,
          data: { reviewStatus: status },
        })
      } else {
        await reviewInsight.mutateAsync({
          insightId: itemId,
          data: { reviewStatus: status },
        })
      }
      toast.success(status === "CONFIRMED" ? t("confirmed") : t("rejected"))
    } catch (error) {
      const msg = error instanceof Error ? error.message : t("reviewFailed")
      toast.error(msg)
    }
  }

  if (currentStatus === "CONFIRMED" || currentStatus === "ACCEPTED") {
    return <span className="text-[10px] font-medium text-success uppercase tracking-wider px-2 py-1 bg-success/10 rounded border border-success/20">{t("confirmed")}</span>
  }
  
  if (currentStatus === "REJECTED") {
    return <span className="text-[10px] font-medium text-destructive uppercase tracking-wider px-2 py-1 bg-destructive/10 rounded border border-destructive/20">{t("rejected")}</span>
  }

  const ariaLabel = itemTitle ? t("reviewActionsForTitle", { itemType, title: itemTitle }) : t("reviewActionsFor", { itemType })

  return (
    <div className="flex items-center gap-1.5 shrink-0" aria-label={ariaLabel}>
      <Button
        size="icon"
        variant="outline"
        className="h-7 w-7 rounded-md border-border/60 hover:bg-success hover:text-success-foreground hover:border-success transition-colors"
        disabled={isActionDisabled}
        onClick={(e) => {
          e.preventDefault()
          handleReview("CONFIRMED")
        }}
        title={isStale ? t("analysisIsStale") : t("approve")}
      >
        {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
      </Button>
      <Button
        size="icon"
        variant="outline"
        className="h-7 w-7 rounded-md border-border/60 hover:bg-destructive hover:text-destructive-foreground hover:border-destructive transition-colors"
        disabled={isActionDisabled}
        onClick={(e) => {
          e.preventDefault()
          handleReview("REJECTED")
        }}
        title={isStale ? t("analysisIsStale") : t("reject")}
      >
        {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
      </Button>
    </div>
  )
}
