import { InsightListResponse } from "@ba-helper/contracts"
import { InsightCard } from "./insight-card"

type Insight = InsightListResponse["items"][number]

interface InsightListProps {
  insights: Insight[]
  title?: string
  emptyMessage?: string
  selectedInsightId?: string
  onSelect?: (insight: Insight) => void
}

export function InsightList({ insights, title, emptyMessage = "No items found", selectedInsightId, onSelect }: InsightListProps) {
  return (
    <div className="flex flex-col gap-3">
      {title && <h3 className="text-sm font-semibold mb-2">{title}</h3>}
      {insights.length === 0 ? (
        <div className="text-sm text-muted-foreground italic p-4 border border-dashed rounded-lg text-center">
          {emptyMessage}
        </div>
      ) : (
        insights.map(insight => (
          <InsightCard 
            key={insight.id} 
            insight={insight} 
            isSelected={insight.id === selectedInsightId}
            onClick={onSelect}
          />
        ))
      )}
    </div>
  )
}
