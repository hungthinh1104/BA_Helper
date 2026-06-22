import { AlertTriangle, ShieldAlert, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ScanJobProgress } from "@/components/workspace/repository/scan-job-progress"
import type { DiagnosticItem, RepositoryDetailResponse } from "@ba-helper/contracts"

interface RepositorySnapshotBannerProps {
  job: RepositoryDetailResponse["latestScanJob"] | undefined | null
  latestSnapshot: RepositoryDetailResponse["latestSnapshot"] | undefined | null
  isPartial: boolean
  isBlocked: boolean
  canScan: boolean
  isRetrying: boolean
  primaryDiagnostic?: DiagnosticItem
  onRetryScan: () => void
}

function getFailureGuidance(errorCode?: string, message?: string) {
  if (errorCode === "CLONE_FAILED" && message?.includes("spawn git ENOENT")) {
    return "Scanner runtime is missing the git binary. Rebuild or restart the API/worker runtime with git installed, then rerun the scan."
  }

  if (errorCode === "UNSUPPORTED_FRAMEWORK") {
    return "This repository uses an unsupported language or framework. The analyzer currently supports TypeScript/NestJS (STABLE) and Java/Spring Boot (PARTIAL). Other frameworks are considered EXPERIMENTAL capability proofs."
  }

  if (errorCode === "SECURITY_RISK_BLOCKED") {
    return "The repository was blocked by security guardrails. Check diagnostics to see which rule stopped ingestion before retrying."
  }

  return "Check the diagnostics below, fix the runtime or repository issue, and rerun the scan."
}

export function RepositorySnapshotBanner({
  job,
  latestSnapshot,
  isPartial,
  isBlocked,
  canScan,
  isRetrying,
  primaryDiagnostic,
  onRetryScan,
}: RepositorySnapshotBannerProps) {
  const failureGuidance = getFailureGuidance(job?.error?.code, job?.error?.message ?? primaryDiagnostic?.message)

  return (
    <div className="flex flex-col gap-3 p-5 rounded-xl border border-border/40 bg-surface/50 backdrop-blur-xl shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1 w-full max-w-sm">
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Current Snapshot</span>
          <div className="mt-1">
            {job ? (
              <ScanJobProgress job={job} snapshot={latestSnapshot || undefined} />
            ) : (
              <span className="text-[12px] font-medium text-muted-foreground">No jobs</span>
            )}
          </div>
        </div>
        {isPartial && !isBlocked && (
          <div className="flex items-center gap-2 px-3 py-2 bg-warning/10 border border-warning/25 rounded-lg shrink-0">
            <AlertTriangle className="w-4 h-4 text-warning" />
            <div className="flex flex-col">
              <span className="text-[12px] font-bold text-warning">PARTIAL Coverage</span>
            </div>
          </div>
        )}
        {isBlocked && (
          <div className="flex items-center gap-2 px-3 py-2 bg-danger/10 border border-danger/25 rounded-lg shrink-0">
            <ShieldAlert className="w-4 h-4 text-danger" />
            <div className="flex flex-col">
              <span className="text-[12px] font-bold text-danger">BLOCKED</span>
            </div>
          </div>
        )}
      </div>

      {isPartial && !isBlocked && (
        <p className="text-[12px] text-warning/90 mt-1 px-1">
          Partial snapshot: some files were skipped due to scan limits or security rules. The analysis may miss impacts in skipped files.
        </p>
      )}

      {isBlocked && (
        <p className="text-[12px] font-medium text-danger/90 mt-1 px-1">
          Scan blocked for security risk. No repository content was sent to LLM or embedding providers.
        </p>
      )}

      {job?.status === "FAILED" && (
        <div className="mt-2 flex items-center justify-between p-3 rounded-lg border border-danger/30 bg-danger/5">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-4 h-4 text-danger shrink-0" />
            <div className="flex flex-col gap-1">
              <span className="text-[13px] text-danger/90 font-medium">
                {job.error?.code ? `Scan failed: ${job.error.code}` : "Scan failed"}
              </span>
              <span className="text-[12px] text-danger/80">
                {job.error?.message || primaryDiagnostic?.message || "Please check diagnostics or try again."}
              </span>
            </div>
          </div>
          <Button 
            size="sm" 
            variant="outline" 
            className={`h-8 border-danger/20 ${!canScan ? 'opacity-50 cursor-not-allowed text-danger' : 'hover:bg-danger/10 hover:text-danger text-danger'}`}
            onClick={() => canScan && onRetryScan()}
            disabled={isRetrying || !canScan}
            title={!canScan ? "Maintainer role required to run scans." : undefined}
          >
            {isRetrying ? "Retrying..." : "Rerun Scan"}
          </Button>
        </div>
      )}

      {job?.status === "FAILED" && (
        <div className="rounded-lg border border-warning/20 bg-warning/5 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-warning mb-1">
            Recommended action
          </p>
          <p className="text-[12px] text-foreground/85">
            {failureGuidance}
          </p>
        </div>
      )}
    </div>
  )
}
