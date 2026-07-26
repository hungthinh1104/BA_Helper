"use client"

import { ImpactGraphNode } from "@ba-helper/contracts"
import { X } from "lucide-react"
import { RetrievalSuggestion } from "@/components/workspace/analysis/retrieval/retrieval-suggestion"

import { QaCoverageItem } from "@ba-helper/contracts"
import { QaCoverageBadge } from "@/components/workspace/analysis/qa/qa-coverage-badge"
import { DenseCard } from "@/components/workspace/shared/dense-card"

interface Props {
  node: ImpactGraphNode
  onClose: () => void
  coverage?: QaCoverageItem
}

const LABELS: Record<string, string> = {
  REQUIREMENT: "Requirement",
  ANALYSIS: "Analysis",
  CONTROLLER: "Controller",
  API_ROUTE: "API Route",
  SERVICE: "Service",
  SERVICE_METHOD: "Service Method",
  ENTITY: "Entity",
  TEST: "Test",
  INSIGHT: "Insight",
  UNKNOWN: "Unknown",
  QA_SCENARIO: "QA Scenario",
}

export function ImpactGraphInspector({ node, onClose, coverage }: Props) {
  return (
    <div className="flex flex-col gap-3 h-full overflow-y-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-0.5 min-w-0">
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
            {LABELS[node.type] ?? node.type}
          </span>
          <p className="text-sm font-semibold text-foreground leading-snug break-words">
            {node.label}
          </p>
        </div>
        <button
          onClick={onClose}
          className="shrink-0 mt-0.5 w-5 h-5 flex items-center justify-center rounded hover:bg-surface-muted text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Subtitle / Description */}
      {node.subtitle && (
        <p className="text-[12px] text-muted-foreground">{node.subtitle}</p>
      )}
      {node.description && (
        <p className="text-[12px] text-foreground leading-relaxed">
          {node.description}
        </p>
      )}
      
      {/* Question / Reasoning for Unknowns and QA Scenarios */}
      {node.reasoning && (
        <DenseCard variant="muted" className="gap-1.5 p-2.5">
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
            Details & Reasoning
          </span>
          <p className="text-[12px] text-foreground/80 leading-relaxed">
            {node.reasoning}
          </p>
        </DenseCard>
      )}

      {/* File path & Line Range */}
      {node.filePath && (
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">File</span>
          <code className="text-[11px] text-foreground/80 bg-surface border border-border/40 rounded px-2 py-1 break-all">
            {node.filePath}
            {node.startLine !== undefined && (
              <span className="text-muted-foreground">
                {` : ${node.startLine}${node.endLine ? `-${node.endLine}` : ''}`}
              </span>
            )}
          </code>
        </div>
      )}

      {/* Artifact key */}
      {node.artifactKey && (
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Artifact Key</span>
          <code className="text-[11px] text-foreground/80 bg-surface border border-border/40 rounded px-2 py-1 break-all">
            {node.artifactKey}
          </code>
        </div>
      )}

      {/* Snapshot Commit */}
      {node.commitSha && (
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Snapshot Commit</span>
          <code className="text-[11px] text-foreground/80 bg-surface border border-border/40 rounded px-2 py-1">
            {node.commitSha.substring(0, 7)}
          </code>
        </div>
      )}

      {/* Certainty & Review */}
      <div className="flex flex-wrap gap-1.5">
        {node.certainty && (
          <span className={`inline-flex px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide rounded border ${
            node.certainty === "EVIDENCED" ? "bg-success/10 text-success border-success/30" :
            node.certainty === "INFERRED"  ? "bg-info/10 text-info border-info/30" :
            "bg-danger/10 text-danger border-danger/30"
          }`}>
            {node.certainty}
          </span>
        )}
        {node.reviewStatus && (
          <span className={`inline-flex px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide rounded border ${
            node.reviewStatus === "CONFIRMED"    ? "bg-success/10 text-success border-success/30" :
            node.reviewStatus === "REJECTED"     ? "bg-danger/10 text-danger border-danger/30" :
            "bg-warning/10 text-warning border-warning/30"
          }`}>
            {node.reviewStatus.replace("_", " ")}
          </span>
        )}
      </div>

      {/* Retrieval provenance */}
      {node.retrieval && Object.keys(node.retrieval).length > 0 && (
        <div className="flex flex-col gap-1.5">
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Retrieval Provenance</span>
          <DenseCard className="gap-2 px-2 py-2 text-[11px] text-foreground/70">
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground font-semibold">Method</span>
              <span className="font-mono">{node.retrieval.method as string}</span>
            </div>
            
            {node.retrieval.signals && Array.isArray(node.retrieval.signals) && (
              <div className="flex flex-col gap-1">
                <span className="text-muted-foreground font-semibold">Signals</span>
                <div className="flex flex-wrap gap-1">
                  {node.retrieval.signals.map((sig) => (
                    <span key={sig as string} className="px-1.5 py-0.5 bg-surface-muted border border-border rounded text-[9px] font-bold uppercase text-muted-foreground tracking-wider">
                      {sig as string}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {node.retrieval.reason && (
              <div className="flex flex-col gap-0.5">
                <span className="text-muted-foreground font-semibold">Reason</span>
                <span className="italic">{node.retrieval.reason as string}</span>
              </div>
            )}

            {node.retrieval.score && (
              <div className="flex flex-col gap-0.5 mt-1 pt-1 border-t border-border/40">
                <span className="text-muted-foreground font-semibold mb-0.5">Score Breakdown</span>
                {Object.entries(node.retrieval.score as Record<string, number>).map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-2 text-[10px]">
                    <span className="text-muted-foreground">{k}</span>
                    <span className="font-mono">{v.toFixed(3)}</span>
                  </div>
                ))}
              </div>
            )}
            
            {node.retrieval.score && (
              <RetrievalSuggestion retrieval={node.retrieval as import("@ba-helper/contracts").RetrievalMetadata} />
            )}
            
            {coverage && (
              <QaCoverageBadge coverage={coverage} />
            )}
          </DenseCard>
        </div>
      )}

      {/* Evidence summary */}
      {node.evidenceSummary && (
        <div className="flex flex-col gap-1.5">
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Evidence Excerpt</span>
          <DenseCard className="px-2 py-2 text-[11px] text-foreground/70 italic break-words leading-relaxed whitespace-pre-wrap">
            {node.evidenceSummary}
          </DenseCard>
        </div>
      )}
    </div>
  )
}
