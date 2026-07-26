"use client"

import { Check, X, RotateCcw } from "lucide-react"
import { useTranslations } from "next-intl"

interface ReviewActionPanelProps {
  status: "NEEDS_REVIEW" | "CONFIRMED" | "REJECTED"
  canReview: boolean
  onStatusChange: (status: "NEEDS_REVIEW" | "CONFIRMED" | "REJECTED") => void
}

export function ReviewActionPanel({ status, canReview, onStatusChange }: ReviewActionPanelProps) {
  const t = useTranslations("workspace")

  if (status === "NEEDS_REVIEW") {
    return (
      <div className="px-5 py-4 bg-surface-muted/30">
        <p className="text-[11px] text-muted-foreground mb-3 font-medium uppercase tracking-wider">
          {t("impactAccurateQuestion")}
        </p>
        {canReview ? (
          <div className="flex gap-2">
            <button
              onClick={() => onStatusChange("CONFIRMED")}
              className="flex-1 flex items-center justify-center gap-2 h-10 rounded-lg bg-success/10 hover:bg-success/20 text-success text-[13px] font-semibold border border-success/25 transition-all hover:border-success/40 active:scale-[0.97]"
            >
              <Check className="w-3.5 h-3.5" />
              {t("confirm")}
            </button>
            <button
              onClick={() => onStatusChange("REJECTED")}
              className="flex-1 flex items-center justify-center gap-2 h-10 rounded-lg bg-danger/10 hover:bg-danger/20 text-danger text-[13px] font-semibold border border-danger/25 transition-all hover:border-danger/40 active:scale-[0.97]"
            >
              <X className="w-3.5 h-3.5" />
              {t("reject")}
            </button>
          </div>
        ) : (
          <p className="text-[12px] text-muted-foreground">
            {t("reviewerRequiredSubmitDecision")}
          </p>
        )}
      </div>
    )
  }

  const isConfirmed = status === "CONFIRMED"

  return (
    <div className="px-5 py-4 bg-surface-muted/30 flex items-center justify-between gap-3">
      <div className={`flex items-center gap-2.5 text-[13px] font-semibold ${isConfirmed ? "text-success" : "text-danger"}`}>
        <span className={`w-6 h-6 rounded-full flex items-center justify-center ${isConfirmed ? "bg-success/15" : "bg-danger/15"}`}>
          {isConfirmed
            ? <Check className="w-3.5 h-3.5" />
            : <X className="w-3.5 h-3.5" />
          }
        </span>
        <span>{isConfirmed ? t("impactConfirmed") : t("impactRejected")}</span>
      </div>
      {canReview ? (
        <button
          onClick={() => onStatusChange("NEEDS_REVIEW")}
          className="flex items-center gap-1.5 text-[12px] text-muted-foreground hover:text-foreground transition-colors"
        >
          <RotateCcw className="w-3 h-3" />
          {t("undo")}
        </button>
      ) : (
        <span className="text-[12px] text-muted-foreground">
          {t("reviewerRequiredChangeDecision")}
        </span>
      )}
    </div>
  )
}
