"use client"

import { useState } from "react"
import type { AnalysisWorkspaceResponse } from "@ba-helper/contracts"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { FinalizeAnalysisDialog } from "./finalize-analysis-dialog"
import { AnalysisLocalizationTrigger } from "./analysis-localization-trigger"
import {
  driftStatusLabels,
  exportStatusLabels,
  getLocalizedLabel,
  reportStatusLabels,
  type SupportedLocale,
} from "@/lib/i18n/status-labels"
import type { AnalysisWorkspaceLabels } from "@/lib/i18n/analysis-labels"
import { InlineReviewAction } from "../shared/inline-review-action"
import { useTranslations } from "next-intl"
import { DEFAULT_APP_LOCALE } from "@/i18n/app-locale"
import { DenseAlert, DenseCard, DenseCardHeader, DenseCardTitle } from "../shared/dense-card"

export function ReviewReportTab({
  workspace,
  finalizeStats,
  locale,
  labels,
}: {
  workspace: AnalysisWorkspaceResponse
  finalizeStats: {
    total: number
    confirmed: number
    rejected: number
    unknowns: number
    conflicts: number
    needsReview: number
  }
  locale: SupportedLocale
  labels: AnalysisWorkspaceLabels["reviewReport"]
}) {
  const t = useTranslations("workspace")
  const isStale = workspace.driftStatus.isStale
  const reportStatus = normalizeReportStatus(workspace.reportStatus)
  const reportHref =
    locale === DEFAULT_APP_LOCALE
      ? `/reports?analysisId=${workspace.overview.analysisId}`
      : `/reports?analysisId=${workspace.overview.analysisId}&locale=${locale}`
  const [filter, setFilter] = useState<"all" | "needs_review" | "blocking" | "impact" | "risk" | "unknown" | "qa_scenario" | "evidence" | "report">("all")

  const totalItems = workspace.reviewQueue.length
  const reviewedItems = workspace.reviewQueue.filter(i => i.currentDecision !== "needs_review").length
  const remainingItems = totalItems - reviewedItems
  const blockingCount = workspace.reviewQueue.filter(i => i.blockingFinalize && i.currentDecision === "needs_review").length

  const filteredQueue = workspace.reviewQueue.filter(item => {
    if (filter === "all") return true
    if (filter === "needs_review") return item.currentDecision === "needs_review"
    if (filter === "blocking") return item.blockingFinalize && item.currentDecision === "needs_review"
    return item.itemType === filter
  })

  const filters = [
    { id: "all", label: t("all") },
    { id: "needs_review", label: t("needsReview") },
    { id: "blocking", label: t("blocking") },
    { id: "impact", label: t("impact") },
    { id: "risk", label: t("risk") },
    { id: "unknown", label: t("unknown") },
    { id: "qa_scenario", label: t("qa") },
    { id: "evidence", label: t("evidence") },
    { id: "report", label: t("report") },
  ] as const

  return (
    <section className="grid gap-4 xl:grid-cols-[1fr_360px]">
      <DenseCard>
        <DenseCardHeader className="gap-3 border-b border-border/40 bg-surface-muted/30 px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <DenseCardTitle>{labels.reviewQueue}</DenseCardTitle>
              <p className="mt-0.5 text-[12px] text-muted-foreground">
                {t("reviewedCount", { reviewed: reviewedItems, total: totalItems })} · {t("blockingFinalizationCount", { count: blockingCount })}
              </p>
            </div>
            <span className="text-[11px] font-medium bg-foreground/10 px-1.5 py-0.5 rounded text-foreground shrink-0">
              {remainingItems} {labels.pending}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {filters.map(f => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={`text-[11px] px-2 py-1 rounded transition-colors font-medium ${filter === f.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </DenseCardHeader>

        <div className="flex flex-col divide-y divide-border/40">
          {filteredQueue.length === 0 ? (
            <div className="p-6 text-center">
              {totalItems > 0 && remainingItems === 0 && filter === "needs_review" ? (
                <p className="text-[13px] font-medium text-success">All reviews complete. Analysis is ready for finalization.</p>
              ) : (
                <p className="text-[13px] text-muted-foreground">{labels.noPendingItems}</p>
              )}
            </div>
          ) : (
            filteredQueue.map((item) => (
              <article key={item.itemId} className="flex flex-col p-4 hover:bg-surface-muted/30 transition-colors gap-3 md:flex-row md:items-center md:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-[13px] font-semibold text-foreground">{item.title}</h3>
                    <span className="text-[10px] font-medium bg-muted text-muted-foreground px-1.5 py-0.5 rounded uppercase tracking-wider">
                      {item.itemType}
                    </span>
                  </div>
                  <p className="mt-1 truncate font-mono text-[11px] text-muted-foreground">
                    {item.linkedArtifactKeys.join(", ") || item.itemId}
                  </p>
                </div>
                <div className="flex items-center gap-4 shrink-0">
                  <span className="text-[11px] font-medium text-muted-foreground hidden md:block">
                    {item.evidenceCount} {labels.evidence}
                  </span>
                  <div className="flex shrink-0">
                    <InlineReviewAction
                      analysisId={workspace.overview.analysisId}
                      itemId={item.itemId}
                      itemType={item.itemType === "impact" ? "impact" : "insight"}
                      itemTitle={item.title}
                      currentStatus={item.currentDecision.toUpperCase()}
                      isStale={isStale}
                      disabled={item.itemType === "report"}
                    />
                  </div>
                </div>
              </article>
            ))
          )}
        </div>
      </DenseCard>

      <DenseCard className="flex flex-col">
        <DenseCardHeader className="border-b border-border/40 bg-surface-muted/30 px-4 py-3">
          <DenseCardTitle>{labels.reportStatus}</DenseCardTitle>
        </DenseCardHeader>
        <div className="flex flex-col divide-y divide-border/40">
          <StatusLine label={labels.report} value={getLocalizedLabel(reportStatusLabels, reportStatus.status, locale)} />
          <StatusLine label={labels.drift} value={getLocalizedLabel(driftStatusLabels, workspace.driftStatus.status, locale)} />
          <StatusLine label={labels.export} value={getLocalizedLabel(exportStatusLabels, reportStatus.canExport ? "available" : "blocked", locale)} />
          <StatusLine label={t("finalize")} value={getLocalizedLabel(exportStatusLabels, reportStatus.canFinalize ? "available" : "blocked", locale)} />
          <StatusLine label={labels.documentJob} value={reportStatus.documentJobId ?? getLocalizedLabel(exportStatusLabels, "none", locale)} mono />
          <StatusLine label={labels.reviewedSnapshot} value={reportStatus.reviewedReportSnapshotId ?? getLocalizedLabel(exportStatusLabels, "none", locale)} mono />
        </div>
        {reportStatus.finalizeBlockingReasons.length > 0 ? (
          <DenseAlert variant="danger" layout="col" className="rounded-none border-x-0 border-b-0 border-t border-border/40 px-4 py-3">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-destructive">
              {hasLegacyReportStatusContract(reportStatus.finalizeBlockingReasons)
                ? t("backendCapabilityUnavailable")
                : t("backendFinalizeBlockers")}
            </div>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {reportStatus.finalizeBlockingReasons.map((reason) => (
                <span
                  key={reason}
                  className="rounded border border-destructive/20 bg-destructive/10 px-1.5 py-0.5 text-[10px] font-medium text-destructive"
                >
                  {formatFinalizeBlocker(reason, t("legacyReportStatusContract"))}
                </span>
              ))}
            </div>
          </DenseAlert>
        ) : null}

        <div className="p-4 border-t border-border/40 bg-surface-muted/10">
          <FinalizeAnalysisDialog
            analysisId={workspace.overview.analysisId}
            commitSha={workspace.overview.snapshot.commitSha}
            stats={finalizeStats}
            isStale={isStale}
            reportStatus={reportStatus}
            labels={labels.finalizeDialog}
          >
            <Button className="w-full" disabled={!reportStatus.canFinalize}>
              {labels.finalizeAnalysis}
            </Button>
          </FinalizeAnalysisDialog>

          {reportStatus.canViewReport ? (
            <Button
              render={
                <Link
                  href={reportHref}
                  className="mt-2 w-full"
                />
              }
              nativeButton={false}
              variant="outline"
            >
              {labels.openReport}
            </Button>
          ) : null}

          <div className="mt-4">
            <AnalysisLocalizationTrigger 
              analysisId={workspace.overview.analysisId} 
              canExport={reportStatus.canExport} 
            />
          </div>
        </div>
      </DenseCard>
    </section>
  )
}

function hasLegacyReportStatusContract(reasons: string[]): boolean {
  return reasons.includes("LEGACY_REPORT_STATUS_CONTRACT")
}

function formatFinalizeBlocker(reason: string, legacyReportStatusContractLabel: string): string {
  switch (reason) {
    case "CONFLICTING_EVIDENCE_UNREVIEWED":
      return "Conflicting evidence needs review"
    case "CRITICAL_MISSING_EVIDENCE":
      return "Critical item is missing evidence"
    case "REVIEW_REQUIRED_ITEMS":
      return "Review-required items remain"
    case "HIGH_RISK_INSIGHT_UNREVIEWED":
      return "High-risk insight is unreviewed"
    case "ANALYSIS_NOT_WAITING_FOR_REVIEW":
      return "Analysis is not waiting for review"
    case "ANALYSIS_STALE":
      return "Analysis is stale"
    case "LEGACY_REPORT_STATUS_CONTRACT":
      return legacyReportStatusContractLabel
    default:
      return reason
  }
}

function normalizeReportStatus(
  value: AnalysisWorkspaceResponse["reportStatus"],
): AnalysisWorkspaceResponse["reportStatus"] {
  const finalizeBlockingReasons = Array.isArray(value.finalizeBlockingReasons)
    ? value.finalizeBlockingReasons
    : ["LEGACY_REPORT_STATUS_CONTRACT"]
  const exportBlockingReasons = Array.isArray(value.exportBlockingReasons)
    ? value.exportBlockingReasons
    : ["LEGACY_REPORT_STATUS_CONTRACT"]

  return {
    ...value,
    canFinalize: value.canFinalize === true && finalizeBlockingReasons.length === 0,
    requiresUnreviewedAcknowledgement: value.requiresUnreviewedAcknowledgement === true,
    canViewReport: value.canViewReport === true,
    canExport: value.canExport === true && exportBlockingReasons.length === 0,
    canRetryReportGeneration: value.canRetryReportGeneration === true,
    finalizeBlockingReasons,
    exportBlockingReasons,
  }
}

function StatusLine({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex flex-col justify-center p-3 min-w-0">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className={`mt-0.5 truncate text-[13px] text-foreground ${mono ? "font-mono text-[12px]" : "font-medium"}`}>
        {value}
      </div>
    </div>
  )
}
