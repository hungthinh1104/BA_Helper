"use client"

import type { AnalysisWorkspaceResponse } from "@ba-helper/contracts"
import type { AnalysisWorkspaceLabels } from "@/lib/i18n/analysis-labels"

type EvidenceCard = AnalysisWorkspaceResponse["evidenceCards"][number]

export function EvidenceTab({
  evidenceCards,
  labels,
}: {
  evidenceCards: EvidenceCard[]
  labels: AnalysisWorkspaceLabels["evidence"]
}) {
  if (evidenceCards.length === 0) {
    return (
      <div className="rounded-lg border border-border/60 bg-surface p-8 text-center text-sm text-muted-foreground">
        {labels.empty}
      </div>
    )
  }

  return (
    <section className="grid gap-3">
      {evidenceCards.map((card) => (
        <article key={card.evidenceId} className="rounded-lg border border-border/60 bg-surface p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <h2 className="font-mono text-sm font-medium text-foreground">
                {card.filePath ?? labels.requirementEvidence}
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                {formatLineRange(card, labels)} · {card.sourceType}
              </p>
            </div>
            <div className="text-xs text-muted-foreground">
              {card.linkedInsightIds.length} {labels.insights} · {card.linkedTraceabilityLinkIds.length} {labels.links}
            </div>
          </div>
          <pre className="mt-3 overflow-x-auto rounded-md border border-border/50 bg-background/60 p-3 text-xs leading-5 text-foreground">
            <code>{card.excerpt}</code>
          </pre>
          <p className="mt-3 text-sm text-muted-foreground">{card.relevanceReason}</p>
        </article>
      ))}
    </section>
  )
}

function formatLineRange(card: EvidenceCard, labels: AnalysisWorkspaceLabels["evidence"]) {
  const { startLine, endLine } = card.lineRange
  if (!startLine && !endLine) return labels.noLineRange
  if (startLine && endLine) return `L${startLine}-L${endLine}`
  return `L${startLine ?? endLine}`
}
