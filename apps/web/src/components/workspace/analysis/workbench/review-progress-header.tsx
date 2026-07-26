import { AlertTriangle, CheckCircle2 } from "lucide-react"
import type { AnalysisWorkspaceLabels } from "@/lib/i18n/analysis-labels"

export function ReviewProgressHeader({
  pending,
  blocking,
  labels,
}: {
  pending: number
  blocking: number
  labels: AnalysisWorkspaceLabels["reviewQueue"]
}) {
  const isClear = pending === 0
  const Icon = isClear ? CheckCircle2 : AlertTriangle

  return (
    <header className="flex items-start justify-between gap-3 border-b border-border/40 px-4 py-3">
      <div>
        <h2 className="text-sm font-semibold text-foreground">{labels.title}</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {labels.pendingCount.replace("{count}", String(pending))}
        </p>
      </div>
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Icon className={isClear ? "size-4 text-success" : "size-4 text-warning"} aria-hidden="true" />
        {blocking > 0
          ? labels.blockingCount.replace("{count}", String(blocking))
          : labels.noBlockingItems}
      </div>
    </header>
  )
}
