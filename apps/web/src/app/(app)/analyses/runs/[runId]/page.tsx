"use client"

import * as React from "react"
import { use } from "react"
import Link from "next/link"
import { notFound } from "next/navigation"
import { AlertCircle, GitBranch } from "lucide-react"
import { useLocale, useTranslations } from "next-intl"
import { WorkspacePageHeader } from "@/components/workspace/shared/page-header"
import { DataList, DataListCell, DataListHeader, DataListRow } from "@/components/workspace/shared/data-list"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { useApprovedMultiRepoReport, useMultiRepoAnalysisRunDetail, useFinalizeMultiRepoReport } from "@/hooks/api/use-analyses"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { MetricCard } from "@/components/workspace/shared/primitives"
import {
  formatMultiRepoMergedReportBlockers,
  getMultiRepoChildBlockingReasonLabel,
} from "@/lib/multi-repo-report-labels"
import { analysisStatusLabels, getLocalizedLabel, reviewDecisionLabels } from "@/lib/i18n/status-labels"
import { useLocalizedHref } from "@/i18n/navigation"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ImpactMatrixTable } from "@/components/workspace/matrix/impact-matrix-table"
import { MatrixRowDetailDrawer } from "@/components/workspace/matrix/matrix-row-detail-drawer"
import { ReviewCoveragePanel } from "@/components/workspace/review/review-coverage-panel"

const STATUS_BADGE: Record<string, { className: string }> = {
  QUEUED:             { className: "bg-[var(--surface-muted)] text-[var(--text-tertiary)] border-[var(--border)]" },
  RUNNING:            { className: "bg-[var(--accent-soft)] text-[var(--accent)] border-[var(--accent-soft)]" },
  WAITING_FOR_REVIEW: { className: "bg-[var(--warning-soft)] text-[var(--warning)] border-[var(--warning-soft)]" },
  COMPLETED:          { className: "bg-[var(--success-soft)] text-[var(--success)] border-[var(--success-soft)]" },
  FAILED:             { className: "bg-[var(--danger-soft)] text-[var(--danger)] border-[var(--danger-soft)]" },
  CANCELLED:          { className: "bg-[var(--surface-muted)] text-[var(--text-tertiary)] border-[var(--border)]" },
}

const gridCols = "minmax(180px, 1.8fr) minmax(120px, 1fr) 130px 110px minmax(150px, 1.3fr) minmax(120px, 1fr)"

function formatDate(iso: string, locale: string) {
  return new Date(iso).toLocaleString(locale, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}


export default function MultiRepoAnalysisRunDetailPage({
  params,
}: {
  params: Promise<{ runId: string }>
}) {
  const { runId } = use(params)
  const t = useTranslations("multiRepo")
  const locale = useLocale()
  const href = useLocalizedHref()
  const { data, isLoading, error } = useMultiRepoAnalysisRunDetail(runId)
  const { data: approvedReport, error: approvedReportError } = useApprovedMultiRepoReport(runId)
  const finalizeReport = useFinalizeMultiRepoReport(runId)
  const router = useRouter()
  const [selectedAnalysisId, setSelectedAnalysisId] = React.useState<string | null>(null)

  if (error && (error as { status?: number }).status === 404) {
    notFound()
  }

  const canFinalizeMergedReport = Boolean(
    data?.capabilities.canFinalizeMergedReport ||
      data?.capabilities.canRefreshMergedReport,
  )
  const approvedReportErrorCode = (approvedReportError as { code?: string } | undefined)?.code
  const hasApprovedMergedReport =
    Boolean(data?.capabilities.canOpenApprovedReport) ||
    Boolean(approvedReport) ||
    Boolean(approvedReportError && approvedReportErrorCode !== "MERGED_MULTI_REPO_REPORT_NOT_FOUND")

  const handleFinalizeMergedReport = async () => {
    try {
      await finalizeReport.mutateAsync()
      toast.success(t("reportFinalized"))
      router.push(href(`/analyses/runs/${runId}/merged-report`))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("failedFinalize"))
    }
  }

  return (
    <div className="app-page-scroll">
      <div className="max-w-5xl mx-auto w-full py-4">
        <WorkspacePageHeader
          title={t("detailTitle")}
          description={
            data ? (
              <div className="space-y-1">
                <div>
                  {t("requirement")}: <span className="font-medium text-foreground">{data.requirementTitle}</span>
                </div>
                <div>
                  {t("createdByOn", { createdBy: data.createdBy, date: formatDate(data.createdAt, locale) })}
                </div>
              </div>
            ) : (
              t("detailDescription")
            )
          }
        >
          <div className="flex items-center gap-2">
            {data && (
              data.capabilities.canFinalizeMergedReport || data.capabilities.canRefreshMergedReport ? (
                <>
                  <Link
                    href={href(`/analyses/runs/${runId}/merged-report`)}
                    className="text-[12px] text-[var(--accent)] hover:underline"
                  >
                    {t("viewMergedReport")}
                  </Link>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 shadow-none"
                    onClick={() => void handleFinalizeMergedReport()}
                    disabled={!canFinalizeMergedReport || finalizeReport.isPending}
                  >
                    {finalizeReport.isPending
                      ? t("finalizing")
                      : data.capabilities.canRefreshMergedReport
                        ? t("refreshMergedReport")
                        : t("finalizeMergedReport")}
                  </Button>
                </>
              ) : hasApprovedMergedReport ? (
                <>
                  <Link
                    href={href(`/analyses/runs/${runId}/merged-report`)}
                    className="text-[12px] text-[var(--accent)] hover:underline"
                  >
                    {t("viewApprovedMergedReport")}
                  </Link>
                  <span
                    className="text-[12px] text-[var(--text-tertiary)]"
                    title={formatMultiRepoMergedReportBlockers(data.capabilities.blockedReasons, locale)}
                  >
                    {data.mergedReportStatus === "CURRENT" ? t("currentSnapshot") : t("refreshBlocked")}
                  </span>
                </>
              ) : (
                <span
                  className="text-[12px] text-[var(--text-tertiary)]"
                  title={formatMultiRepoMergedReportBlockers(data.capabilities.blockedReasons, locale)}
                >
                  {t("mergedReportNotReady")}
                </span>
              )
            )}
            <Link href={href("/analyses/runs")} className="text-[12px] text-[var(--text-tertiary)] hover:text-[var(--text-primary)]">
              {t("backToRuns")}
            </Link>
          </div>
        </WorkspacePageHeader>

        {data && (
          <div className="mb-4 space-y-4">
            <div className="grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-3">
              <MetricCard label={t("total")} value={data.runReadiness.totalAnalyses} />
              <MetricCard label={t("completed")} value={data.runReadiness.completedAnalyses} accent="success" />
              <MetricCard label={t("failed")} value={data.runReadiness.failedAnalyses} accent={data.runReadiness.hasFailures ? "danger" : "default"} />
              <MetricCard label={t("needsReview")} value={data.runReadiness.waitingForReviewAnalyses} accent={data.runReadiness.waitingForReviewAnalyses > 0 ? "warning" : "default"} />
              <MetricCard label={t("accepted")} value={data.childReviewSummary.accepted} accent="success" />
              <MetricCard label={t("pendingReview")} value={data.childReviewSummary.pendingReview} accent={data.childReviewSummary.pendingReview > 0 ? "warning" : "default"} />
              <MetricCard
                label={t("mergedReport")}
                value={{
                  NOT_CREATED: t("readyToFinalize"),
                  CURRENT: t("current"),
                  STALE: t("stale"),
                  BLOCKED: t("blocked"),
                }[data.mergedReportStatus] ?? data.mergedReportStatus}
                accent={
                  data.mergedReportStatus === "CURRENT" || data.mergedReportStatus === "NOT_CREATED"
                    ? "success"
                    : data.mergedReportStatus === "STALE"
                      ? "warning"
                      : "default"
                }
              />
            </div>

            <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-[12px] text-[var(--text-secondary)]">
              {t("reviewSummary", {
                accepted: data.childReviewSummary.accepted,
                rejected: data.childReviewSummary.rejected,
                needsClarification: data.childReviewSummary.needsMoreClarification,
                pending: data.childReviewSummary.pendingReview,
              })}
            </div>
            {data.capabilities.blockedReasons.length > 0 && data.mergedReportStatus !== "CURRENT" && (
              <div className="rounded-lg border border-[var(--warning-soft)] bg-[var(--warning-soft)]/40 px-3 py-2 text-[12px] text-[var(--warning)]">
                {t("mergedReportBlocker", { reason: formatMultiRepoMergedReportBlockers(data.capabilities.blockedReasons, locale) })}
              </div>
            )}
          </div>
        )}

        <ReviewCoveragePanel runId={runId} />

        <Tabs defaultValue="matrix" className="mt-6">
          <TabsList>
            <TabsTrigger value="matrix">{t("impactMatrix")}</TabsTrigger>
            <TabsTrigger value="list">{t("childAnalyses")}</TabsTrigger>
          </TabsList>
          
          <TabsContent value="matrix" className="mt-4">
            <ImpactMatrixTable runId={runId} onViewDetails={setSelectedAnalysisId} />
          </TabsContent>
          
          <TabsContent value="list" className="mt-4">
            <DataList>
              <DataListHeader gridCols={gridCols}>
                <DataListCell>{t("repository")}</DataListCell>
                <DataListCell>{t("commit")}</DataListCell>
                <DataListCell>{t("status")}</DataListCell>
                <DataListCell>{t("freshness")}</DataListCell>
                <DataListCell>{t("latestReview")}</DataListCell>
                <DataListCell>{t("blocking")}</DataListCell>
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
                <div className="flex flex-col items-center py-16 text-[var(--text-tertiary)]">
                  <AlertCircle className="w-6 h-6 text-[var(--danger)] mb-4" />
                  <p className="text-[13px] font-medium text-[var(--text-primary)]">{t("failedToLoadRun")}</p>
                  <p className="text-[12px]">{error.message}</p>
                </div>
              )}

              {data?.items.map((item) => {
                const badge = STATUS_BADGE[item.status] ?? STATUS_BADGE.QUEUED

                return (
                  <DataListRow
                    key={item.analysisId}
                    gridCols={gridCols}
                    href={href(`/analyses/${item.analysisId}`)}
                  >
                    <DataListCell>
                      <div className="font-medium text-[13px] text-[var(--text-primary)] leading-snug">{item.repositoryDisplayName}</div>
                      <div className="text-[var(--text-tertiary)] text-[11px] font-mono mt-0.5">{item.analysisId}</div>
                    </DataListCell>
                    <DataListCell>
                      <div className="flex items-center gap-1.5 text-[12px] text-[var(--text-tertiary)] font-mono">
                        <GitBranch className="w-3.5 h-3.5" />
                        {item.commitSha.substring(0, 7)}
                      </div>
                    </DataListCell>
                    <DataListCell>
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 border rounded-md text-[10px] font-semibold tracking-wide uppercase ${badge.className}`}>
                        {getLocalizedLabel(analysisStatusLabels, item.status, locale)}
                      </span>
                    </DataListCell>
                    <DataListCell>
                      <span className={`text-[12px] ${item.isStale ? "text-[var(--warning)]" : "text-[var(--text-tertiary)]"}`}>
                        {item.isStale ? t("stale") : t("current")}
                      </span>
                    </DataListCell>
                    <DataListCell>
                      {item.latestReviewDecision ? (
                        <div className="space-y-0.5">
                          <div className="text-[12px] text-[var(--text-primary)]">
                            {item.latestReviewDecision === "NEEDS_MORE_CLARIFICATION"
                              ? t("needsClarification")
                              : getLocalizedLabel(reviewDecisionLabels, item.latestReviewDecision, locale)}
                          </div>
                          <div className="text-[11px] text-[var(--text-tertiary)]">
                            {item.reviewedBy ?? t("unknown")}
                            {item.latestReviewDecisionAt ? ` • ${formatDate(item.latestReviewDecisionAt, locale)}` : ""}
                          </div>
                        </div>
                      ) : (
                        <span className="text-[12px] text-[var(--text-tertiary)]">{t("pendingReview")}</span>
                      )}
                    </DataListCell>
                    <DataListCell>
                      <span className={`text-[12px] ${item.blockingReason === "NONE" ? "text-[var(--success)]" : "text-[var(--warning)]"}`}>
                        {getMultiRepoChildBlockingReasonLabel(item.blockingReason, locale)}
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
