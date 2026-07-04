"use client"

import { use } from "react"
import Link from "next/link"
import { notFound } from "next/navigation"
import { AlertCircle, AlertTriangle, CheckCircle2, FileWarning, MessageSquareWarning, XCircle } from "lucide-react"
import { useLocale, useTranslations } from "next-intl"
import { WorkspacePageHeader } from "@/components/workspace/shared/page-header"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useApprovedMultiRepoReport, useCreateMergedMultiRepoReportReviewDecision, useFinalizeMultiRepoReport, useLatestMergedMultiRepoReportReviewDecision, useMergedMultiRepoReportReviewDecisions, useMultiRepoAnalysisRunDetail } from "@/hooks/api/use-analyses"
import { toast } from "sonner"
import { apiGetFile } from "@/lib/api-client"
import { useState } from "react"
import { ReportMarkdown } from "@/components/report/report-markdown"
import { MergedReportActions } from "./_components/merged-report-actions"
import { MergedReportReviewPanel } from "./_components/merged-report-review-panel"
import { formatMultiRepoMergedReportBlockers } from "@/lib/multi-repo-report-labels"
import { useLocalizedHref } from "@/i18n/navigation"
import { DenseAlert, DenseCard } from "@/components/workspace/shared/dense-card"

export default function ApprovedMultiRepoReportPage({
  params,
}: {
  params: Promise<{ runId: string }>
}) {
  const { runId } = use(params)
  const t = useTranslations("multiRepo")
  const locale = useLocale()
  const href = useLocalizedHref()
  const { data: runDetail } = useMultiRepoAnalysisRunDetail(runId)
  const { data, isLoading, error } = useApprovedMultiRepoReport(runId)
  const { data: latestDecision, error: latestDecisionError } = useLatestMergedMultiRepoReportReviewDecision(runId)
  const { data: reviewDecisionsData, isLoading: reviewDecisionsLoading } = useMergedMultiRepoReportReviewDecisions(runId)
  const finalizeReport = useFinalizeMultiRepoReport(runId)
  const createReviewDecision = useCreateMergedMultiRepoReportReviewDecision(runId)
  const [exportingFormat, setExportingFormat] = useState<"md" | "pdf" | null>(null)

  const status = (error as { status?: number } | undefined)?.status
  const code = (error as { code?: string } | undefined)?.code
  const latestDecisionCode = (latestDecisionError as { code?: string } | undefined)?.code

  if (status === 404 && code !== "MERGED_MULTI_REPO_REPORT_NOT_FOUND") {
    notFound()
  }

  const canFinalize = Boolean(
    data?.capabilities.canRefreshMergedReport ||
      runDetail?.capabilities.canFinalizeMergedReport ||
      runDetail?.capabilities.canRefreshMergedReport,
  )
  const canExport = Boolean(data?.capabilities.canExportMergedReport)
  const canReview = Boolean(data?.capabilities.canReviewMergedReport)
  const reviewDecisions = reviewDecisionsData?.items ?? []
  const latestReviewedDecision = latestDecisionCode === "MERGED_MULTI_REPO_REPORT_NOT_FOUND" ? null : latestDecision

  const handleFinalize = async () => {
    try {
      await finalizeReport.mutateAsync()
      toast.success(t("reportFinalized"))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("failedFinalize"))
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
      toast.success(t("reportExported"), {
        description: file.filename,
      })
    } catch (error) {
      toast.error(t("exportFailed"), {
        description: error instanceof Error ? error.message : t("failedExportDescription"),
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
      toast.success(t("reviewRecorded"))
    } catch (error) {
      toast.error(t("reviewSubmitFailed"), {
        description: error instanceof Error ? error.message : t("unknownError"),
      })
    }
  }

  const decisionMeta = latestReviewedDecision?.decision
    ? {
        ACCEPTED: {
          label: t("accepted"),
          icon: <CheckCircle2 className="w-3.5 h-3.5" />,
          variant: "default" as const,
        },
        REJECTED: {
          label: t("rejected"),
          icon: <XCircle className="w-3.5 h-3.5" />,
          variant: "destructive" as const,
        },
        NEEDS_MORE_CLARIFICATION: {
          label: t("needsClarification"),
          icon: <MessageSquareWarning className="w-3.5 h-3.5" />,
          variant: "secondary" as const,
        },
      }[latestReviewedDecision.decision as "ACCEPTED" | "REJECTED" | "NEEDS_MORE_CLARIFICATION"]
    : null

  return (
    <div className="app-page-scroll">
      <div className="max-w-5xl mx-auto w-full py-4">
        <WorkspacePageHeader
          title={t("reportTitle")}
          description={
            data
              ? t("approvedAt", {
                  title: data.requirementTitle,
                  date: new Date(data.approvedAt).toLocaleString(locale),
                })
              : t("reportDescription")
          }
        >
          <div className="flex items-center gap-2">
            <Link href={href(`/analyses/runs/${runId}`)} className="text-[12px] text-muted-foreground hover:text-foreground">
              {t("backToRun")}
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
          <DenseCard variant="muted" className="items-center justify-center p-12 text-muted-foreground">
            <AlertCircle className="w-8 h-8 text-warning mb-3" />
            <p className="font-medium text-foreground">{t("noApprovedReport")}</p>
            <p className="text-[13px] text-center max-w-xl mb-4">
              {t("noApprovedReportDescription")}
            </p>
            <Button
              size="sm"
              className="h-8 shadow-none"
              onClick={() => void handleFinalize()}
              disabled={!canFinalize || finalizeReport.isPending}
            >
              {finalizeReport.isPending ? t("finalizing") : t("finalizeMergedReport")}
            </Button>
          </DenseCard>
        )}

        {error && !isLoading && code !== "MERGED_MULTI_REPO_REPORT_NOT_FOUND" && (
          <DenseCard variant="muted" className="items-center justify-center p-12 text-muted-foreground">
            <AlertCircle className="w-8 h-8 text-destructive mb-3" />
            <p className="font-medium text-foreground">{t("failedToLoadApprovedReport")}</p>
            <p className="text-[13px] text-center max-w-xl">{error.message}</p>
          </DenseCard>
        )}

        {data && (
          <DenseCard className="bg-surface/40 p-6">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <Badge variant={data.mergedReportStatus === "CURRENT" ? "default" : data.mergedReportStatus === "STALE" ? "secondary" : "outline"}>
                {{
                  NOT_CREATED: t("notCreated"),
                  CURRENT: t("current"),
                  STALE: t("stale"),
                  BLOCKED: t("blocked"),
                }[data.mergedReportStatus] ?? data.mergedReportStatus}
              </Badge>
              {data.capabilities.blockedReasons.length > 0 && data.mergedReportStatus !== "CURRENT" && (
                <span className="text-[12px] text-muted-foreground">
                  {t("blockedBy", { reason: formatMultiRepoMergedReportBlockers(data.capabilities.blockedReasons, locale) })}
                </span>
              )}
            </div>

            {data.isStale && (
              <DenseAlert variant="warning" className="mb-6 gap-3 p-4">
                <FileWarning className="w-5 h-5 shrink-0 mt-0.5" />
                <div className="flex flex-col gap-1">
                  <span className="font-semibold text-[13px] uppercase tracking-wider">{t("staleReportWarning")}</span>
                  <span className="text-[13px] text-warning/80">
                    {t("exportBlockedUntilRefresh", { reason: data.staleReason || t("childStateChanged") })}
                  </span>
                </div>
              </DenseAlert>
            )}

            {data.provenance.domainPack?.domainPackStatus === "PARTIAL" && (
              <DenseAlert variant="warning" className="mb-6 gap-3 p-4 text-foreground/80">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
                <div className="flex flex-col gap-1 text-[13px] leading-relaxed">
                  <span className="font-semibold text-foreground">
                    {t("partialPack", {
                      id: data.provenance.domainPack.domainPackId,
                      version: data.provenance.domainPack.domainPackVersion,
                    })}
                  </span>
                  <span>{t("partialWarning1")}</span>
                  <span>{t("partialWarning2")}</span>
                  <span>{t("partialWarning3")}</span>
                </div>
              </DenseAlert>
            )}

            <div className="mb-6 flex flex-wrap items-center gap-3 text-[12px] text-muted-foreground">
              <span>{t("run")}: <span className="font-mono">{data.runId}</span></span>
              <span>{t("requirement")}: <span className="text-foreground">{data.requirementTitle}</span></span>
              <span>{t("childAnalysesCount", { count: data.provenance.childAnalyses.length })}</span>
              <span className="flex items-center gap-2">
                {t("latestMergedReview")}
                {decisionMeta ? (
                  <Badge variant={decisionMeta.variant} className="h-6 gap-1.5 px-2">
                    {decisionMeta.icon}
                    {decisionMeta.label}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="h-6">{t("pending")}</Badge>
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
              isSubmitting={createReviewDecision.isPending}
              onSubmitReview={handleSubmitReview}
            />

            <ReportMarkdown markdown={data.markdown} />
          </DenseCard>
        )}
      </div>
    </div>
  )
}
