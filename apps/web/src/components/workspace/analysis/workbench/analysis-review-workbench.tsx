"use client"

import { useMemo } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import type { AnalysisWorkspaceResponse } from "@ba-helper/contracts"
import type { SupportedLocale } from "@/lib/i18n/status-labels"
import type { AnalysisWorkspaceLabels } from "@/lib/i18n/analysis-labels"
import { useImpactGraph } from "@/hooks/api/use-analyses"
import { GraphTab } from "../graph-tab"
import { readAnalysisWorkbenchUrlState, writeAnalysisWorkbenchUrlState } from "./analysis-workbench-url-state"
import { filterReviewItems } from "./analysis-workbench-view-model"
import type { AnalysisWorkbenchViewModel, ReviewDisplay } from "./analysis-workbench-types"
import { MobileEvidenceSheet } from "./mobile-evidence-sheet"
import { ReviewItemDetail } from "./review-item-detail"
import { ReviewQueue } from "./review-queue"
import { WorkbenchInspector } from "./workbench-inspector"

export function AnalysisReviewWorkbench({
  workspace,
  viewModel,
  locale,
  labels,
  queueLabels,
  graphLabels,
}: {
  workspace: AnalysisWorkspaceResponse
  viewModel: AnalysisWorkbenchViewModel
  locale: SupportedLocale
  labels: AnalysisWorkspaceLabels["reviewWorkbench"]
  queueLabels: AnalysisWorkspaceLabels["reviewQueue"]
  graphLabels: AnalysisWorkspaceLabels["graph"]
}) {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const urlState = readAnalysisWorkbenchUrlState(searchParams ?? new URLSearchParams())
  const visibleItems = useMemo(() => filterReviewItems(viewModel.orderedReviewItems, urlState.filter), [urlState.filter, viewModel.orderedReviewItems])
  const selectedItem = visibleItems.find((item) => item.itemId === viewModel.selectedItemId) ?? visibleItems[0] ?? null
  const { data: graph, isLoading: graphLoading } = useImpactGraph(workspace.overview.analysisId, { enabled: urlState.display === "dependency-path" })

  const setDisplay = (display: ReviewDisplay) => {
    const next = writeAnalysisWorkbenchUrlState(new URLSearchParams(searchParams?.toString() ?? ""), { view: "review", display })
    const query = next.toString()
    router.push(query ? `${pathname ?? ""}?${query}` : pathname ?? "", { scroll: false })
  }

  const detail = <ReviewItemDetail workspace={workspace} viewModel={viewModel} item={selectedItem} locale={locale} labels={labels} />
  return (
    <section className="grid min-h-0 gap-4 xl:grid-cols-[300px_minmax(0,1fr)_260px]">
      <ReviewQueue viewModel={viewModel} locale={locale} labels={queueLabels} />
      <div className="min-w-0 rounded-lg border border-border/50 bg-surface p-4">
        <div className="mb-4 lg:hidden"><MobileEvidenceSheet labels={labels}>{detail}</MobileEvidenceSheet></div>
        {urlState.display === "dependency-path" ? <GraphTab graph={graph} isLoading={graphLoading} labels={graphLabels} /> : detail}
      </div>
      <WorkbenchInspector item={selectedItem} display={urlState.display} labels={labels} onDisplayChange={setDisplay} />
    </section>
  )
}
