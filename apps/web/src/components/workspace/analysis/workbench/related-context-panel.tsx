import type { AnalysisWorkspaceResponse } from "@ba-helper/contracts"
import type { AnalysisWorkspaceLabels } from "@/lib/i18n/analysis-labels"

type Risk = AnalysisWorkspaceResponse["risks"][number]
type Unknown = AnalysisWorkspaceResponse["unknowns"][number]
type QaScenario = AnalysisWorkspaceResponse["qaScenarios"][number]

export function RelatedContextPanel({
  risks,
  unknowns,
  qaScenarios,
  labels,
}: {
  risks: Risk[]
  unknowns: Unknown[]
  qaScenarios: QaScenario[]
  labels: AnalysisWorkspaceLabels["reviewWorkbench"]
}) {
  if (risks.length + unknowns.length + qaScenarios.length === 0) {
    return <p className="rounded-lg border border-dashed border-border/60 p-4 text-sm text-muted-foreground">{labels.noRelatedContext}</p>
  }
  return (
    <section>
      <h3 className="text-sm font-semibold text-foreground">{labels.relatedContext}</h3>
      <div className="mt-2 grid gap-3 lg:grid-cols-3">
        <ContextList title={labels.risks} items={risks.map((risk) => `${risk.title} · ${risk.severity}`)} />
        <ContextList title={labels.unknowns} items={unknowns.map((unknown) => unknown.question)} />
        <ContextList title={labels.qaScenarios} items={qaScenarios.map((scenario) => `${scenario.given} → ${scenario.when} → ${scenario.then}`)} />
      </div>
    </section>
  )
}

function ContextList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-lg border border-border/50 bg-surface-muted/20 p-3">
      <h4 className="text-xs font-semibold text-foreground">{title}</h4>
      {items.length === 0 ? <p className="mt-2 text-xs text-muted-foreground">—</p> : <ul className="mt-2 space-y-2 text-xs leading-relaxed text-muted-foreground">{items.map((item) => <li key={item}>{item}</li>)}</ul>}
    </div>
  )
}
