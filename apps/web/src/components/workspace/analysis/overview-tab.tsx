"use client"

import type { AnalysisWorkspaceResponse } from "@ba-helper/contracts"
import {
  driftStatusLabels,
  getLocalizedLabel,
  reportStatusLabels,
  reviewDecisionLabels,
  analysisStatusLabels,
  type SupportedLocale,
} from "@/lib/i18n/status-labels"
import type { AnalysisWorkspaceLabels } from "@/lib/i18n/analysis-labels"
import { Badge } from "@/components/ui/badge"
import { AlertTriangle, Code } from "lucide-react"
import { DenseCard, DenseCardHeader, DenseCardTitle } from "../shared/dense-card"

/**
 * Summary is a read-only executive overview. It never repeats the review queue
 * or the evidence explorer and never mutates a decision — the review workbench
 * is the only place decisions are made.
 */
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

  const topRisksAndUnknowns = [
    ...risks.filter((r) => r.severity === "high").map((r) => ({ ...r, type: "risk" as const })),
    ...unknowns.map((u) => ({ ...u, type: "unknown" as const })),
  ].slice(0, 5)
  const topImpacts = impactGroups.flatMap((g) => g.artifacts).slice(0, 5)

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
      <DenseCard>
        <DenseCardHeader className="border-b border-border/40 bg-surface-muted/30 px-4 py-3">
          <DenseCardTitle>{labels.derivedAnalysisSummary}</DenseCardTitle>
        </DenseCardHeader>
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
      </DenseCard>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Top Impacted Artifacts (read-only) */}
        <DenseCard>
          <DenseCardHeader className="flex-row items-center gap-2 border-b border-border/40 bg-surface-muted/30 px-4 py-3">
            <Code className="w-4 h-4 text-primary" />
            <DenseCardTitle>{labels.topImpactedArtifacts}</DenseCardTitle>
          </DenseCardHeader>
          <div className="flex flex-col divide-y divide-border/40">
            {topImpacts.length === 0 ? (
              <div className="p-6 text-center text-[13px] text-muted-foreground">{labels.noImpactedArtifacts}</div>
            ) : (
              topImpacts.map((artifact) => (
                <div key={artifact.artifactId} className="flex items-center justify-between gap-4 p-4">
                  <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                    <p className="text-[13px] font-semibold text-foreground truncate">{artifact.name}</p>
                    <p className="text-[11px] text-muted-foreground font-mono truncate">{artifact.filePath}</p>
                  </div>
                  <Badge variant="outline" className="shrink-0">
                    {getLocalizedLabel(reviewDecisionLabels, artifact.reviewDecision, locale)}
                  </Badge>
                </div>
              ))
            )}
          </div>
        </DenseCard>

        {/* Top Risks and Unknowns (read-only) */}
        <DenseCard>
          <DenseCardHeader className="flex-row items-center gap-2 border-b border-border/40 bg-surface-muted/30 px-4 py-3">
            <AlertTriangle className="w-4 h-4 text-warning" />
            <DenseCardTitle>{labels.topHighRisksUnknowns}</DenseCardTitle>
          </DenseCardHeader>
          <div className="flex flex-col divide-y divide-border/40">
            {topRisksAndUnknowns.length === 0 ? (
              <div className="p-6 text-center text-[13px] text-muted-foreground">{labels.noHighRisksUnknowns}</div>
            ) : (
              topRisksAndUnknowns.map((item) => (
                <div key={item.type === "risk" ? item.riskId : item.unknownId} className="flex items-start justify-between gap-4 p-4">
                  <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                    <p className="text-[13px] font-semibold text-foreground leading-tight">{item.title}</p>
                    <p className="text-[11px] text-muted-foreground uppercase tracking-wider">{item.type}</p>
                  </div>
                  <Badge variant="outline" className="shrink-0">
                    {getLocalizedLabel(reviewDecisionLabels, item.reviewDecision, locale)}
                  </Badge>
                </div>
              ))
            )}
          </div>
        </DenseCard>
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
      <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className={`mt-1 truncate text-[13px] text-foreground ${mono ? "font-mono text-[12px]" : "font-medium"}`}>{value}</span>
    </div>
  )
}
