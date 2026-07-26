"use client"

import { useMemo, useState } from "react"
import type { ReactNode } from "react"
import type { ImpactGraphNode, ImpactGraphResponse } from "@ba-helper/contracts"
import { AlertTriangle, GitBranch, Network, ShieldCheck } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { ImpactGraphInspector } from "@/components/graph/impact-graph-inspector"
import { ImpactGraphView } from "@/components/graph/impact-graph-view"
import type { AnalysisWorkspaceLabels } from "@/lib/i18n/analysis-labels"

type Labels = AnalysisWorkspaceLabels["graph"]

export function GraphTab({
  graph,
  isLoading,
  labels,
}: {
  graph?: ImpactGraphResponse
  isLoading: boolean
  labels: Labels
}) {
  const [selectedNode, setSelectedNode] = useState<ImpactGraphNode | null>(null)
  const summary = useMemo(() => buildGraphSummary(graph), [graph])

  if (isLoading) {
    return (
      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Skeleton className="h-[620px] rounded-xl" />
        <Skeleton className="h-[620px] rounded-xl" />
      </section>
    )
  }

  if (!graph || graph.nodes.length === 0) {
    return (
      <section className="rounded-lg border border-border/60 bg-surface p-8 text-center text-sm text-muted-foreground">
        <Network className="mx-auto mb-3 h-8 w-8 text-muted-foreground/60" />
        <p className="font-medium text-foreground">{labels.emptyTitle}</p>
        <p className="mt-1">{labels.emptyDescription}</p>
      </section>
    )
  }

  return (
    <section className="grid min-h-[620px] gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="overflow-hidden rounded-xl border border-border/40 bg-surface">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/40 bg-surface-muted/30 px-4 py-3">
          <div>
            <h2 className="text-[13px] font-semibold text-foreground">{labels.title}</h2>
            <p className="mt-0.5 text-[12px] text-muted-foreground">{labels.description}</p>
          </div>
          <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground">
            <GraphStat icon={<Network className="h-3.5 w-3.5" />} label={labels.nodes} value={graph.nodes.length} />
            <GraphStat icon={<GitBranch className="h-3.5 w-3.5" />} label={labels.edges} value={graph.edges.length} />
            <GraphStat icon={<ShieldCheck className="h-3.5 w-3.5" />} label={labels.evidenced} value={summary.evidencedNodes} />
            <GraphStat icon={<AlertTriangle className="h-3.5 w-3.5" />} label={labels.needsReview} value={summary.needsReviewNodes} />
          </div>
        </div>
        <div className="h-[560px]">
          <ImpactGraphView
            nodes={graph.nodes}
            edges={graph.edges}
            isTruncated={graph.nodes.some((node) => node.isTruncated)}
            onNodeSelect={setSelectedNode}
          />
        </div>
      </div>

      <aside className="rounded-xl border border-border/40 bg-surface p-4">
        {selectedNode ? (
          <ImpactGraphInspector node={selectedNode} onClose={() => setSelectedNode(null)} />
        ) : (
          <div className="flex h-full flex-col justify-between gap-6">
            <div>
              <h3 className="text-[13px] font-semibold text-foreground">{labels.inspectorEmptyTitle}</h3>
              <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
                {labels.inspectorEmptyDescription}
              </p>
            </div>
            <div className="grid gap-2 text-[12px]">
              <LegendRow tone="bg-accent" label={labels.legendRequirement} />
              <LegendRow tone="bg-info" label={labels.legendArtifact} />
              <LegendRow tone="bg-warning" label={labels.legendInsight} />
              <LegendRow tone="bg-danger" label={labels.legendUnknown} />
            </div>
          </div>
        )}
      </aside>
    </section>
  )
}

function GraphStat({
  icon,
  label,
  value,
}: {
  icon: ReactNode
  label: string
  value: number
}) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md border border-border/50 bg-surface px-2 py-1">
      {icon}
      <span>{label}</span>
      <span className="font-semibold text-foreground">{value}</span>
    </span>
  )
}

function LegendRow({ tone, label }: { tone: string; label: string }) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-border/40 bg-surface-muted/30 px-3 py-2">
      <span className={`h-2.5 w-2.5 rounded-full ${tone}`} />
      <span className="text-muted-foreground">{label}</span>
    </div>
  )
}

function buildGraphSummary(graph?: ImpactGraphResponse) {
  if (!graph) return { evidencedNodes: 0, needsReviewNodes: 0 }
  return {
    evidencedNodes: graph.nodes.filter((node) => node.certainty === "EVIDENCED").length,
    needsReviewNodes: graph.nodes.filter((node) => node.reviewStatus === "NEEDS_REVIEW").length,
  }
}
