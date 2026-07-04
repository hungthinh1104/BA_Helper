import React from "react"
import Link from "next/link"
import { useTranslations } from "next-intl"
import { AlertCircle, CheckCircle2, ShieldAlert } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useReviewCoverage } from "@/hooks/api/use-review-coverage"
import { ReviewCoverageGate } from "@ba-helper/contracts"
import { MetricCard } from "@/components/workspace/shared/primitives"
import {
  DenseAlert,
  DenseCard,
  DenseCardContent,
  DenseCardHeader,
  DenseCardTitle,
} from "@/components/workspace/shared/dense-card"


function GateStatusBadge({ status }: { status: "PASS" | "WARN" | "FAIL" }) {
  const t = useTranslations("workspace")
  if (status === "PASS") {
    return (
      <span className="inline-flex items-center gap-1 rounded-md border border-[var(--success-soft)] bg-[var(--success-soft)] px-2 py-0.5 text-[10px] font-semibold uppercase text-[var(--success)]">
        <CheckCircle2 className="h-3 w-3" />
        {t("pass")}
      </span>
    )
  }
  if (status === "WARN") {
    return (
      <span className="inline-flex items-center gap-1 rounded-md border border-[var(--warning-soft)] bg-[var(--warning-soft)] px-2 py-0.5 text-[10px] font-semibold uppercase text-[var(--warning)]">
        <AlertCircle className="h-3 w-3" />
        {t("warn")}
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-[var(--danger-soft)] bg-[var(--danger-soft)] px-2 py-0.5 text-[10px] font-semibold uppercase text-[var(--danger)]">
      <ShieldAlert className="h-3 w-3" />
      {t("fail")}
    </span>
  )
}

function GateItem({ gate }: { gate: ReviewCoverageGate }) {
  const t = useTranslations("workspace")
  const affectedAnalysisCount = gate.affectedAnalysisIds?.length ?? 0
  const affectedArtifactCount = gate.affectedArtifactIds?.length ?? 0
  const affectedInsightCount = gate.affectedInsightIds?.length ?? 0
  const affectedRepoCount = gate.affectedRepositoryIds?.length ?? 0

  return (
    <DenseCard variant="muted" className="gap-2 p-3 text-[13px] transition-colors hover:bg-surface-soft">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <GateStatusBadge status={gate.status} />
            <span className="font-semibold text-[var(--text-primary)]">{gate.title}</span>
          </div>
          <div className="text-[var(--text-secondary)]">{gate.description}</div>
        </div>
        <div className="shrink-0 text-right text-[11px] font-mono text-[var(--text-tertiary)]">
          {gate.category}
        </div>
      </div>

      <div className="mt-1 space-y-2">
        {gate.recommendedAction && (
          <div className="rounded border border-[var(--accent-soft)] bg-[var(--accent-soft)] px-2 py-1.5 text-[12px] text-[var(--text-primary)]">
            <span className="font-medium text-[var(--accent)]">{t("action")}: </span>
            {gate.recommendedAction}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-[var(--text-tertiary)]">
          {affectedRepoCount > 0 && <span>{t("repositoriesAffected", { count: affectedRepoCount })}</span>}
          {affectedArtifactCount > 0 && <span>{t("artifactsAffected", { count: affectedArtifactCount })}</span>}
          {affectedInsightCount > 0 && <span>{t("insightsAffected", { count: affectedInsightCount })}</span>}
          
          {affectedAnalysisCount > 0 && (
            <div className="flex items-center gap-1">
              <span>{t("analyses")}:</span>
              <div className="flex flex-wrap items-center gap-1">
                {gate.affectedAnalysisIds!.map((id) => (
                  <Link
                    key={id}
                    href={`/analyses/${id}`}
                    className="font-mono text-[var(--accent)] hover:underline"
                  >
                    {id.substring(0, 8)}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </DenseCard>
  )
}

export function ReviewCoveragePanel({ runId }: { runId: string }) {
  const t = useTranslations("workspace")
  const { data, isLoading, isError } = useReviewCoverage(runId)

  if (isLoading) {
    return (
      <div className="mb-6 space-y-4">
        <div className="text-lg font-semibold tracking-tight text-[var(--text-primary)]">{t("reviewCoverage")}</div>
        <DenseCard className="p-4 shadow-sm">
          <div className="space-y-4">
            <Skeleton className="h-10 w-full max-w-sm" />
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
              {[...Array(6)].map((_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          </div>
        </DenseCard>
      </div>
    )
  }

  if (isError) {
    return (
      <div className="mb-6 space-y-4">
        <div className="text-lg font-semibold tracking-tight text-[var(--text-primary)]">{t("reviewCoverage")}</div>
        <DenseAlert variant="danger" className="text-[13px] shadow-sm">
          <AlertCircle className="mr-2 inline-block h-4 w-4" />
          {t("unableLoadReviewCoverage")}
        </DenseAlert>
      </div>
    )
  }

  if (!data) return null

  return (
    <div className="mb-6 space-y-4">
      <div className="text-lg font-semibold tracking-tight text-[var(--text-primary)]">{t("reviewCoverage")}</div>
      
      <DenseCard className="shadow-sm">
        <DenseCardHeader className="border-b border-border/40 bg-surface-muted/30 px-4 py-3">
          <div className="flex items-center gap-3">
            {data.status === "PASS" && (
              <div className="flex items-center gap-2 text-[var(--success)]">
                <CheckCircle2 className="h-5 w-5" />
                <span className="font-semibold uppercase tracking-wide">{t("reviewCoveragePassMessage")}</span>
              </div>
            )}
            {data.status === "WARN" && (
              <div className="flex items-center gap-2 text-[var(--warning)]">
                <AlertCircle className="h-5 w-5" />
                <span className="font-semibold uppercase tracking-wide">{t("reviewCoverageWarnMessage")}</span>
              </div>
            )}
            {data.status === "FAIL" && (
              <div className="flex items-center gap-2 text-[var(--danger)]">
                <ShieldAlert className="h-5 w-5" />
                <span className="font-semibold uppercase tracking-wide">{t("reviewCoverageFailMessage")}</span>
              </div>
            )}
          </div>
        </DenseCardHeader>

        <DenseCardContent className="p-4">
          <div className="grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-3 mb-6">
            <MetricCard label={t("reposAccepted")} value={data.summary.acceptedRepositories} />
            <MetricCard label={t("impactedArtifacts")} value={data.summary.impactedArtifacts} />
            <MetricCard
              label={t("uncoveredArtifacts")}
              value={data.summary.uncoveredArtifacts}
              accent={data.summary.uncoveredArtifacts > 0 ? "warning" : "success"}
            />
            <MetricCard
              label={t("risksWithoutQa")}
              value={data.summary.risksWithoutQa}
              accent={data.summary.risksWithoutQa > 0 ? "warning" : "success"}
            />
            <MetricCard
              label={t("warningGates")}
              value={data.summary.warningGates}
              accent={data.summary.warningGates > 0 ? "warning" : "success"}
            />
            <MetricCard
              label={t("blockingGates")}
              value={data.summary.blockingGates}
              accent={data.summary.blockingGates > 0 ? "danger" : "success"}
            />
          </div>

          <div className="space-y-3">
            <DenseCardTitle>{t("coverageGates")}</DenseCardTitle>
            {data.gates.length === 0 ? (
              <div className="text-[13px] text-[var(--text-tertiary)] italic">
                {data.status === "PASS" ? t("noReviewCoverageGaps") : t("noGateDataAvailable")}
              </div>
            ) : (
              <ScrollArea className="h-[400px] rounded-md border border-[var(--border)] pr-4">
                <div className="flex flex-col gap-3 p-1">
                  {data.gates.map((gate) => (
                    <GateItem key={gate.gateId} gate={gate} />
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>
        </DenseCardContent>
      </DenseCard>
    </div>
  )
}
