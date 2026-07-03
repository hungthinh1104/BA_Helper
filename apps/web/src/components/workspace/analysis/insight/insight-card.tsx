import { InsightListResponse } from "@ba-helper/contracts"
import { useTranslations } from "next-intl"
import { GitCommitHorizontal } from "lucide-react"
import { ReviewStatusBadge, CertaintyBadge } from "@/components/workspace/shared/status-badges"

type Insight = InsightListResponse["items"][number]

interface InsightCardProps {
  insight: Insight
  isSelected?: boolean
  onClick?: (insight: Insight) => void
}

function getCategoryLabel(category: Insight["category"], t: ReturnType<typeof useTranslations<"workspace">>) {
  switch (category) {
    case "CLAIM":
      return t("claim")
    case "UNKNOWN":
      return t("unknown")
    case "QUESTION":
      return t("question")
    case "QA_SCENARIO":
      return t("qa")
    case "ACCEPTANCE_CRITERIA":
      return t("acceptanceCriteriaShort")
    default:
      return category
  }
}

function formatImpactPath(filePath?: string | null) {
  if (!filePath) return null
  const parts = filePath.split('/')
  if (parts.length <= 1) return filePath
  const file = parts.pop()
  const dir = parts.pop()
  return (
    <div className="mt-1.5 flex items-center gap-1 text-xs font-mono text-muted-foreground">
      <GitCommitHorizontal className="w-3 h-3 opacity-50" />
      <span>{dir}</span>
      <span className="opacity-50">/</span>
      <span className="text-foreground/70">{file}</span>
    </div>
  )
}

export function InsightCard({ insight, isSelected, onClick }: InsightCardProps) {
  const t = useTranslations("workspace")
  const primaryEvidence = insight.evidence[0]
  const evidenceCount = insight.evidence.length

  return (
    <button
      type="button"
      className={`relative group flex w-full items-start gap-3 border-b border-border/50 px-3 py-3 text-left transition-colors last:border-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 ${
        isSelected ? "bg-primary/8" : "hover:bg-surface-muted/50"
      }`}
      onClick={() => onClick?.(insight)}
    >
      {/* Accent Line for selected */}
      {isSelected && (
        <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-primary rounded-r-full"></div>
      )}

      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <ReviewStatusBadge status={insight.reviewStatus} />
          <CertaintyBadge certainty={insight.certainty} />
          <span className="rounded-md border border-border/60 bg-surface px-2 py-0.5 text-xs font-medium text-muted-foreground">
            {getCategoryLabel(insight.category, t)}
          </span>
          <span className="text-xs text-muted-foreground">
            {t("evidenceCount", { count: evidenceCount })}
          </span>
        </div>

        <div className="mt-2 flex items-start justify-between gap-4">
          <p className={`m-0 pr-4 text-sm leading-6 ${isSelected ? "font-medium text-foreground" : "text-foreground/90"}`}>
            {insight.statement}
          </p>
        </div>

        {/* Mini Impact Path */}
        {primaryEvidence && formatImpactPath(primaryEvidence.filePath)}
      </div>
    </button>
  )
}
