"use client"

import { memo } from "react"
import { Handle, Position, NodeProps } from "@xyflow/react"
import { ImpactGraphNode } from "@ba-helper/contracts"
import { RetrievalMetadata } from "@ba-helper/contracts"
import {
  Route, Settings, Database, FlaskConical,
  Lightbulb, HelpCircle, ClipboardCheck, FileText, Activity
} from "lucide-react"

const TYPE_CONFIG: Record<string, { icon: React.FC<{ className?: string }>, color: string, bg: string, border: string }> = {
  REQUIREMENT:    { icon: FileText,       color: "text-accent",   bg: "bg-accent/10",    border: "border-accent/30" },
  ANALYSIS:       { icon: Activity,       color: "text-info",     bg: "bg-info/10",      border: "border-info/30" },
  CONTROLLER:     { icon: Route,          color: "text-foreground", bg: "bg-surface-muted", border: "border-border" },
  API_ROUTE:      { icon: Route,          color: "text-foreground", bg: "bg-surface-muted", border: "border-border" },
  SERVICE:        { icon: Settings,       color: "text-foreground", bg: "bg-surface-muted", border: "border-border" },
  SERVICE_METHOD: { icon: Settings,       color: "text-foreground", bg: "bg-surface-muted", border: "border-border" },
  ENTITY:         { icon: Database,       color: "text-foreground", bg: "bg-surface-muted", border: "border-border" },
  TEST:           { icon: FlaskConical,   color: "text-success",  bg: "bg-success/10",   border: "border-success/30" },
  INSIGHT:        { icon: Lightbulb,      color: "text-warning",  bg: "bg-warning/10",   border: "border-warning/30" },
  UNKNOWN:        { icon: HelpCircle,     color: "text-danger",   bg: "bg-danger/10",    border: "border-danger/30" },
  QA_SCENARIO:    { icon: ClipboardCheck, color: "text-info",     bg: "bg-info/10",      border: "border-info/30" },
}

const CERTAINTY_BADGE: Record<string, string> = {
  EVIDENCED: "bg-success/15 text-success border-success/30",
  INFERRED:  "bg-info/15 text-info border-info/30",
  UNKNOWN:   "bg-danger/15 text-danger border-danger/30",
}

const REVIEW_OPACITY: Record<string, string> = {
  CONFIRMED: "opacity-100",
  NEEDS_REVIEW: "opacity-90",
  REJECTED: "opacity-40",
}

export const ImpactGraphNodeComponent = memo(function ImpactGraphNodeComponent({
  data,
  selected,
}: NodeProps & { data: ImpactGraphNode }) {
  const cfg = TYPE_CONFIG[data.type] ?? TYPE_CONFIG.INSIGHT
  const Icon = cfg.icon
  const reviewClass = data.reviewStatus ? (REVIEW_OPACITY[data.reviewStatus] ?? "opacity-100") : "opacity-100"
  const isAbsoluteRoot = data.type === "REQUIREMENT"

  return (
    <div
      className={`
        group relative flex flex-col gap-1 px-3 py-2 rounded-xl border transition-all duration-150 cursor-pointer min-w-[160px] max-w-[220px]
        ${cfg.bg} ${cfg.border} border
        ${selected ? "ring-2 ring-offset-1 ring-offset-transparent ring-primary shadow-lg shadow-primary/20" : "hover:shadow-md hover:shadow-black/20"}
        ${reviewClass}
      `}
      style={{ fontSize: 12 }}
    >
      {/* Handles */}
      {!isAbsoluteRoot && <Handle type="target" position={Position.Top} className="!w-2 !h-2 !bg-border !border-border" />}
      <Handle type="source" position={Position.Bottom} className="!w-2 !h-2 !bg-border !border-border" />

      <div className="flex items-center gap-2">
        <div className={`shrink-0 w-6 h-6 rounded-md flex items-center justify-center ${cfg.bg} border ${cfg.border}`}>
          <Icon className={`w-3.5 h-3.5 ${cfg.color}`} />
        </div>
        <span className="font-semibold text-foreground truncate leading-tight" title={data.label}>
          {data.label}
        </span>
      </div>

      {data.subtitle && (
        <p className="text-[10px] text-muted-foreground truncate ml-8 leading-tight" title={data.subtitle}>
          {data.subtitle}
        </p>
      )}

      {/* Badges row */}
      <div className="flex items-center gap-1 mt-0.5 flex-wrap ml-8">
        {data.certainty && (
          <span className={`inline-flex px-1 py-px text-[9px] font-bold uppercase tracking-wide rounded border ${CERTAINTY_BADGE[data.certainty] ?? ""}`}>
            {data.certainty}
          </span>
        )}
        {(() => {
          const r = data.retrieval as RetrievalMetadata | undefined
          if (!r) return null
          if (r.method === "HYBRID") return (
            <span className="inline-flex px-1 py-px text-[9px] font-bold uppercase tracking-wide rounded border bg-accent/10 text-accent border-accent/30">
              HYBRID
            </span>
          )
          if (r.method === "VECTOR") return (
            <span className="inline-flex px-1 py-px text-[9px] font-bold uppercase tracking-wide rounded border bg-info/10 text-info border-info/30">
              VECTOR
            </span>
          )
          return null
        })()}
      </div>
    </div>
  )
})
