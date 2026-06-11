import React from "react"
import Link from "next/link"
import { AlertCircle, CheckCircle2, ShieldAlert } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useReviewCoverage } from "@/hooks/api/use-review-coverage"
import { ReviewCoverageGate } from "@ba-helper/contracts"

function SummaryCard({
  label,
  value,
  tone = "muted",
}: {
  label: string
  value: string | number
  tone?: "muted" | "success" | "warning" | "destructive"
}) {
  const toneClass =
    tone === "success"
      ? "border-success/30 text-success"
      : tone === "warning"
        ? "border-warning/30 text-warning"
        : tone === "destructive"
          ? "border-destructive/30 text-destructive"
          : "border-border/50 text-foreground"

  return (
    <div className={`rounded-lg border bg-surface px-3 py-2 ${toneClass}`}>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-[16px] font-semibold">{value}</div>
    </div>
  )
}

function GateStatusBadge({ status }: { status: "PASS" | "WARN" | "FAIL" }) {
  if (status === "PASS") {
    return (
      <span className="inline-flex items-center gap-1 rounded-md border border-success/30 bg-success/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-success">
        <CheckCircle2 className="h-3 w-3" />
        Pass
      </span>
    )
  }
  if (status === "WARN") {
    return (
      <span className="inline-flex items-center gap-1 rounded-md border border-warning/30 bg-warning/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-warning">
        <AlertCircle className="h-3 w-3" />
        Warn
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-destructive/30 bg-destructive/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-destructive">
      <ShieldAlert className="h-3 w-3" />
      Fail
    </span>
  )
}

function GateItem({ gate }: { gate: ReviewCoverageGate }) {
  const affectedAnalysisCount = gate.affectedAnalysisIds?.length ?? 0
  const affectedArtifactCount = gate.affectedArtifactIds?.length ?? 0
  const affectedInsightCount = gate.affectedInsightIds?.length ?? 0
  const affectedRepoCount = gate.affectedRepositoryIds?.length ?? 0

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border/50 bg-surface/50 p-3 text-[13px] transition-colors hover:bg-surface">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <GateStatusBadge status={gate.status} />
            <span className="font-semibold text-foreground">{gate.title}</span>
          </div>
          <div className="text-muted-foreground">{gate.description}</div>
        </div>
        <div className="shrink-0 text-right text-[11px] font-mono text-muted-foreground">
          {gate.category}
        </div>
      </div>

      <div className="mt-1 space-y-2">
        {gate.recommendedAction && (
          <div className="rounded border border-primary/20 bg-primary/5 px-2 py-1.5 text-[12px] text-foreground">
            <span className="font-medium text-primary">Action: </span>
            {gate.recommendedAction}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
          {affectedRepoCount > 0 && <span>{affectedRepoCount} repositories affected</span>}
          {affectedArtifactCount > 0 && <span>{affectedArtifactCount} artifacts affected</span>}
          {affectedInsightCount > 0 && <span>{affectedInsightCount} insights affected</span>}
          
          {affectedAnalysisCount > 0 && (
            <div className="flex items-center gap-1">
              <span>Analyses:</span>
              <div className="flex flex-wrap items-center gap-1">
                {gate.affectedAnalysisIds!.map((id) => (
                  <Link
                    key={id}
                    href={`/analyses/${id}`}
                    className="font-mono text-primary hover:underline"
                  >
                    {id.substring(0, 8)}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export function ReviewCoveragePanel({ runId }: { runId: string }) {
  const { data, isLoading, isError } = useReviewCoverage(runId)

  if (isLoading) {
    return (
      <div className="mb-6 space-y-4">
        <div className="text-lg font-semibold tracking-tight">Review Coverage</div>
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <div className="space-y-4">
            <Skeleton className="h-10 w-full max-w-sm" />
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
              {[...Array(6)].map((_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (isError) {
    return (
      <div className="mb-6 space-y-4">
        <div className="text-lg font-semibold tracking-tight">Review Coverage</div>
        <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-[13px] text-destructive shadow-sm">
          <AlertCircle className="mr-2 inline-block h-4 w-4" />
          Unable to load review coverage.
        </div>
      </div>
    )
  }

  if (!data) return null

  return (
    <div className="mb-6 space-y-4">
      <div className="text-lg font-semibold tracking-tight">Review Coverage</div>
      
      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        <div className="p-4 border-b bg-muted/20">
          <div className="flex items-center gap-3">
            {data.status === "PASS" && (
              <div className="flex items-center gap-2 text-success">
                <CheckCircle2 className="h-5 w-5" />
                <span className="font-semibold uppercase tracking-wide">PASS: No review coverage gaps detected.</span>
              </div>
            )}
            {data.status === "WARN" && (
              <div className="flex items-center gap-2 text-warning">
                <AlertCircle className="h-5 w-5" />
                <span className="font-semibold uppercase tracking-wide">WARN: Some review coverage gaps need attention. This does not block report export.</span>
              </div>
            )}
            {data.status === "FAIL" && (
              <div className="flex items-center gap-2 text-destructive">
                <ShieldAlert className="h-5 w-5" />
                <span className="font-semibold uppercase tracking-wide">FAIL: Review readiness issues were detected. This does not automatically block report export.</span>
              </div>
            )}
          </div>
        </div>

        <div className="p-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6 mb-6">
            <SummaryCard label="Repos Accepted" value={data.summary.acceptedRepositories} tone="muted" />
            <SummaryCard label="Impacted Artifacts" value={data.summary.impactedArtifacts} tone="muted" />
            <SummaryCard 
              label="Uncovered Artifacts" 
              value={data.summary.uncoveredArtifacts} 
              tone={data.summary.uncoveredArtifacts > 0 ? "warning" : "success"} 
            />
            <SummaryCard 
              label="Risks Without QA" 
              value={data.summary.risksWithoutQa} 
              tone={data.summary.risksWithoutQa > 0 ? "warning" : "success"} 
            />
            <SummaryCard 
              label="Warning Gates" 
              value={data.summary.warningGates} 
              tone={data.summary.warningGates > 0 ? "warning" : "success"} 
            />
            <SummaryCard 
              label="Blocking Gates" 
              value={data.summary.blockingGates} 
              tone={data.summary.blockingGates > 0 ? "destructive" : "success"} 
            />
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-medium">Coverage Gates</h3>
            {data.gates.length === 0 ? (
              <div className="text-[13px] text-muted-foreground italic">
                {data.status === "PASS" ? "No review coverage gaps detected." : "No gate data available."}
              </div>
            ) : (
              <ScrollArea className="h-[400px] rounded-md border pr-4">
                <div className="flex flex-col gap-3 p-1">
                  {data.gates.map((gate) => (
                    <GateItem key={gate.gateId} gate={gate} />
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
