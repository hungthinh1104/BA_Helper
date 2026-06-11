import { Badge } from "@/components/ui/badge"
import { MatrixRowInsightRef } from "@ba-helper/contracts"

interface MatrixInsightListProps {
  insights: MatrixRowInsightRef[]
  emptyMessage: string
  type: "risk" | "qa"
}

const CERTAINTY_COLORS: Record<string, string> = {
  EVIDENCED: "bg-success/10 text-success border-success/20",
  INFERRED: "bg-warning/10 text-warning border-warning/20",
  UNKNOWN: "bg-destructive/10 text-destructive border-destructive/20",
  CONFLICTING: "bg-destructive/10 text-destructive border-destructive/20",
}

export function MatrixInsightList({ insights, emptyMessage, type }: MatrixInsightListProps) {
  if (insights.length === 0) {
    return (
      <div className="text-center py-10 text-muted-foreground text-sm">
        {emptyMessage}
      </div>
    )
  }

  const borderClass = type === "risk" ? "border-destructive/20 bg-destructive/5" : "border-success/20 bg-success/5"

  return (
    <div className="space-y-3">
      {insights.map((insight) => (
        <div key={insight.insightId} className={`rounded border p-4 ${borderClass}`}>
          <div className="flex items-start justify-between gap-2 mb-2">
            <h4 className="text-[13px] font-medium text-foreground">{insight.title}</h4>
            {insight.certainty && (
              <Badge variant="outline" className={`text-[10px] uppercase ${CERTAINTY_COLORS[insight.certainty] || ""}`}>
                {insight.certainty}
              </Badge>
            )}
          </div>
          {insight.description && (
            <p className="text-[13px] text-muted-foreground leading-relaxed mb-3">
              {insight.description}
            </p>
          )}
          <div className="text-[11px] text-muted-foreground">
            {insight.relatedEvidenceIds.length} evidence references
          </div>
        </div>
      ))}
    </div>
  )
}
