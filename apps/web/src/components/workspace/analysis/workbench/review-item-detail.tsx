import { useMemo } from "react"
import type { AnalysisWorkspaceResponse } from "@ba-helper/contracts"
import type { SupportedLocale } from "@/lib/i18n/status-labels"
import type { AnalysisWorkspaceLabels } from "@/lib/i18n/analysis-labels"
import type { AnalysisWorkbenchViewModel, ReviewWorkbenchItem } from "./analysis-workbench-types"
import { resolveReviewItemDetail } from "./analysis-workbench-view-model"
import { EvidenceStack } from "./evidence-stack"
import { ImpactClaimPanel } from "./impact-claim-panel"
import { RelatedContextPanel } from "./related-context-panel"

export function ReviewItemDetail({
  workspace,
  viewModel,
  item,
  locale,
  labels,
}: {
  workspace: AnalysisWorkspaceResponse
  viewModel: AnalysisWorkbenchViewModel
  item: ReviewWorkbenchItem | null
  locale: SupportedLocale
  labels: AnalysisWorkspaceLabels["reviewWorkbench"]
}) {
  const detail = useMemo(() => item ? resolveReviewItemDetail(workspace, viewModel, item) : null, [item, viewModel, workspace])
  if (!item || !detail) return <div className="flex min-h-80 items-center justify-center rounded-lg border border-dashed border-border/60 p-6 text-center text-sm text-muted-foreground">{labels.noSelection}</div>

  return (
    <article className="grid gap-5">
      {item.itemType === "impact" ? <ImpactClaimPanel item={item} artifact={detail.artifact} locale={locale} labels={labels} /> : <InsightHeader item={item} detail={detail} labels={labels} />}
      <EvidenceStack evidence={detail.evidence} labels={labels} />
      <RelatedContextPanel risks={detail.risks} unknowns={detail.unknowns} qaScenarios={detail.qaScenarios} labels={labels} />
      {detail.traceabilityIds.length > 0 ? <details className="rounded-lg border border-border/50 p-3"><summary className="cursor-pointer text-xs font-medium text-foreground">{labels.traceabilityMetadata}</summary><p className="mt-2 break-all font-mono text-xs text-muted-foreground">{labels.traceabilityIds}: {detail.traceabilityIds.join(", ")}</p></details> : null}
    </article>
  )
}

function InsightHeader({ item, detail, labels }: { item: ReviewWorkbenchItem; detail: ResolvedReviewItem; labels: AnalysisWorkspaceLabels["reviewWorkbench"] }) {
  const entity = detail.risks[0] ?? detail.unknowns[0] ?? detail.qaScenarios[0]
  return (
    <section className="rounded-lg border border-border/50 bg-surface p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{item.itemType}</p>
      <h2 className="mt-1 text-base font-semibold text-foreground">{item.title}</h2>
      {"whyItMatters" in (entity ?? {}) ? <p className="mt-3 text-sm leading-relaxed text-muted-foreground"><span className="font-medium text-foreground">{labels.whyItMatters}: </span>{entity.whyItMatters}</p> : null}
      {detail.unknowns[0] ? <p className="mt-3 text-sm leading-relaxed text-muted-foreground"><span className="font-medium text-foreground">{labels.question}: </span>{detail.unknowns[0].question}</p> : null}
      {detail.qaScenarios[0] ? <div className="mt-3 grid gap-1 text-sm text-muted-foreground"><p><span className="font-medium text-foreground">{labels.given}: </span>{detail.qaScenarios[0].given}</p><p><span className="font-medium text-foreground">{labels.when}: </span>{detail.qaScenarios[0].when}</p><p><span className="font-medium text-foreground">{labels.then}: </span>{detail.qaScenarios[0].then}</p><p><span className="font-medium text-foreground">{labels.regressionTarget}: </span>{detail.qaScenarios[0].regressionTarget}</p></div> : null}
    </section>
  )
}

type ResolvedReviewItem = {
  artifact: AnalysisWorkspaceResponse["impactGroups"][number]["artifacts"][number] | null
  evidence: AnalysisWorkspaceResponse["evidenceCards"][number][]
  risks: AnalysisWorkspaceResponse["risks"][number][]
  unknowns: AnalysisWorkspaceResponse["unknowns"][number][]
  qaScenarios: AnalysisWorkspaceResponse["qaScenarios"][number][]
  traceabilityIds: string[]
}
