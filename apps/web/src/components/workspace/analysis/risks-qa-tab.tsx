"use client"

import type { ReactNode } from "react"
import type { AnalysisWorkspaceResponse } from "@ba-helper/contracts"
import type { AnalysisWorkspaceLabels } from "@/lib/i18n/analysis-labels"
import { InlineReviewAction } from "../shared/inline-review-action"
import { DenseCard, DenseCardHeader, DenseCardTitle } from "../shared/dense-card"

export function RisksQaTab({
  risks,
  unknowns,
  qaScenarios,
  labels,
  analysisId,
  isStale,
}: {
  risks: AnalysisWorkspaceResponse["risks"]
  unknowns: AnalysisWorkspaceResponse["unknowns"]
  qaScenarios: AnalysisWorkspaceResponse["qaScenarios"]
  labels: AnalysisWorkspaceLabels["risksQa"]
  analysisId: string
  isStale: boolean
}) {
  const highRisks = risks.filter(r => r.severity === "high")
  const otherRisks = risks.filter(r => r.severity !== "high")

  return (
    <section className="grid gap-4 xl:grid-cols-2">
      <Panel title={labels.highRisks} count={highRisks.length} emptyLabel={labels.empty}>
        {highRisks.map((risk) => (
          <Item 
            key={risk.riskId} 
            title={risk.title} 
            meta={`${risk.severity} · ${risk.category}`}
            evidenceCount={risk.relatedEvidenceIds.length}
            evidenceLabel={labels.evidence}
            action={risk.sourceInsightId ? <InlineReviewAction analysisId={analysisId} itemId={risk.sourceInsightId} itemType="insight" itemTitle={risk.title} currentStatus={risk.reviewDecision.toUpperCase()} isStale={isStale} /> : null}
          >
            {risk.whyItMatters}
          </Item>
        ))}
      </Panel>

      <Panel title={labels.mediumLowRisks} count={otherRisks.length} emptyLabel={labels.empty}>
        {otherRisks.map((risk) => (
          <Item 
            key={risk.riskId} 
            title={risk.title} 
            meta={`${risk.severity} · ${risk.category}`}
            evidenceCount={risk.relatedEvidenceIds.length}
            evidenceLabel={labels.evidence}
            action={risk.sourceInsightId ? <InlineReviewAction analysisId={analysisId} itemId={risk.sourceInsightId} itemType="insight" itemTitle={risk.title} currentStatus={risk.reviewDecision.toUpperCase()} isStale={isStale} /> : null}
          >
            {risk.whyItMatters}
          </Item>
        ))}
      </Panel>

      <div className="xl:col-span-2">
        <Panel title={labels.unknowns} count={unknowns.length} emptyLabel={labels.empty}>
          {unknowns.map((unknown) => (
            <Item 
              key={unknown.unknownId} 
              title={unknown.title} 
              meta=""
              evidenceCount={unknown.relatedEvidenceIds.length}
              evidenceLabel={labels.evidence}
              action={unknown.sourceInsightId ? <InlineReviewAction analysisId={analysisId} itemId={unknown.sourceInsightId} itemType="insight" itemTitle={unknown.title} currentStatus={unknown.reviewDecision.toUpperCase()} isStale={isStale} /> : null}
            >
              <div className="flex flex-col gap-2 mt-1">
                <p><strong>{labels.question}:</strong> {unknown.question}</p>
                <p><strong>{labels.whyItMatters}:</strong> {unknown.whyItMatters}</p>
              </div>
            </Item>
          ))}
        </Panel>
      </div>

      <div className="xl:col-span-2">
        <Panel title={labels.qaScenarios} count={qaScenarios.length} emptyLabel={labels.empty}>
          {qaScenarios.map((scenario) => (
            <article key={scenario.scenarioId} className="flex flex-col p-4 hover:bg-surface-muted/30 transition-colors gap-3 relative">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                  <h3 className="text-[13px] font-semibold text-foreground">{scenario.title}</h3>
                  <div className="mt-2 grid gap-3 text-[13px] text-muted-foreground md:grid-cols-3">
                    <Step label={labels.given} value={scenario.given} />
                    <Step label={labels.when} value={scenario.when} />
                    <Step label={labels.then} value={scenario.then} />
                  </div>
                  <p className="mt-2 text-[11px] text-muted-foreground font-mono truncate">
                    {labels.regressionTarget}: {scenario.regressionTarget}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-3 shrink-0">
                  {scenario.sourceInsightId && (
                    <InlineReviewAction analysisId={analysisId} itemId={scenario.sourceInsightId} itemType="insight" itemTitle={scenario.title} currentStatus={scenario.reviewDecision.toUpperCase()} isStale={isStale} />
                  )}
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">
                    {scenario.relatedEvidenceIds.length} {labels.evidence}
                  </span>
                </div>
              </div>
            </article>
          ))}
        </Panel>
      </div>
    </section>
  )
}

function Panel({ title, count, emptyLabel, children }: { title: string; count: number; emptyLabel: string; children: ReactNode }) {
  return (
    <DenseCard>
      <DenseCardHeader className="flex-row items-center justify-between border-b border-border/40 bg-surface-muted/30 px-4 py-3">
        <DenseCardTitle>{title}</DenseCardTitle>
        <span className="text-[11px] font-medium bg-foreground/10 px-1.5 py-0.5 rounded text-foreground">{count}</span>
      </DenseCardHeader>
      <div className="flex flex-col divide-y divide-border/40">
        {count > 0 ? children : <p className="p-6 text-center text-[13px] text-muted-foreground">{emptyLabel}</p>}
      </div>
    </DenseCard>
  )
}

function Item({ title, meta, evidenceCount, evidenceLabel, children, action }: { title: string; meta?: string; evidenceCount?: number; evidenceLabel: string; children: ReactNode; action?: ReactNode }) {
  return (
    <article className="flex flex-col p-4 hover:bg-surface-muted/30 transition-colors">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0 flex flex-col gap-1.5">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h3 className="text-[13px] font-semibold text-foreground">{title}</h3>
            {meta && <span className="text-[10px] font-medium bg-muted text-muted-foreground px-1.5 py-0.5 rounded uppercase tracking-wider">{meta}</span>}
          </div>
          <div className="text-[13px] text-muted-foreground leading-relaxed">{children}</div>
        </div>
        <div className="flex flex-col items-end gap-3 shrink-0">
          {action && <div>{action}</div>}
          {evidenceCount !== undefined && (
            <span className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">
              {evidenceCount} {evidenceLabel}
            </span>
          )}
        </div>
      </div>
    </article>
  )
}

function Step({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 text-foreground">{value}</div>
    </div>
  )
}
