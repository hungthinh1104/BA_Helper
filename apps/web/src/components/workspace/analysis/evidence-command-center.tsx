"use client"

import { useMemo } from "react"
import type { ReactNode } from "react"
import type { AnalysisWorkspaceResponse } from "@ba-helper/contracts"
import { AlertTriangle, Code, FileWarning, ShieldCheck } from "lucide-react"
import type { AnalysisWorkspaceLabels } from "@/lib/i18n/analysis-labels"
import {
  DenseCard,
  DenseCardDescription,
  DenseCardHeader,
  DenseCardTitle,
} from "../shared/dense-card"

type OverviewLabels = AnalysisWorkspaceLabels["overview"]

export function EvidenceCommandCenter({
  workspace,
  labels,
}: {
  workspace: AnalysisWorkspaceResponse
  labels: OverviewLabels
}) {
  const model = useMemo(() => buildEvidenceModel(workspace), [workspace])

  return (
    <DenseCard>
      <DenseCardHeader className="border-b border-border/40 bg-surface-muted/30 px-4 py-3">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <DenseCardTitle>{labels.evidenceCommandCenter}</DenseCardTitle>
            <DenseCardDescription>{labels.evidenceCommandCenterDescription}</DenseCardDescription>
          </div>
          <span className="w-fit rounded border border-border/60 bg-background/60 px-2 py-1 text-[11px] font-mono text-muted-foreground">
            {labels.sourceSnapshot.replace("{commit}", workspace.overview.snapshot.commitSha.slice(0, 7))}
          </span>
        </div>
      </DenseCardHeader>

      <div className="grid gap-px bg-border/40 md:grid-cols-4">
        <EvidenceStat
          label={labels.codeEvidence}
          value={model.codeEvidence.length}
          detail={labels.codeEvidenceDetail.replace("{count}", String(model.codeEvidence.length))}
          icon={<Code className="h-4 w-4" />}
        />
        <EvidenceStat
          label={labels.artifactEvidenceCoverage}
          value={formatPercent(model.coverageRatio)}
          detail={labels.artifactEvidenceCoverageDetail
            .replace("{supported}", String(model.artifactsWithEvidence))
            .replace("{total}", String(model.totalArtifacts))}
          icon={<ShieldCheck className="h-4 w-4" />}
        />
        <EvidenceStat
          label={labels.missingEvidence}
          value={model.missingEvidenceArtifacts.length}
          detail={labels.missingEvidenceDetail}
          icon={<FileWarning className="h-4 w-4" />}
          tone={model.missingEvidenceArtifacts.length > 0 ? "warning" : "success"}
        />
        <EvidenceStat
          label={labels.blockersWithoutEvidence}
          value={model.blockersWithoutEvidence.length}
          detail={labels.blockersWithoutEvidenceDetail}
          icon={<AlertTriangle className="h-4 w-4" />}
          tone={model.blockersWithoutEvidence.length > 0 ? "danger" : "success"}
        />
      </div>

      <div className="grid gap-0 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="border-t border-border/40 lg:border-r">
          <div className="border-b border-border/40 px-4 py-3">
            <h3 className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
              {labels.codeEvidenceExcerpts}
            </h3>
          </div>
          <div className="flex flex-col divide-y divide-border/40">
            {model.codeEvidence.length === 0 ? (
              <EmptyState label={labels.noCodeEvidence} />
            ) : (
              model.codeEvidence.slice(0, 4).map((evidence) => (
                <article key={evidence.evidenceId} className="p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {evidence.sourceType}
                    </span>
                    <span className="font-mono text-[11px] text-muted-foreground">
                      {formatEvidenceLocation(evidence, labels)}
                    </span>
                  </div>
                  <p className="mt-2 truncate font-mono text-[12px] text-foreground">
                    {evidence.artifactKey ?? evidence.filePath ?? labels.unlinkedEvidence}
                  </p>
                  <pre className="mt-2 max-h-24 overflow-hidden rounded border border-border/40 bg-background/70 p-2 text-[11px] leading-relaxed text-foreground">
                    <code>{evidence.excerpt}</code>
                  </pre>
                  <p className="mt-2 line-clamp-2 text-[12px] leading-relaxed text-muted-foreground">
                    {evidence.relevanceReason}
                  </p>
                </article>
              ))
            )}
          </div>
        </div>

        <div className="border-t border-border/40">
          <div className="border-b border-border/40 px-4 py-3">
            <h3 className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
              {labels.evidenceGaps}
            </h3>
          </div>
          <div className="flex flex-col divide-y divide-border/40">
            {model.missingEvidenceArtifacts.length === 0 &&
            model.blockersWithoutEvidence.length === 0 ? (
              <EmptyState label={labels.noEvidenceGaps} />
            ) : (
              <>
                {model.missingEvidenceArtifacts.slice(0, 4).map((artifact) => (
                  <div key={artifact.artifactId} className="p-4">
                    <p className="truncate text-[13px] font-semibold text-foreground">
                      {artifact.name}
                    </p>
                    <p className="mt-1 truncate font-mono text-[11px] text-muted-foreground">
                      {artifact.filePath}
                    </p>
                    <p className="mt-2 text-[11px] uppercase tracking-wide text-warning">
                      {labels.artifactHasNoEvidence}
                    </p>
                  </div>
                ))}
                {model.blockersWithoutEvidence.slice(0, 3).map((item) => (
                  <div key={`${item.itemType}:${item.itemId}`} className="p-4">
                    <p className="line-clamp-2 text-[13px] font-semibold text-foreground">
                      {item.title}
                    </p>
                    <p className="mt-1 text-[11px] uppercase tracking-wide text-destructive">
                      {labels.blockingItemWithoutEvidence.replace("{type}", item.itemType)}
                    </p>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      </div>
    </DenseCard>
  )
}

function EvidenceStat({
  label,
  value,
  detail,
  icon,
  tone = "neutral",
}: {
  label: string
  value: string | number
  detail: string
  icon: ReactNode
  tone?: "neutral" | "success" | "warning" | "danger"
}) {
  return (
    <div className="bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          <p className="mt-2 text-2xl font-semibold text-foreground">{value}</p>
        </div>
        <span
          className={`rounded-md border p-2 ${
            tone === "success"
              ? "border-success/20 bg-success/10 text-success"
              : tone === "warning"
                ? "border-warning/20 bg-warning/10 text-warning"
                : tone === "danger"
                  ? "border-destructive/20 bg-destructive/10 text-destructive"
                  : "border-border/50 bg-surface-muted text-muted-foreground"
          }`}
        >
          {icon}
        </span>
      </div>
      <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">{detail}</p>
    </div>
  )
}

function EmptyState({ label }: { label: string }) {
  return <div className="p-6 text-center text-[13px] text-muted-foreground">{label}</div>
}

function buildEvidenceModel(workspace: AnalysisWorkspaceResponse) {
  const artifacts = workspace.impactGroups.flatMap((group) => group.artifacts)
  const codeEvidence = workspace.evidenceCards.filter((evidence) =>
    ["code", "test", "static_analysis"].includes(evidence.sourceType),
  )
  const artifactsWithEvidence = artifacts.filter(
    (artifact) => artifact.evidenceIds.length > 0,
  ).length

  return {
    totalArtifacts: artifacts.length,
    artifactsWithEvidence,
    coverageRatio: ratio(artifactsWithEvidence, artifacts.length),
    codeEvidence,
    missingEvidenceArtifacts: artifacts.filter(
      (artifact) => artifact.evidenceIds.length === 0,
    ),
    blockersWithoutEvidence: workspace.reviewQueue.filter(
      (item) => item.blockingFinalize && item.linkedEvidenceIds.length === 0,
    ),
  }
}

function ratio(numerator: number, denominator: number) {
  if (denominator <= 0) return 0
  return Math.max(0, Math.min(1, numerator / denominator))
}

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`
}

function formatEvidenceLocation(
  evidence: AnalysisWorkspaceResponse["evidenceCards"][number],
  labels: OverviewLabels,
) {
  const { startLine, endLine } = evidence.lineRange
  const path = evidence.filePath ?? labels.noFilePath
  if (!startLine && !endLine) return `${path} · ${labels.noLineRange}`
  if (startLine && endLine) return `${path}:L${startLine}-L${endLine}`
  return `${path}:L${startLine ?? endLine}`
}
