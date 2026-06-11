import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { InsightListResponse } from "@ba-helper/contracts"
import { MouseEvent } from "react"

type Insight = InsightListResponse["items"][number]

interface InsightCardProps {
  insight: Insight
  isSelected?: boolean
  onClick?: (insight: Insight) => void
}

function getCertaintyBadge(certainty: Insight["certainty"]) {
  switch (certainty) {
    case "EVIDENCED":
      return <Badge className="badge-confirmed">Evidenced</Badge>
    case "INFERRED":
      return <Badge className="badge-inferred">Inferred</Badge>
    case "UNKNOWN":
      return <Badge className="badge-unknown">Unknown</Badge>
    case "CONFLICTING":
      return <Badge className="badge-conflict">Conflict</Badge>
    default:
      return <Badge className="badge-neutral">{certainty}</Badge>
  }
}

function getReviewBadge(status: Insight["reviewStatus"]) {
  if (status === "CONFIRMED") return <Badge variant="outline" className="text-success border-success/30">Confirmed</Badge>
  if (status === "REJECTED") return <Badge variant="outline" className="text-danger border-danger/30">Rejected</Badge>
  return <Badge variant="outline" className="text-warning border-warning/30">Needs Review</Badge>
}

export function InsightCard({ insight, isSelected, onClick }: InsightCardProps) {
  const handleClick = (e: MouseEvent) => {
    e.preventDefault()
    if (onClick) onClick(insight)
  }

  return (
    <Card 
      className={`p-4 cursor-pointer transition-colors hover:bg-surface-soft ${isSelected ? "border-primary bg-surface-soft" : ""}`}
      onClick={handleClick}
    >
      <div className="flex items-start justify-between gap-4 mb-2">
        <div className="flex items-center gap-2">
          {getCertaintyBadge(insight.certainty)}
          {getReviewBadge(insight.reviewStatus)}
        </div>
        {insight.confidence !== null && (
          <span className="text-xs text-muted-foreground font-mono">
            {Math.round(insight.confidence * 100)}% conf
          </span>
        )}
      </div>
      <p className="text-sm m-0 text-foreground">
        {insight.statement}
      </p>
      {insight.evidence.length > 0 && (
        <div className="mt-3 text-xs text-muted-foreground flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-info inline-block"></span>
          {insight.evidence.length} evidence sources
        </div>
      )}
    </Card>
  )
}
