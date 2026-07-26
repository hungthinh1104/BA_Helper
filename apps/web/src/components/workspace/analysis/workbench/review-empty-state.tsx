import { CheckCircle2, ListFilter } from "lucide-react"
import type { AnalysisWorkspaceLabels } from "@/lib/i18n/analysis-labels"

export function ReviewEmptyState({
  hasItems,
  labels,
}: {
  hasItems: boolean
  labels: AnalysisWorkspaceLabels["reviewQueue"]
}) {
  const Icon = hasItems ? ListFilter : CheckCircle2
  return (
    <div className="flex min-h-56 flex-col items-center justify-center rounded-lg border border-dashed border-border/60 px-6 text-center">
      <Icon className="size-6 text-muted-foreground" aria-hidden="true" />
      <p className="mt-3 text-sm font-medium text-foreground">
        {hasItems ? labels.emptyFilteredTitle : labels.emptyTitle}
      </p>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        {hasItems ? labels.emptyFilteredDescription : labels.emptyDescription}
      </p>
    </div>
  )
}
