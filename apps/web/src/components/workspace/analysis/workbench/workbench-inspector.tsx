import { Button } from "@/components/ui/button"
import type { AnalysisWorkspaceLabels } from "@/lib/i18n/analysis-labels"
import type { ReviewDisplay, ReviewWorkbenchItem } from "./analysis-workbench-types"

export function WorkbenchInspector({ item, display, labels, onDisplayChange }: { item: ReviewWorkbenchItem | null; display: ReviewDisplay; labels: AnalysisWorkspaceLabels["reviewWorkbench"]; onDisplayChange: (display: ReviewDisplay) => void }) {
  return (
    <aside className="rounded-lg border border-border/50 bg-surface p-4">
      <div className="flex gap-2" aria-label={labels.reviewDetail}>
        <Button type="button" size="sm" variant={display === "evidence" ? "secondary" : "outline"} aria-pressed={display === "evidence"} onClick={() => onDisplayChange("evidence")}>{labels.evidence}</Button>
        <Button type="button" size="sm" variant={display === "dependency-path" ? "secondary" : "outline"} aria-pressed={display === "dependency-path"} onClick={() => onDisplayChange("dependency-path")}>{labels.dependencyPath}</Button>
      </div>
      <div className="mt-5">
        <h2 className="text-sm font-semibold text-foreground">{labels.reviewDetail}</h2>
        {item ? <><p className="mt-2 text-sm text-foreground">{item.title}</p><p className="mt-1 text-xs text-muted-foreground">{item.itemType} · {item.evidenceCount} {labels.evidence}</p></> : <p className="mt-2 text-sm text-muted-foreground">{labels.noSelection}</p>}
      </div>
    </aside>
  )
}
