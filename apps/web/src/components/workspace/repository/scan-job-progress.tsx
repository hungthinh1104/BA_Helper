"use client"

import { RepositoryListItemResponse } from "@ba-helper/contracts"

type ScanJob = NonNullable<RepositoryListItemResponse["latestScanJob"]>

interface ScanJobProgressProps {
  job: ScanJob
  snapshot?: RepositoryListItemResponse["latestSnapshot"]
}

import { ScanStatusBadge } from "@/components/workspace/shared/status-badges"

export function ScanJobStatus({ job }: { job: ScanJob }) {
  return <ScanStatusBadge status={job.status} />
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
