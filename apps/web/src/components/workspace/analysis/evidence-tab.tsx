"use client"

import type { AnalysisWorkspaceResponse } from "@ba-helper/contracts"
import type { AnalysisWorkspaceLabels } from "@/lib/i18n/analysis-labels"
import { Copy } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"

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
    <section className="flex flex-col gap-4">
      <div className="rounded-lg border border-border/40 bg-surface flex flex-col overflow-hidden">
        <div className="flex flex-col divide-y divide-border/40">
          {evidenceCards.map((card) => (
            <article key={card.evidenceId} className="flex flex-col p-4 hover:bg-surface-muted/30 transition-colors gap-3">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="font-mono text-[13px] font-semibold text-foreground truncate">
                      {card.artifactKey ?? labels.unlinkedEvidence}
                    </h2>
                    <span className="text-[10px] font-medium bg-muted text-muted-foreground px-1.5 py-0.5 rounded uppercase tracking-wider">
                      {card.sourceType}
                    </span>
                    <span className="text-[10px] font-medium bg-muted/50 text-muted-foreground px-1.5 py-0.5 rounded uppercase tracking-wider font-mono">
                      {formatLineRange(card, labels)}
                    </span>
                  </div>
                  <p className="font-mono text-[11px] text-muted-foreground truncate">
                    {card.filePath ?? card.sourceType}
                  </p>
                  
                  <div className="relative mt-1 group">
                    <pre className="overflow-x-auto rounded border border-border/40 bg-background/60 p-2 text-[11px] leading-relaxed text-foreground font-mono">
                      <code>{card.excerpt}</code>
                    </pre>
                    <Button 
                      size="icon" 
                      variant="outline" 
                      className="absolute top-2 right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity bg-surface hover:bg-surface-muted"
                      onClick={() => {
                        navigator.clipboard.writeText(card.excerpt)
                        toast.success(labels.copied)
                      }}
                      title={labels.copyExcerpt}
                    >
                      <Copy className="h-3 w-3 text-muted-foreground" />
                    </Button>
                  </div>
                  
                  <p className="mt-1 text-[13px] text-muted-foreground leading-relaxed">{card.relevanceReason}</p>
                </div>
                <div className="shrink-0 flex flex-col items-end gap-1 text-[11px] text-muted-foreground font-medium text-right">
                  <span>{card.linkedInsightIds.length} {labels.insights}</span>
                  <span>{card.linkedTraceabilityLinkIds.length} {labels.links}</span>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}

function formatLineRange(card: EvidenceCard, labels: AnalysisWorkspaceLabels["evidence"]) {
  const { startLine, endLine } = card.lineRange
  if (!startLine && !endLine) return labels.noLineRange
  if (startLine && endLine) return `L${startLine}-L${endLine}`
  return `L${startLine ?? endLine}`
}
