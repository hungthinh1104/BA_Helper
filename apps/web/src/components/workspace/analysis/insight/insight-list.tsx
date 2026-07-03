import { InsightListResponse } from "@ba-helper/contracts"
import { useTranslations } from "next-intl"
import { InsightCard } from "@/components/workspace/analysis/insight/insight-card"

type Insight = InsightListResponse["items"][number]

interface InsightListProps {
  insights: Insight[]
  title?: string
  emptyMessage?: string
  selectedInsightId?: string
  onSelect?: (insight: Insight) => void
}

export function InsightList({ insights, title, emptyMessage, selectedInsightId, onSelect }: InsightListProps) {
  const t = useTranslations("workspace")
  return (
    <div className="flex flex-col">
      {title && <h3 className="text-sm font-semibold mb-3 px-1">{title}</h3>}
      {insights.length === 0 ? (
        <div className="text-sm text-muted-foreground italic p-4 border border-dashed rounded-lg text-center">
          {emptyMessage ?? t("noItemsFound")}
        </div>
      ) : (
        <div className="flex flex-col border border-border/60 rounded-lg overflow-hidden bg-surface">
          {insights.map(insight => (
            <InsightCard 
              key={insight.id} 
              insight={insight} 
              isSelected={insight.id === selectedInsightId}
              onClick={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  )
}
