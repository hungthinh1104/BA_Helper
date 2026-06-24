"use client"

import { useAnalysisDiff } from "@/hooks/api/use-analyses"
import { useReviewDecisions } from "@/hooks/api/use-review-decisions"
import { ImpactAnalysisDetailResponse } from "@ba-helper/contracts"
import { Loader2, AlertCircle, RefreshCw } from "lucide-react"
import { DiffSummaryCards } from "./diff/diff-summary-cards"
import { DiffImpactLists } from "./diff/diff-impact-lists"
import { ReviewHistoryList } from "./diff/review-history-list"
import { ReviewDecisionForm } from "./diff/review-decision-form"
import { useRouter } from "next/navigation"

interface AnalysisDiffTabProps {
  analysisId: string
  analysis: ImpactAnalysisDetailResponse
}

export function AnalysisDiffTab({ analysisId, analysis }: AnalysisDiffTabProps) {
  const router = useRouter()
  const { data: diff, isLoading: diffLoading, error: diffError, refetch } = useAnalysisDiff(analysisId)
  const { data: decisions, isLoading: decisionsLoading } = useReviewDecisions(analysisId)

  if (diffLoading || decisionsLoading) {
    return (
      <div className="py-20 flex flex-col items-center justify-center gap-3 text-muted-foreground">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
        <span className="text-sm">Analyzing impact changes...</span>
      </div>
    )
  }

  if (diffError || !diff) {
    return (
      <div className="py-20 flex flex-col items-center justify-center gap-3">
        <div className="w-12 h-12 rounded-full bg-danger/10 flex items-center justify-center">
          <AlertCircle className="w-6 h-6 text-danger" />
        </div>
        <p className="text-sm font-medium text-foreground">Failed to load diff analysis</p>
        <p className="text-xs text-muted-foreground mb-2">{(diffError as Error)?.message || "An unexpected error occurred"}</p>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-2 text-xs font-medium bg-surface border border-border/60 hover:bg-surface-soft px-3 py-1.5 rounded-lg transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Try Again
        </button>
      </div>
    )
  }

  const handleGoToBaseline = (baseAnalysisId: string) => {
    router.push(`/analyses/${baseAnalysisId}`)
  }

  return (
    <div className="flex flex-col gap-6 max-w-4xl mx-auto w-full pb-12 animate-in fade-in slide-in-from-bottom-2 duration-500">
      {(diff.diagnostics?.length ?? 0) > 0 && (
        <div className="flex flex-col gap-2 p-3 rounded-xl border border-warning/30 bg-warning/5">
          {diff.diagnostics?.map((diag, i) => (
            <div key={i} className="flex items-start gap-2 text-xs text-warning-foreground">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <p>{diag.message}</p>
            </div>
          ))}
        </div>
      )}

      <DiffSummaryCards diff={diff} onGoToBaseline={handleGoToBaseline} />

      <DiffImpactLists diff={diff} />

      {decisions && <ReviewHistoryList decisions={decisions.items} />}

      <ReviewDecisionForm analysisId={analysisId} analysis={analysis} />
    </div>
  )
}
