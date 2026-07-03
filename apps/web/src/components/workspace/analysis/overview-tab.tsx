"use client"

import type { AnalysisWorkspaceResponse } from "@ba-helper/contracts"
import {
  driftStatusLabels,
  getLocalizedLabel,
  reportStatusLabels,
  analysisStatusLabels,
  type SupportedLocale,
} from "@/lib/i18n/status-labels"
import type { AnalysisWorkspaceLabels } from "@/lib/i18n/analysis-labels"
import { InlineReviewAction } from "../shared/inline-review-action"
import { AlertTriangle, Code, ShieldAlert } from "lucide-react"
import { EvidenceCommandCenter } from "./evidence-command-center"

export function OverviewTab({
  workspace,
  locale,
  labels,
}: {
  workspace: AnalysisWorkspaceResponse
  locale: SupportedLocale
  labels: AnalysisWorkspaceLabels["overview"]
}) {
  const { overview, reportStatus, driftStatus, risks, impactGroups, unknowns } = workspace
  const counts = overview.counts

  const topActions = workspace.reviewQueue.filter(r => r.currentDecision === "needs_review").slice(0, 3)
  const topBlockers = workspace.reviewQueue.filter(r => r.blockingFinalize && r.currentDecision === "needs_review").slice(0, 5)
  const topRisksAndUnknowns = [...risks.filter(r => r.severity === "high").map(r => ({ ...r, type: "risk" as const })), ...unknowns.map(u => ({ ...u, type: "unknown" as const }))].slice(0, 5)
  const topImpacts = impactGroups.flatMap(g => g.artifacts).filter(a => a.reviewDecision === "needs_review").slice(0, 3)

  const derivedSummary = formatDerivedSummary({
    requirementTitle: overview.requirement.title,
    statusLabel: getLocalizedLabel(analysisStatusLabels, overview.status.analysisStatus, locale).toLowerCase(),
    impactedArtifacts: counts.impactedArtifacts,
    risks: counts.risks,
    evidenceItems: counts.evidenceItems,
    pendingReviewItems: counts.pendingReviewItems,
    reviewComplete: overview.status.reviewStatus === "complete",
    isStale: driftStatus.isStale,
    locale,
  })

  return (
    <section className="flex flex-col gap-4">
      {/* Executive Summary */}
      <div className="rounded-lg border border-border/40 bg-surface flex flex-col overflow-hidden">
        <div className="px-4 py-3 border-b border-border/40 bg-surface-muted/30">
          <h2 className="text-[13px] font-semibold text-foreground">{labels.derivedAnalysisSummary}</h2>
        </div>
        <div className="p-4">
          <p className="text-[13px] text-foreground leading-relaxed">{derivedSummary}</p>
          <p className="mt-3 text-[12px] text-muted-foreground bg-surface-muted/50 p-2 rounded">
            <strong>{labels.requirementSummary}:</strong> {overview.requirement.summary}
          </p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-y divide-border/40 border-t border-border/40">
          <InfoRow label={labels.finalizeReadiness} value={reportStatus.canFinalize ? labels.ready : labels.notReady} />
          <InfoRow label={labels.evidenceCoverage} value={labels.retrievedItems.replace("{count}", String(counts.evidenceItems))} />
          <InfoRow label={labels.reportStatus} value={getLocalizedLabel(reportStatusLabels, reportStatus.status, locale)} />
          <InfoRow label={labels.driftStatus} value={getLocalizedLabel(driftStatusLabels, driftStatus.status, locale)} />
        </div>
      </div>

      <EvidenceCommandCenter workspace={workspace} labels={labels} />

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Top Next Actions */}
        <div className="rounded-lg border border-border/40 bg-surface flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b border-border/40 bg-surface-muted/30 flex items-center justify-between">
            <h2 className="text-[13px] font-semibold text-foreground">{labels.topNextActions}</h2>
            {topActions.length > 0 && <span className="text-[10px] font-medium bg-foreground/10 px-1.5 py-0.5 rounded uppercase">{labels.totalPending.replace("{count}", String(counts.pendingReviewItems))}</span>}
          </div>
          <div className="flex flex-col divide-y divide-border/40">
            {topActions.length === 0 ? (
              <div className="p-6 text-center text-[13px] text-muted-foreground">{labels.noPendingActions}</div>
            ) : (
              topActions.map((action) => (
                <div key={action.itemId} className="flex items-start gap-4 p-4 hover:bg-surface-muted/30 transition-colors">
                  <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                    <p className="text-[13px] font-semibold text-foreground leading-tight">{action.title}</p>
                    <p className="text-[11px] text-muted-foreground uppercase tracking-wider">{action.itemType}</p>
                  </div>
                  <div className="shrink-0">
                    <InlineReviewAction analysisId={overview.analysisId} itemId={action.itemId} itemType={action.itemType === "impact" ? "impact" : "insight"} itemTitle={action.title} currentStatus={action.currentDecision.toUpperCase()} isStale={driftStatus.isStale} disabled={action.itemType === "report"} />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Top Blocking Items */}
        <div className="rounded-lg border border-border/40 bg-surface flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b border-border/40 bg-surface-muted/30 flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-destructive" />
            <h2 className="text-[13px] font-semibold text-foreground">{labels.topFinalizeBlockers}</h2>
          </div>
          <div className="flex flex-col divide-y divide-border/40">
            {topBlockers.length === 0 ? (
              <div className="p-6 text-center text-[13px] text-muted-foreground">{labels.noBlockingItems}</div>
            ) : (
              topBlockers.map((blocker) => (
                <div key={blocker.itemId} className="flex items-start gap-4 p-4 hover:bg-surface-muted/30 transition-colors">
                  <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                    <p className="text-[13px] font-semibold text-foreground leading-tight">{blocker.title}</p>
                    <p className="text-[11px] text-muted-foreground uppercase tracking-wider">{blocker.itemType}</p>
                  </div>
                  <div className="shrink-0">
                    <InlineReviewAction analysisId={overview.analysisId} itemId={blocker.itemId} itemType={blocker.itemType === "impact" ? "impact" : "insight"} itemTitle={blocker.title} currentStatus={blocker.currentDecision.toUpperCase()} isStale={driftStatus.isStale} disabled={blocker.itemType === "report"} />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Top Impacted Artifacts */}
        <div className="rounded-lg border border-border/40 bg-surface flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b border-border/40 bg-surface-muted/30 flex items-center gap-2">
            <Code className="w-4 h-4 text-primary" />
            <h2 className="text-[13px] font-semibold text-foreground">{labels.topImpactedArtifacts}</h2>
          </div>
          <div className="flex flex-col divide-y divide-border/40">
            {topImpacts.length === 0 ? (
              <div className="p-6 text-center text-[13px] text-muted-foreground">{labels.noImpactedArtifacts}</div>
            ) : (
              topImpacts.map((artifact) => (
                <div key={artifact.artifactId} className="flex items-center justify-between gap-4 p-4 hover:bg-surface-muted/30 transition-colors">
                  <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                    <p className="text-[13px] font-semibold text-foreground truncate">{artifact.name}</p>
                    <p className="text-[11px] text-muted-foreground font-mono truncate">{artifact.filePath}</p>
                  </div>
                  <div className="shrink-0">
                    <InlineReviewAction analysisId={overview.analysisId} itemId={artifact.traceabilityLinkIds[0]} itemType="impact" itemTitle={artifact.name} currentStatus={artifact.reviewDecision.toUpperCase()} isStale={driftStatus.isStale} />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Top Risks and Unknowns */}
        <div className="rounded-lg border border-border/40 bg-surface flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b border-border/40 bg-surface-muted/30 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-warning" />
            <h2 className="text-[13px] font-semibold text-foreground">{labels.topHighRisksUnknowns}</h2>
          </div>
          <div className="flex flex-col divide-y divide-border/40">
            {topRisksAndUnknowns.length === 0 ? (
              <div className="p-6 text-center text-[13px] text-muted-foreground">{labels.noHighRisksUnknowns}</div>
            ) : (
              topRisksAndUnknowns.map((item) => (
                <div key={item.type === "risk" ? item.riskId : item.unknownId} className="flex items-start gap-4 p-4 hover:bg-surface-muted/30 transition-colors">
                  <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                    <p className="text-[13px] font-semibold text-foreground leading-tight">{item.title}</p>
                    <p className="text-[11px] text-muted-foreground uppercase tracking-wider">{item.type}</p>
                  </div>
                  <div className="shrink-0">
                    <InlineReviewAction analysisId={overview.analysisId} itemId={item.sourceInsightId ?? (item.type === "risk" ? item.riskId : item.unknownId)} itemType="insight" itemTitle={item.title} currentStatus={item.reviewDecision.toUpperCase()} isStale={driftStatus.isStale} />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

function formatDerivedSummary({
  requirementTitle,
  statusLabel,
  impactedArtifacts,
  risks,
  evidenceItems,
  pendingReviewItems,
  reviewComplete,
  isStale,
  locale,
}: {
  requirementTitle: string
  statusLabel: string
  impactedArtifacts: number
  risks: number
  evidenceItems: number
  pendingReviewItems: number
  reviewComplete: boolean
  isStale: boolean
  locale: SupportedLocale
}) {
  if (locale === "vi-VN") {
    return `Phân tích yêu cầu "${requirementTitle}" đang ở trạng thái ${statusLabel}. Đã xác định ${impactedArtifacts} artifact bị ảnh hưởng và ${risks} rủi ro, được hỗ trợ bởi ${evidenceItems} mục bằng chứng. ${
      reviewComplete ? "Tất cả mục đã được xem xét." : `${pendingReviewItems} mục đang chờ xem xét.`
    } ${isStale ? "Cảnh báo: phân tích đã stale và cần chạy lại với commit mới nhất." : "Phân tích đang khớp với snapshot."}`
  }

  if (locale === "ja-JP") {
    return `要件 "${requirementTitle}" の分析は ${statusLabel} です。${impactedArtifacts} 件の影響 artifact と ${risks} 件のリスクを、${evidenceItems} 件の evidence items で特定しました。${
      reviewComplete ? "すべての項目はレビュー済みです。" : `${pendingReviewItems} 件がレビュー待ちです。`
    } ${isStale ? "警告: 分析は stale です。最新 commit で再実行してください。" : "分析は snapshot と一致しています。"}`
  }

  return `Analysis of requirement "${requirementTitle}" is ${statusLabel}. Identified ${impactedArtifacts} impacted artifacts and ${risks} risks supported by ${evidenceItems} evidence items. ${
    reviewComplete ? "All items have been reviewed." : `${pendingReviewItems} items are pending review.`
  } ${isStale ? "Warning: Analysis is stale and needs to be re-run against the latest commit." : "Analysis is up to date with the snapshot."}`
}

function InfoRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex flex-col justify-center p-4 min-w-0">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className={`mt-1 truncate text-[13px] text-foreground ${mono ? "font-mono text-[12px]" : "font-medium"}`}>
        {value}
      </span>
    </div>
  )
}
