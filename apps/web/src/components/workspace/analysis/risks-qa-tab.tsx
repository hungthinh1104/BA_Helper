"use client"

import type { ReactNode } from "react"
import type { AnalysisWorkspaceResponse } from "@ba-helper/contracts"

export function RisksQaTab({
  risks,
  unknowns,
  qaScenarios,
}: {
  risks: AnalysisWorkspaceResponse["risks"]
  unknowns: AnalysisWorkspaceResponse["unknowns"]
  qaScenarios: AnalysisWorkspaceResponse["qaScenarios"]
}) {
  return (
    <section className="grid gap-4 xl:grid-cols-2">
      <Panel title="Risks" count={risks.length}>
        {risks.map((risk) => (
          <Item key={risk.riskId} title={risk.title} meta={`${risk.severity} · ${risk.category}`}>
            {risk.whyItMatters}
          </Item>
        ))}
      </Panel>

      <Panel title="Unknowns" count={unknowns.length}>
        {unknowns.map((unknown) => (
          <Item key={unknown.unknownId} title={unknown.title} meta={unknown.reviewDecision}>
            {unknown.question}
          </Item>
        ))}
      </Panel>

      <div className="xl:col-span-2">
        <Panel title="QA Scenarios" count={qaScenarios.length}>
          {qaScenarios.map((scenario) => (
            <article key={scenario.scenarioId} className="rounded-md border border-border/50 bg-background/40 p-3">
              <h3 className="text-sm font-medium text-foreground">{scenario.title}</h3>
              <div className="mt-3 grid gap-2 text-sm text-muted-foreground md:grid-cols-3">
                <Step label="Given" value={scenario.given} />
                <Step label="When" value={scenario.when} />
                <Step label="Then" value={scenario.then} />
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                Regression target: {scenario.regressionTarget}
              </p>
            </article>
          ))}
        </Panel>
      </div>
    </section>
  )
}

function Panel({ title, count, children }: { title: string; count: number; children: ReactNode }) {
  return (
    <div className="rounded-lg border border-border/60 bg-surface p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        <span className="text-xs text-muted-foreground">{count}</span>
      </div>
      <div className="mt-4 grid gap-3">
        {count > 0 ? children : <p className="text-sm text-muted-foreground">No items.</p>}
      </div>
    </div>
  )
}

function Item({ title, meta, children }: { title: string; meta: string; children: ReactNode }) {
  return (
    <article className="rounded-md border border-border/50 bg-background/40 p-3">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-sm font-medium text-foreground">{title}</h3>
        <span className="shrink-0 text-xs text-muted-foreground">{meta}</span>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">{children}</p>
    </article>
  )
}

function Step({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 text-foreground">{value}</div>
    </div>
  )
}
