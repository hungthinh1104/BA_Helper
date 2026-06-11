"use client"

import { RepositoryListItemResponse } from "@ba-helper/contracts"

type ScanJob = NonNullable<RepositoryListItemResponse["latestScanJob"]>

interface ScanJobProgressProps {
  job: ScanJob
  snapshot?: RepositoryListItemResponse["latestSnapshot"]
}

const STATUS_CONFIG = {
  QUEUED:      { dot: "bg-border animate-pulse", label: "Queued", textClass: "text-muted-foreground" },
  RUNNING:     { dot: "bg-primary animate-pulse", label: "Scanning", textClass: "text-primary" },
  COMPLETED:   { dot: "bg-success", label: "Indexed", textClass: "text-success" },
  FAILED:      { dot: "bg-danger", label: "Failed", textClass: "text-danger" },
  CANCELLED:   { dot: "bg-muted-foreground", label: "Cancelled", textClass: "text-muted-foreground" },
}

export function ScanJobStatus({ job }: { job: ScanJob }) {
  const cfg = STATUS_CONFIG[job.status] || STATUS_CONFIG.QUEUED
  return (
    <div className="flex items-center gap-1.5">
      <span className={`w-2 h-2 rounded-full shrink-0 ${cfg.dot}`} />
      <span className={`text-[12px] font-medium ${cfg.textClass}`}>{cfg.label}</span>
    </div>
  )
}

export function ScanJobProgress({ job, snapshot }: ScanJobProgressProps) {
  if (job.status === "COMPLETED" || job.status === "FAILED" || job.status === "CANCELLED") {
    return (
      <div className="flex items-center gap-2">
        <ScanJobStatus job={job} />
        {snapshot?.commitSha && (
          <span className="font-mono text-[11px] text-muted-foreground/60">@ {snapshot.commitSha.substring(0, 7)}</span>
        )}
        {snapshot?.coverageStatus === "PARTIAL" && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-warning/10 text-warning border border-warning/25 font-medium uppercase">Partial</span>
        )}
      </div>
    )
  }

  // Active state
  return (
    <div className="flex flex-col gap-1.5 min-w-[120px]">
      <div className="flex items-center justify-between">
        <ScanJobStatus job={job} />
        <span className="text-[10px] text-muted-foreground/60 font-medium font-mono">{job.progress}%</span>
      </div>
      <div className="h-1.5 w-full bg-border rounded-full overflow-hidden">
        <div 
          className="h-full bg-primary transition-all duration-500 ease-out rounded-full"
          style={{ width: `${job.progress}%` }}
        />
      </div>
      <span className="text-[10px] text-muted-foreground truncate">{job.stage}</span>
    </div>
  )
}
