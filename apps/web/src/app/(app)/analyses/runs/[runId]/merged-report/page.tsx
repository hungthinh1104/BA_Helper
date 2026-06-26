"use client"

import { use } from "react"
import Link from "next/link"
import { notFound } from "next/navigation"
import { AlertCircle, CheckCircle2, FileWarning, MessageSquareWarning, XCircle } from "lucide-react"
import { WorkspacePageHeader } from "@/components/workspace/shared/page-header"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useApprovedMultiRepoReport, useCreateMergedMultiRepoReportReviewDecision, useFinalizeMultiRepoReport, useLatestMergedMultiRepoReportReviewDecision, useMergedMultiRepoReportReviewDecisions, useMultiRepoAnalysisRunDetail } from "@/hooks/api/use-analyses"
import { toast } from "sonner"
import { apiGetFile } from "@/lib/api-client"
import { canFinalizeAnalysis, canReview as canReviewPermission } from "@/lib/permissions"
import { useCurrentWorkspace } from "@/lib/project-context"
import { useState } from "react"
import { ReportMarkdown } from "@/components/report/report-markdown"
import { MergedReportActions } from "./_components/merged-report-actions"
import { MergedReportReviewPanel } from "./_components/merged-report-review-panel"

const MERGED_REPORT_STATUS_LABEL: Record<string, string> = {
  NOT_CREATED: "Not created",
  CURRENT: "Current",
  STALE: "Stale",
  BLOCKED: "Blocked",
}

export default function ApprovedMultiRepoReportPage({
  params,
}: {
  params: Promise<{ runId: string }>
}) {
  const { runId } = use(params)
  const { data: runDetail } = useMultiRepoAnalysisRunDetail(runId)
  const { data, isLoading, error } = useApprovedMultiRepoReport(runId)
  const { data: latestDecision, error: latestDecisionError } = useLatestMergedMultiRepoReportReviewDecision(runId)
  const { data: reviewDecisionsData, isLoading: reviewDecisionsLoading } = useMergedMultiRepoReportReviewDecisions(runId)
  const finalizeReport = useFinalizeMultiRepoReport(runId)
  const createReviewDecision = useCreateMergedMultiRepoReportReviewDecision(runId)
  const workspace = useCurrentWorkspace()
  const [exportingFormat, setExportingFormat] = useState<"md" | "pdf" | null>(null)

  const status = (error as { status?: number } | undefined)?.status
  const code = (error as { code?: string } | undefined)?.code
  const latestDecisionCode = (latestDecisionError as { code?: string } | undefined)?.code

  if (status === 404 && code !== "MERGED_MULTI_REPO_REPORT_NOT_FOUND") {
    notFound()
  }

  const canFinalize = workspace
    ? canFinalizeAnalysis(workspace.membershipRole) &&
      Boolean(
        data?.capabilities.canRefreshMergedReport ||
          runDetail?.capabilities.canFinalizeMergedReport ||
          runDetail?.capabilities.canRefreshMergedReport,
      )
    : false
  const canExport = Boolean(data?.capabilities.canExportMergedReport)
  const canReview = workspace
    ? canReviewPermission(workspace.membershipRole) &&
      Boolean(data?.capabilities.canReviewMergedReport)
    : false
  const reviewDecisions = reviewDecisionsData?.items ?? []
  const latestReviewedDecision = latestDecisionCode === "MERGED_MULTI_REPO_REPORT_NOT_FOUND" ? null : latestDecision

  const handleFinalize = async () => {
    try {
      await finalizeReport.mutateAsync()
      toast.success("Merged report finalized.")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to finalize merged report.")
    }
  }

  const handleExport = async (format: "md" | "pdf") => {
    if (!data || !canExport) return

    setExportingFormat(format)
    try {
      const file = await apiGetFile(
        `/api/v1/multi-repo-runs/${runId}/merged-report/export.${format}`,
      )
      const url = URL.createObjectURL(file.blob)
      const anchor = document.createElement("a")
      anchor.href = url
      anchor.download = file.filename
      document.body.appendChild(anchor)
      anchor.click()
      document.body.removeChild(anchor)
      URL.revokeObjectURL(url)
      toast.success("Merged report exported.", {
        description: file.filename,
      })
    } catch (error) {
      toast.error("Export failed", {
        description: error instanceof Error ? error.message : "Failed to export merged report.",
      })
    } finally {
      setExportingFormat(null)
    }
  }

  const handleSubmitReview = async (formData: { decision: "ACCEPTED" | "REJECTED" | "NEEDS_MORE_CLARIFICATION"; note: string }) => {
    try {
      await createReviewDecision.mutateAsync({
        data: {
          decision: formData.decision,
          note: formData.note.trim() || undefined,
        },
      })
      toast.success("Merged report review decision recorded.")
    } catch (error) {
      toast.error("Failed to submit merged report review decision.", {
        description: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  const decisionMeta = latestReviewedDecision?.decision
    ? {
        ACCEPTED: {
          label: "Accepted",
          icon: <CheckCircle2 className="w-3.5 h-3.5" />,
          variant: "default" as const,
        },
        REJECTED: {
          label: "Rejected",
          icon: <XCircle className="w-3.5 h-3.5" />,
          variant: "destructive" as const,
        },
        NEEDS_MORE_CLARIFICATION: {
          label: "Needs More Clarification",
          icon: <MessageSquareWarning className="w-3.5 h-3.5" />,
          variant: "secondary" as const,
        },
      }[latestReviewedDecision.decision as "ACCEPTED" | "REJECTED" | "NEEDS_MORE_CLARIFICATION"]
    : null

  return (
    <div className="app-page-scroll">
      <div className="max-w-5xl mx-auto w-full py-4">
        <WorkspacePageHeader
          title="Approved Merged Report"
          description={
            data
              ? `${data.requirementTitle} • approved ${new Date(data.approvedAt).toLocaleString("en-US")}`
              : "Persisted approved merged Markdown snapshot for the multi-repo run."
          }
        >
          <div className="flex items-center gap-2">
            <Link href={`/analyses/runs/${runId}`} className="text-[12px] text-muted-foreground hover:text-foreground">
              Back to run
            </Link>
          </div>
        </WorkspacePageHeader>

        {isLoading && (
          <div className="space-y-4">
            <Skeleton className="h-10 w-2/3" />
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        )}

        {error && !isLoading && code === "MERGED_MULTI_REPO_REPORT_NOT_FOUND" && (
          <div className="flex flex-col items-center justify-center p-12 text-muted-foreground border rounded-xl bg-surface-muted/30">
            <AlertCircle className="w-8 h-8 text-warning mb-3" />
            <p className="font-medium text-foreground">No approved merged report yet</p>
            <p className="text-[13px] text-center max-w-xl mb-4">
              Finalize the merged report to persist an approved Markdown snapshot for this run.
            </p>
            <Button
              size="sm"
              className="h-8 shadow-none"
              onClick={() => void handleFinalize()}
              disabled={!canFinalize || finalizeReport.isPending}
            >
              {finalizeReport.isPending ? "Finalizing..." : "Finalize merged report"}
            </Button>
          </div>
        )}

        {error && !isLoading && code !== "MERGED_MULTI_REPO_REPORT_NOT_FOUND" && (
          <div className="flex flex-col items-center justify-center p-12 text-muted-foreground border rounded-xl bg-surface-muted/30">
            <AlertCircle className="w-8 h-8 text-destructive mb-3" />
            <p className="font-medium text-foreground">Failed to load approved merged report</p>
            <p className="text-[13px] text-center max-w-xl">{error.message}</p>
          </div>
        )}

        {data && (
          <div className="rounded-xl border border-border/50 bg-surface/40 p-6">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <Badge variant={data.mergedReportStatus === "CURRENT" ? "default" : data.mergedReportStatus === "STALE" ? "secondary" : "outline"}>
                {MERGED_REPORT_STATUS_LABEL[data.mergedReportStatus] ?? data.mergedReportStatus}
              </Badge>
              {data.capabilities.blockedReasons.length > 0 && data.mergedReportStatus !== "CURRENT" && (
                <span className="text-[12px] text-muted-foreground">
                  Blocked by {data.capabilities.blockedReasons.join(", ")}
                </span>
              )}
            </div>

            {data.isStale && (
              <div className="flex items-start gap-3 p-4 mb-6 bg-warning/10 border border-warning/25 rounded-lg text-warning">
                <FileWarning className="w-5 h-5 shrink-0 mt-0.5" />
                <div className="flex flex-col gap-1">
                  <span className="font-semibold text-[13px] uppercase tracking-wider">Stale Report Warning</span>
                  <span className="text-[13px] text-warning/80">
                    {data.staleReason || "Child analysis state changed after approval."} Export is blocked until the snapshot is refreshed and approved again.
                  </span>
                </div>
              </div>
            )}

            <div className="mb-6 flex flex-wrap items-center gap-3 text-[12px] text-muted-foreground">
              <span>Run: <span className="font-mono">{data.runId}</span></span>
              <span>Requirement: <span className="text-foreground">{data.requirementTitle}</span></span>
              <span>Child analyses: {data.provenance.childAnalyses.length}</span>
              <span className="flex items-center gap-2">
                Latest merged review:
                {decisionMeta ? (
                  <Badge variant={decisionMeta.variant} className="h-6 gap-1.5 px-2">
                    {decisionMeta.icon}
                    {decisionMeta.label}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="h-6">Pending</Badge>
                )}
              </span>
              <MergedReportActions
                isStale={data.isStale}
                canExport={canExport}
                canFinalize={canFinalize}
                isFinalizing={finalizeReport.isPending}
                exportingFormat={exportingFormat}
                onExport={handleExport}
                onRefresh={handleFinalize}
              />
            </div>

            <MergedReportReviewPanel
              isStale={data.isStale}
              latestReviewedDecision={latestReviewedDecision}
              reviewDecisions={reviewDecisions}
              reviewDecisionsLoading={reviewDecisionsLoading}
              canReview={canReview}
              hasReviewPermission={canReviewPermission(workspace?.membershipRole ?? null)}
              isSubmitting={createReviewDecision.isPending}
              onSubmitReview={handleSubmitReview}
            />

            <ReportMarkdown markdown={data.markdown} />
          </div>
        )}
      </div>
    </div>
  )
}
