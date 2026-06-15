import { Badge } from "@/components/ui/badge"
import { InsightListResponse } from "@ba-helper/contracts"
import { MouseEvent } from "react"
import { GitCommitHorizontal } from "lucide-react"

type Insight = InsightListResponse["items"][number]

interface InsightCardProps {
  insight: Insight
  isSelected?: boolean
  onClick?: (insight: Insight) => void
}

import { CertaintyBadge } from "@/components/workspace/shared/status-badges"
function getReviewIcon(status: Insight["reviewStatus"]) {
  if (status === "CONFIRMED") return <div className="w-3.5 h-3.5 rounded-full border-2 border-success flex items-center justify-center bg-success/10"><span className="w-1.5 h-1.5 bg-success rounded-full"></span></div>
  if (status === "REJECTED") return <div className="w-3.5 h-3.5 rounded-full border-2 border-danger flex items-center justify-center bg-danger/10"><span className="w-1.5 h-1.5 bg-danger rounded-full"></span></div>
  return <div className="w-3.5 h-3.5 rounded-full border-2 border-warning border-dashed"></div>
}

function formatImpactPath(filePath?: string | null) {
  if (!filePath) return null
  const parts = filePath.split('/')
  if (parts.length <= 1) return filePath
  const file = parts.pop()
  const dir = parts.pop()
  return (
    <div className="flex items-center gap-1 text-[11px] font-mono text-muted-foreground mt-1.5">
      <GitCommitHorizontal className="w-3 h-3 opacity-50" />
      <span>{dir}</span>
      <span className="opacity-50">/</span>
      <span className="text-foreground/70">{file}</span>
    </div>
  )
}

export function InsightCard({ insight, isSelected, onClick }: InsightCardProps) {
  const handleClick = (e: MouseEvent) => {
    e.preventDefault()
    if (onClick) onClick(insight)
  }

  const primaryEvidence = insight.evidence[0]

  return (
    <div 
      className={`relative group flex items-start gap-3 py-2.5 px-3 cursor-pointer transition-colors border-b border-border/50 last:border-0 ${
        isSelected ? "bg-surface-soft" : "hover:bg-surface-muted/50"
      }`}
      onClick={handleClick}
    >
      {/* Accent Line for selected */}
      {isSelected && (
        <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-primary rounded-r-full"></div>
      )}

      {/* Review Status Icon */}
      <div className="mt-1 shrink-0">
        {getReviewIcon(insight.reviewStatus)}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-4">
          <p className={`text-[13px] leading-snug m-0 pr-4 ${isSelected ? "text-foreground font-medium" : "text-foreground/90"}`}>
            {insight.statement}
          </p>
          <div className="shrink-0 flex items-center gap-1.5 opacity-80 group-hover:opacity-100 transition-opacity">
            <CertaintyBadge certainty={insight.certainty} />
          </div>
        </div>

        {/* Mini Impact Path */}
        {primaryEvidence && formatImpactPath(primaryEvidence.filePath)}
      </div>
    </div>
  )
}

