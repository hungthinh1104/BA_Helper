"use client"

import * as React from "react"
import { use } from "react"
import Link from "next/link"
import { notFound } from "next/navigation"
import { AlertCircle, GitBranch } from "lucide-react"
import { WorkspacePageHeader } from "@/components/workspace/page-header"
import { DataList, DataListCell, DataListHeader, DataListRow } from "@/components/workspace/data-list"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { useApprovedMultiRepoReport, useMultiRepoAnalysisRunDetail, useFinalizeMultiRepoReport } from "@/hooks/api/use-analyses"
import { useAuth } from "@/hooks/use-auth"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ImpactMatrixTable } from "@/components/workspace/impact-matrix-table"
import { MatrixRowDetailDrawer } from "@/components/workspace/matrix-row-detail-drawer"

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  QUEUED:             { label: "Queued",       className: "bg-border text-muted-foreground border-border/50" },
  RUNNING:            { label: "Running",      className: "bg-primary/10 text-primary border-primary/50" },
  WAITING_FOR_REVIEW: { label: "Needs Review", className: "bg-warning/10 text-warning border-warning/50" },
  COMPLETED:          { label: "Completed",    className: "bg-success/10 text-success border-success/50" },
  FAILED:             { label: "Failed",       className: "bg-destructive/10 text-destructive border-destructive/50" },
  CANCELLED:          { label: "Cancelled",    className: "bg-muted text-muted-foreground border-border/50" },
}

const gridCols = "minmax(180px, 1.8fr) minmax(120px, 1fr) 130px 110px minmax(150px, 1.3fr) minmax(120px, 1fr)"

const BLOCKING_REASON_LABEL: Record<string, string> = {
  FAILED: "Failed",
  NOT_COMPLETED: "Not completed",
  WAITING_FOR_REVIEW: "Waiting for review",
  NEEDS_MORE_CLARIFICATION: "Needs clarification",
  REJECTED: "Rejected",
  NONE: "Ready",
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

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



export default function MultiRepoAnalysisRunDetailPage({
  params,
}: {
  params: Promise<{ runId: string }>
}) {
  const { runId } = use(params)
  const { data, isLoading, error } = useMultiRepoAnalysisRunDetail(runId)
  const { data: approvedReport, error: approvedReportError } = useApprovedMultiRepoReport(runId)
  const finalizeReport = useFinalizeMultiRepoReport(runId)
  const { role } = useAuth()
  const router = useRouter()
  const [selectedAnalysisId, setSelectedAnalysisId] = React.useState<string | null>(null)

  if (error && (error as { status?: number }).status === 404) {
    notFound()
  }

  const canFinalizeMergedReport =
    role === "ADMIN" && Boolean(data?.runReadiness.canStartMergedReport)
  const hasApprovedMergedReport =
    Boolean(approvedReport) ||
    (approvedReportError as { code?: string } | undefined)?.code !== "MERGED_MULTI_REPO_REPORT_NOT_FOUND"

  const handleFinalizeMergedReport = async () => {
    try {
      await finalizeReport.mutateAsync()
      toast.success("Merged report finalized.")
      router.push(`/analyses/runs/${runId}/merged-report`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to finalize merged report.")
    }
  }

  return (
    <div className="app-page-scroll">
      <div className="max-w-5xl mx-auto w-full py-4">
        <WorkspacePageHeader
          title="Multi-repo Analysis Run"
          description={
            data ? (
              <div className="space-y-1">
                <div>
                  Requirement: <span className="font-medium text-foreground">{data.requirementTitle}</span>
                </div>
                <div>
                  Created by {data.createdBy} on {formatDate(data.createdAt)}
                </div>
              </div>
            ) : (
              "Grouped child analyses created from one multi-repo request."
            )
          }
        >
          <div className="flex items-center gap-2">
            {data && (
              data.runReadiness.canStartMergedReport ? (
                <>
                  <Link
                    href={`/analyses/runs/${runId}/merged-report`}
                    className="text-[12px] text-primary hover:text-primary/80"
                  >
                    View merged report
                  </Link>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 shadow-none"
                    onClick={() => void handleFinalizeMergedReport()}
                    disabled={!canFinalizeMergedReport || finalizeReport.isPending}
                  >
                    {finalizeReport.isPending ? "Finalizing..." : "Finalize merged report"}
                  </Button>
                </>
              ) : hasApprovedMergedReport ? (
                <>
                  <Link
                    href={`/analyses/runs/${runId}/merged-report`}
                    className="text-[12px] text-primary hover:text-primary/80"
                  >
                    View approved merged report
                  </Link>
                  <span
                    className="text-[12px] text-muted-foreground"
                    title="Merged report exists, but the run is not currently ready for a fresh merged snapshot."
                  >
                    Refresh blocked until child analyses are accepted again
                  </span>
                </>
              ) : (
                <span
                  className="text-[12px] text-muted-foreground"
                  title="Every child analysis must have latest review decision ACCEPTED."
                >
                  Merged report not ready
                </span>
              )
            )}
            <Link href="/analyses/runs" className="text-[12px] text-muted-foreground hover:text-foreground">
              Back to runs
            </Link>
          </div>
        </WorkspacePageHeader>

        {data && (
          <div className="mb-4 space-y-4">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
              <SummaryCard label="Total" value={data.runReadiness.totalAnalyses} />
              <SummaryCard label="Completed" value={data.runReadiness.completedAnalyses} tone="success" />
              <SummaryCard label="Failed" value={data.runReadiness.failedAnalyses} tone={data.runReadiness.hasFailures ? "destructive" : "muted"} />
              <SummaryCard label="Needs Review" value={data.runReadiness.waitingForReviewAnalyses} tone={data.runReadiness.waitingForReviewAnalyses > 0 ? "warning" : "muted"} />
              <SummaryCard label="Accepted" value={data.childReviewSummary.accepted} tone="success" />
              <SummaryCard label="Pending Review" value={data.childReviewSummary.pendingReview} tone={data.childReviewSummary.pendingReview > 0 ? "warning" : "muted"} />
              <SummaryCard
                label="Merged Ready"
                value={data.runReadiness.canStartMergedReport ? "Yes" : "No"}
                tone={data.runReadiness.canStartMergedReport ? "success" : "muted"}
              />
            </div>

            <div className="rounded-lg border border-border/50 bg-surface px-3 py-2 text-[12px] text-muted-foreground">
              Review summary: accepted {data.childReviewSummary.accepted} • rejected {data.childReviewSummary.rejected} • needs clarification {data.childReviewSummary.needsMoreClarification} • pending {data.childReviewSummary.pendingReview}
            </div>
          </div>
        )}

        <Tabs defaultValue="matrix" className="mt-6">
          <TabsList>
            <TabsTrigger value="matrix">Impact Matrix</TabsTrigger>
            <TabsTrigger value="list">Child Analyses</TabsTrigger>
          </TabsList>
          
          <TabsContent value="matrix" className="mt-4">
            <ImpactMatrixTable runId={runId} onViewDetails={setSelectedAnalysisId} />
          </TabsContent>
          
          <TabsContent value="list" className="mt-4">
            <DataList>
              <DataListHeader gridCols={gridCols}>
                <DataListCell>Repository</DataListCell>
                <DataListCell>Commit</DataListCell>
                <DataListCell>Status</DataListCell>
                <DataListCell>Freshness</DataListCell>
                <DataListCell>Latest Review</DataListCell>
                <DataListCell>Blocking</DataListCell>
              </DataListHeader>

              {isLoading && (
                <>
                  {[1, 2, 3].map((item) => (
                    <DataListRow key={item} gridCols={gridCols}>
                      <DataListCell><Skeleton className="h-4 w-[180px]" /></DataListCell>
                      <DataListCell><Skeleton className="h-4 w-[100px]" /></DataListCell>
                      <DataListCell><Skeleton className="h-5 w-[80px] rounded-md" /></DataListCell>
                      <DataListCell><Skeleton className="h-4 w-[70px]" /></DataListCell>
                      <DataListCell><Skeleton className="h-4 w-[120px]" /></DataListCell>
                      <DataListCell><Skeleton className="h-4 w-[90px]" /></DataListCell>
                    </DataListRow>
                  ))}
                </>
              )}

              {error && !isLoading && (
                <div className="flex flex-col items-center py-16 text-muted-foreground">
                  <AlertCircle className="w-6 h-6 text-destructive mb-4" />
                  <p className="text-[13px] font-medium text-foreground">Failed to load multi-repo run</p>
                  <p className="text-[12px]">{error.message}</p>
                </div>
              )}

              {data?.items.map((item) => {
                const badge = STATUS_BADGE[item.status] ?? STATUS_BADGE.QUEUED

                return (
                  <DataListRow
                    key={item.analysisId}
                    gridCols={gridCols}
                    href={`/analyses/${item.analysisId}`}
                  >
                    <DataListCell>
                      <div className="font-medium text-[13px] text-foreground leading-snug">{item.repositoryDisplayName}</div>
                      <div className="text-muted-foreground text-[11px] font-mono mt-0.5">{item.analysisId}</div>
                    </DataListCell>
                    <DataListCell>
                      <div className="flex items-center gap-1.5 text-[12px] text-muted-foreground font-mono">
                        <GitBranch className="w-3.5 h-3.5" />
                        {item.commitSha.substring(0, 7)}
                      </div>
                    </DataListCell>
                    <DataListCell>
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 border rounded-md text-[10px] font-semibold tracking-wide uppercase ${badge.className}`}>
                        {badge.label}
                      </span>
                    </DataListCell>
                    <DataListCell>
                      <span className={`text-[12px] ${item.isStale ? "text-warning" : "text-muted-foreground"}`}>
                        {item.isStale ? "Stale" : "Current"}
                      </span>
                    </DataListCell>
                    <DataListCell>
                      {item.latestReviewDecision ? (
                        <div className="space-y-0.5">
                          <div className="text-[12px] text-foreground">
                            {item.latestReviewDecision === "NEEDS_MORE_CLARIFICATION"
                              ? "Needs clarification"
                              : item.latestReviewDecision.charAt(0) + item.latestReviewDecision.slice(1).toLowerCase()}
                          </div>
                          <div className="text-[11px] text-muted-foreground">
                            {item.reviewedBy ?? "Unknown"}
                            {item.latestReviewDecisionAt ? ` • ${formatDate(item.latestReviewDecisionAt)}` : ""}
                          </div>
                        </div>
                      ) : (
                        <span className="text-[12px] text-muted-foreground">Pending review</span>
                      )}
                    </DataListCell>
                    <DataListCell>
                      <span className={`text-[12px] ${item.blockingReason === "NONE" ? "text-success" : "text-warning"}`}>
                        {BLOCKING_REASON_LABEL[item.blockingReason]}
                      </span>
                    </DataListCell>
                  </DataListRow>
                )
              })}
            </DataList>
          </TabsContent>
        </Tabs>
      </div>
      <MatrixRowDetailDrawer
        runId={runId}
        analysisId={selectedAnalysisId}
        open={selectedAnalysisId !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedAnalysisId(null)
        }}
      />
    </div>
  )
}
