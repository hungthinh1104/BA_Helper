"use client"

import { useMemo } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { cn } from "@/lib/utils"
import type { AnalysisWorkspaceLabels } from "@/lib/i18n/analysis-labels"
import type { AnalysisWorkspaceMode } from "./analysis-workbench-types"
import { readAnalysisWorkbenchUrlState, writeAnalysisWorkbenchUrlState } from "./analysis-workbench-url-state"

const modes: AnalysisWorkspaceMode[] = ["summary", "review", "risks-qa", "history"]

export function AnalysisWorkspaceNavigation({
  defaultMode,
  labels,
}: {
  defaultMode: AnalysisWorkspaceMode
  labels: AnalysisWorkspaceLabels["tabs"]
}) {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const current = useMemo(() => readAnalysisWorkbenchUrlState(searchParams ?? new URLSearchParams()), [searchParams])
  const activeMode = current.view ?? defaultMode
  const modeLabels: Record<AnalysisWorkspaceMode, string> = {
    summary: labels.summary,
    review: labels.review,
    "risks-qa": labels.risksQa,
    history: labels.history,
  }

  return (
    <nav aria-label={labels.navigationLabel} className="flex gap-6 overflow-x-auto border-b border-border/40 pb-px custom-scrollbar">
      {modes.map((mode) => (
        <button
          key={mode}
          type="button"
          aria-current={activeMode === mode ? "page" : undefined}
          className={cn(
            "h-9 shrink-0 border-b-2 text-[13px] font-medium transition-colors whitespace-nowrap",
            activeMode === mode
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:border-muted-foreground/30 hover:text-foreground",
          )}
          onClick={() => {
            const next = writeAnalysisWorkbenchUrlState(
              new URLSearchParams(searchParams?.toString() ?? ""),
              { view: mode },
            )
            const query = next.toString()
            const basePath = pathname ?? ""
            router.push(query ? `${basePath}?${query}` : basePath, { scroll: false })
          }}
        >
          {modeLabels[mode]}
        </button>
      ))}
    </nav>
  )
}
