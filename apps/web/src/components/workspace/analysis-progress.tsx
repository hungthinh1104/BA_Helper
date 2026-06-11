"use client"

import { ImpactAnalysisResponse } from "@ba-helper/contracts"

interface AnalysisProgressProps {
  analysis: ImpactAnalysisResponse
}

const STATUS_CONFIG = {
  QUEUED:      { dot: "bg-border animate-pulse", label: "Queued", textClass: "text-muted-foreground" },
  RUNNING:     { dot: "bg-primary animate-pulse", label: "Analyzing", textClass: "text-primary" },
  WAITING_FOR_REVIEW: { dot: "bg-warning", label: "Needs Review", textClass: "text-warning" },
  COMPLETED:   { dot: "bg-success", label: "Completed", textClass: "text-success" },
  FAILED:      { dot: "bg-danger", label: "Failed", textClass: "text-danger" },
  CANCELLED:   { dot: "bg-muted-foreground", label: "Cancelled", textClass: "text-muted-foreground" },
}

export function AnalysisStatus({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.QUEUED
  return (
    <div className="flex items-center gap-1.5">
      <span className={`w-2 h-2 rounded-full shrink-0 ${cfg.dot}`} />
      <span className={`text-[12px] font-medium ${cfg.textClass}`}>{cfg.label}</span>
    </div>
  )
}

export function AnalysisProgress({ analysis }: AnalysisProgressProps) {
  return (
    <div className="flex flex-col gap-2 w-full max-w-md py-4">
      <div className="flex items-center justify-between">
        <AnalysisStatus status={analysis.status} />
        <span className="text-[11px] text-muted-foreground/80 font-medium font-mono">{analysis.progress}%</span>
      </div>
      <div className="h-2 w-full bg-border rounded-full overflow-hidden">
        <div 
          className="h-full bg-primary transition-all duration-500 ease-out rounded-full"
          style={{ width: `${analysis.progress}%` }}
        />
      </div>
      <span className="text-[11px] text-muted-foreground truncate">{analysis.stage}</span>
    </div>
  )
}
