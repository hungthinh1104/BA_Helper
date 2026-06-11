"use client"

import { use } from "react"
import Link from "next/link"
import { notFound } from "next/navigation"
import { AlertCircle, CheckCircle2, Download, FileWarning, Loader2, MessageSquareWarning, ShieldCheck, XCircle } from "lucide-react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { WorkspacePageHeader } from "@/components/workspace/page-header"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { useApprovedMultiRepoReport, useCreateMergedMultiRepoReportReviewDecision, useFinalizeMultiRepoReport, useLatestMergedMultiRepoReportReviewDecision, useMergedMultiRepoReportReviewDecisions, useMultiRepoAnalysisRunDetail } from "@/hooks/api/use-analyses"
import { useAuth } from "@/hooks/use-auth"
import { toast } from "sonner"
import { apiGetFile } from "@/lib/api-client"
import { useState } from "react"

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
  const { role } = useAuth()
  const [exportingFormat, setExportingFormat] = useState<"md" | "pdf" | null>(null)
  const [decision, setDecision] = useState<"ACCEPTED" | "REJECTED" | "NEEDS_MORE_CLARIFICATION" | null>(null)
  const [note, setNote] = useState("")

  const status = (error as { status?: number } | undefined)?.status
  const code = (error as { code?: string } | undefined)?.code
  const latestDecisionCode = (latestDecisionError as { code?: string } | undefined)?.code

  if (status === 404 && code !== "MERGED_MULTI_REPO_REPORT_NOT_FOUND") {
    notFound()
  }

  const canFinalize =
    role === "ADMIN" && Boolean(runDetail?.runReadiness.canStartMergedReport)
  const canExport = Boolean(role) && Boolean(data) && !data?.isStale
  const canReview = (role === "ADMIN" || role === "REVIEWER") && Boolean(data) && !data?.isStale
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

  const handleSubmitReview = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!decision) {
      toast.error("Select a merged report review decision.")
      return
    }

    try {
      await createReviewDecision.mutateAsync({
        data: {
          decision,
          note: note.trim() || undefined,
        },
      })
      toast.success("Merged report review decision recorded.")
      setDecision(null)
      setNote("")
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
              <div className="ml-auto flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 shadow-none"
                  onClick={() => void handleExport("md")}
                  disabled={!canExport || exportingFormat !== null}
                  title={data.isStale ? "Merged report is stale; refresh the snapshot before export." : undefined}
                >
                  {exportingFormat === "md" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                  Export Markdown
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 shadow-none"
                  onClick={() => void handleExport("pdf")}
                  disabled={!canExport || exportingFormat !== null}
                  title={data.isStale ? "Merged report is stale; refresh the snapshot before export." : undefined}
                >
                  {exportingFormat === "pdf" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                  Export PDF
                </Button>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="h-8 shadow-none"
                onClick={() => void handleFinalize()}
                disabled={!canFinalize || finalizeReport.isPending}
              >
                {finalizeReport.isPending ? "Refreshing..." : "Refresh snapshot"}
              </Button>
            </div>

            <section className="mb-6 rounded-xl border border-border/50 bg-surface-muted/20 p-4">
              <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-sm font-semibold text-foreground">Merged Report Review</h2>
                  <p className="text-[12px] text-muted-foreground">
                    Append-only decision history for the approved merged report snapshot.
                  </p>
                </div>
                {!data.isStale && latestReviewedDecision && (
                  <div className="text-right text-[12px] text-muted-foreground">
                    <div>Latest decision by {latestReviewedDecision.reviewedBy}</div>
                    <div>{new Date(latestReviewedDecision.createdAt).toLocaleString("en-US")}</div>
                  </div>
                )}
              </div>

              {data.isStale && (
                <div className="mb-4 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-[12px] text-warning">
                  Review submission is blocked while the approved merged report is stale. Refresh and approve the snapshot again first.
                </div>
              )}

              <div className="mb-4 space-y-2">
                {reviewDecisionsLoading && <Skeleton className="h-16 w-full" />}
                {!reviewDecisionsLoading && reviewDecisions.length === 0 && (
                  <div className="rounded-lg border border-dashed border-border/60 px-3 py-4 text-[12px] text-muted-foreground">
                    No merged report review decisions yet.
                  </div>
                )}
                {reviewDecisions.map((item: any) => (
                  <div key={item.id} className="rounded-lg border border-border/50 bg-background/60 px-3 py-3">
                    <div className="mb-1 flex flex-wrap items-center gap-2 text-[12px]">
                      <Badge
                        variant={
                          item.decision === "ACCEPTED"
                            ? "default"
                            : item.decision === "REJECTED"
                              ? "destructive"
                              : "secondary"
                        }
                      >
                        {item.decision}
                      </Badge>
                      <span className="text-muted-foreground">by {item.reviewedBy}</span>
                      <span className="text-muted-foreground">{new Date(item.createdAt).toLocaleString("en-US")}</span>
                    </div>
                    {item.note && (
                      <p className="text-[13px] text-foreground whitespace-pre-wrap">{item.note}</p>
                    )}
                  </div>
                ))}
              </div>

              <form onSubmit={handleSubmitReview} className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  {[
                    { value: "ACCEPTED", label: "Accept", icon: ShieldCheck },
                    { value: "REJECTED", label: "Reject", icon: XCircle },
                    { value: "NEEDS_MORE_CLARIFICATION", label: "Needs Clarification", icon: MessageSquareWarning },
                  ].map((option) => {
                    const Icon = option.icon
                    const selected = decision === option.value
                    return (
                      <Button
                        key={option.value}
                        type="button"
                        size="sm"
                        variant={selected ? "default" : "outline"}
                        className="h-8 shadow-none"
                        onClick={() => setDecision(option.value as typeof decision)}
                        disabled={!canReview || createReviewDecision.isPending}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        {option.label}
                      </Button>
                    )
                  })}
                </div>
                <Textarea
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="Optional review note"
                  maxLength={2000}
                  disabled={!canReview || createReviewDecision.isPending}
                  className="min-h-24"
                />
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[12px] text-muted-foreground">
                    {canReview
                      ? "Review decisions are append-only. Existing entries are preserved."
                      : role === "VIEWER"
                        ? "Viewer cannot review merged reports."
                        : "Only admin/reviewer review posture can submit merged report decisions in the current UI."}
                  </span>
                  <Button
                    type="submit"
                    size="sm"
                    className="h-8 shadow-none"
                    disabled={!canReview || createReviewDecision.isPending || !decision}
                    title={
                      data.isStale
                        ? "Refresh and approve the merged report again before submitting a new review decision."
                        : !decision
                          ? "Select a decision first."
                          : undefined
                    }
                  >
                    {createReviewDecision.isPending ? "Submitting..." : "Submit review"}
                  </Button>
                </div>
              </form>
            </section>

            <article className="prose prose-sm md:prose-base prose-zinc dark:prose-invert max-w-none prose-headings:tracking-tight prose-a:text-primary">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {data.markdown}
              </ReactMarkdown>
            </article>
          </div>
        )}
      </div>
    </div>
  )
}
