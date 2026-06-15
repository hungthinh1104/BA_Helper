"use client"

import { CodeEvidenceBlock } from "@/components/workspace/shared/retrieval/code-evidence-block"
import { ImpactGraphInspector } from "@/components/graph/impact-graph-inspector"
import { AlertCircle, FileCode2 } from "lucide-react"
import { ClarificationWidget } from "@/components/workspace/analysis/clarification/clarification-widget"
import type {
  InsightListResponse,
  TraceabilityLinkListResponse,
  ImpactGraphNode,
  QaCoverageResponse,
} from "@ba-helper/contracts"

type Insight = InsightListResponse["items"][number]
type TraceabilityLink = TraceabilityLinkListResponse["items"][number]
type QaCoverageItem = QaCoverageResponse["items"][number]
type EvidenceItem = Insight["evidence"][number]

interface LinkedInsightButtonProps {
  insight: Insight
  onClick: (insight: Insight) => void
}

function LinkedInsightButton({ insight, onClick }: LinkedInsightButtonProps) {
  return (
    <button
      onClick={() => onClick(insight)}
      className={`text-left p-3 rounded-lg border text-sm transition-colors ${
        insight.reviewStatus === "REJECTED"
          ? "opacity-60 bg-surface/50 border-border/40 hover:bg-surface"
          : "bg-surface border-border hover:border-border/80 shadow-sm"
      }`}
    >
      <div className="flex items-center gap-2 mb-1.5">
        <span
          className={`px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider border ${
            insight.certainty === "EVIDENCED"
              ? "bg-success/10 text-success border-success/30"
              : insight.certainty === "INFERRED"
              ? "bg-info/10 text-info border-info/30"
              : insight.certainty === "CONFLICTING"
              ? "bg-danger/10 text-danger border-danger/30"
              : "bg-unknown/10 text-muted-foreground border-border/60"
          }`}
        >
          {insight.certainty}
        </span>
        {insight.reviewStatus === "NEEDS_REVIEW" && (
          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-warning/10 text-warning border border-warning/30">
            NEEDS REVIEW
          </span>
        )}
      </div>
      <p className="font-medium text-foreground line-clamp-2">{insight.statement}</p>
    </button>
  )
}

interface AnalysisEvidenceInspectorProps {
  analysisId: string
  selectedInsight: Insight | null
  activeEvidence: EvidenceItem[]
  selectedLink: TraceabilityLink | null
  linkedInsights: Insight[]
  selectedGraphNode: ImpactGraphNode | null
  qaCoverageData: QaCoverageItem[]
  onSelectInsight: (insight: Insight) => void
  onCloseGraphNode: () => void
}

export function AnalysisEvidenceInspector({
  analysisId,
  selectedInsight,
  activeEvidence,
  selectedLink,
  linkedInsights,
  selectedGraphNode,
  qaCoverageData,
  onSelectInsight,
  onCloseGraphNode,
}: AnalysisEvidenceInspectorProps) {
  // Graph node inspector
  if (selectedGraphNode) {
    const isKnownType =
      selectedGraphNode.type === "INSIGHT" ||
      ["CONTROLLER", "API_ROUTE", "SERVICE", "SERVICE_METHOD", "ENTITY", "TEST"].includes(
        selectedGraphNode.type,
      )
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const coverage = qaCoverageData.find((c: any) =>
      c.artifactId === selectedGraphNode.id.replace("artifact-", ""),
    )

    return (
      <div className="h-full flex flex-col">
        {isKnownType && (
          <div className="mb-4 flex items-start gap-2.5 p-3 bg-warning/10 border border-warning/20 rounded-lg text-sm text-warning">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <p className="leading-snug">
              This graph node points to an entity that is no longer available in the current workspace.
            </p>
          </div>
        )}
        <ImpactGraphInspector
          node={selectedGraphNode}
          onClose={onCloseGraphNode}
          coverage={coverage}
        />
      </div>
    )
  }

  // Evidence inspector (insight or traceability link)
  if (activeEvidence.length === 0 && !selectedLink && !selectedInsight) return null

  const isClarificationType = selectedInsight?.category === 'UNKNOWN' || selectedInsight?.category === 'QUESTION';

  return (
    <div className="h-full flex flex-col gap-6 pb-6">
      {selectedInsight && isClarificationType && (
        <div className="px-1">
          <ClarificationWidget analysisId={analysisId} insightId={selectedInsight.id} />
        </div>
      )}

      <div>
        {activeEvidence.length === 0 ? (
          <div className="flex flex-col items-center text-center py-16 px-4">
            <div className="w-14 h-14 rounded-full bg-surface-muted/50 border border-border/40 flex items-center justify-center mb-4 text-muted-foreground shadow-sm">
              <FileCode2 className="w-6 h-6 opacity-60" />
            </div>
            <h4 className="text-[14px] font-semibold text-foreground mb-1">No Code Evidence Linked</h4>
            <p className="text-[12px] text-muted-foreground max-w-[240px] leading-relaxed">
              This item is not a confirmed code impact. Treat it as a diagnostic, risk, or clarification prompt until review links it to evidence.
            </p>
          </div>
        ) : (
          activeEvidence.map((ev, i) => (
            <CodeEvidenceBlock key={ev.id} evidence={ev} index={i} total={activeEvidence.length} />
          ))
        )}
      </div>

      {selectedLink && linkedInsights.length > 0 && (
        <div className="flex flex-col gap-3 px-1 border-t border-border/40 pt-6">
          <h4 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Linked Insights
          </h4>
          <div className="flex flex-col gap-2">
            {linkedInsights.map((insight) => (
              <LinkedInsightButton key={insight.id} insight={insight} onClick={onSelectInsight} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
