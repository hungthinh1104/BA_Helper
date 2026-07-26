import { MatrixRowInsightRef } from "@ba-helper/contracts"
import { useTranslations } from "next-intl"
import { CertaintyBadge } from "@/components/workspace/shared/status-badges"

interface MatrixInsightListProps {
  insights: MatrixRowInsightRef[]
  emptyMessage: string
  type: "risk" | "qa"
}

export function MatrixInsightList({ insights, emptyMessage, type }: MatrixInsightListProps) {
  const t = useTranslations("workspace")
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
            <div className="flex items-center gap-1.5">
              {insight.relatedEvidenceIds.length === 0 && (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border bg-warning/10 text-warning border-warning/30">
                  {t("diagnosticOnly")}
                </span>
              )}
              {insight.certainty && (
                <CertaintyBadge certainty={insight.certainty} />
              )}
            </div>
          </div>
          {insight.description && (
            <p className="text-[13px] text-muted-foreground leading-relaxed mb-3">
              {insight.description}
            </p>
          )}
          <div className="text-[11px] text-muted-foreground">
            {insight.relatedEvidenceIds.length > 0
              ? t("evidenceReferences", { count: insight.relatedEvidenceIds.length })
              : t("noCodeEvidenceLinkedMatrix")}
          </div>
        </div>
      ))}
    </div>
  )
}
