"use client"

import type {
  DiffArtifact,
  DiffInsight,
  ImpactAnalysisDiffResponse,
  AnalysisWorkspaceResponse,
} from "@ba-helper/contracts"
import type { ReactNode } from "react"
import { AlertCircle, GitCompareArrows, Loader2, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { AnalysisWorkspaceLabels } from "@/lib/i18n/analysis-labels"
import { getLocalizedLabel, reviewDecisionLabels, type SupportedLocale } from "@/lib/i18n/status-labels"
import { useAnalysisDiff, useAnalysisLineage } from "@/hooks/api/use-analyses"
import {
  buildLineageDiffSummary,
  hasMaterialDiff,
  isNoBaselineDiffError,
} from "./lineage-diff-view-model"

type LineageDiffLabels = AnalysisWorkspaceLabels["lineageDiff"]

export function LineageDiffTab({
  workspace,
  locale,
  labels,
}: {
  workspace: AnalysisWorkspaceResponse
  locale: SupportedLocale
  labels: LineageDiffLabels
}) {
  const analysisId = workspace.overview.analysisId
  const diffQuery = useAnalysisDiff(analysisId)
  const lineageQuery = useAnalysisLineage(analysisId)
  const diff = diffQuery.data
  const lineage = lineageQuery.data
  const isNoParent = isNoBaselineDiffError(diffQuery.error)
  const summary = buildLineageDiffSummary({
    currentAnalysisId: analysisId,
    diff,
    lineage,
    diffError: diffQuery.error,
  })

  if ((diffQuery.isLoading && !isNoParent) || lineageQuery.isLoading) {
    return (
      <div className="rounded-lg border border-border/60 bg-surface p-8 text-center text-sm text-muted-foreground">
        <Loader2 className="mx-auto mb-3 h-5 w-5 animate-spin" />
        {labels.loading}
      </div>
    )
  }

  if (diffQuery.error && !isNoParent) {
    return (
      <div className="rounded-lg border border-border/60 bg-surface p-8 text-center">
        <AlertCircle className="mx-auto mb-3 h-6 w-6 text-warning" />
        <h2 className="text-sm font-semibold text-foreground">{labels.unavailableTitle}</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {diffQuery.error instanceof Error ? diffQuery.error.message : labels.diffNotAvailable}
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-4 gap-2 shadow-none"
          onClick={() => diffQuery.refetch()}
        >
          <RefreshCw className="h-3.5 w-3.5" />
          {labels.retry}
        </Button>
      </div>
    )
  }

  return (
    <section className="grid gap-4">
      <div className="rounded-lg border border-border/60 bg-surface p-4">
        <div className="flex items-start gap-3">
          <GitCompareArrows className="mt-0.5 h-5 w-5 text-muted-foreground" />
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-foreground">{labels.title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{labels.description}</p>
          </div>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <InfoRow label={labels.currentAnalysisId} value={summary.currentAnalysisId} mono />
          <InfoRow label={labels.parentAnalysisId} value={summary.parentAnalysisId ?? labels.none} mono />
          <InfoRow label={labels.diffStatus} value={formatDiffStatus(summary.diffStatus, labels)} />
          <InfoRow label={labels.sourceClarificationId} value={summary.sourceClarificationId ?? labels.none} mono />
          <InfoRow
            label={labels.sourceReviewClarificationRequestId}
            value={summary.sourceReviewClarificationRequestId ?? labels.none}
            mono
          />
          <InfoRow label={labels.oldSnapshotCommit} value={summary.previousSnapshot?.commitSha ?? labels.none} mono />
          <InfoRow label={labels.newSnapshotCommit} value={summary.currentSnapshot?.commitSha ?? workspace.overview.snapshot.commitSha} mono />
        </div>
      </div>

      {isNoParent ? (
        <EmptyPanel title={labels.noParentTitle} description={labels.noParentDescription} />
      ) : null}

      {diff ? (
        <>
          {(diff.diagnostics?.length ?? 0) > 0 ? (
            <div className="rounded-lg border border-warning/30 bg-warning/5 p-4">
              <h3 className="text-sm font-semibold text-foreground">{labels.diagnostics}</h3>
              <div className="mt-3 grid gap-2">
                {diff.diagnostics?.map((diagnostic) => (
                  <p key={`${diagnostic.code}:${diagnostic.message}`} className="text-sm text-muted-foreground">
                    {diagnostic.message}
                  </p>
                ))}
              </div>
            </div>
          ) : null}

          {!hasMaterialDiff(diff) ? (
            <EmptyPanel title={labels.noMaterialChanges} />
          ) : null}

          <ArtifactDiffSection diff={diff} locale={locale} labels={labels} />
          <UnknownDiffSection diff={diff} locale={locale} labels={labels} />
          <QaDiffSection diff={diff} locale={locale} labels={labels} />
          <EvidenceDiffSection labels={labels} />
        </>
      ) : null}
    </section>
  )
}

function formatDiffStatus(status: string, labels: LineageDiffLabels) {
  if (status === "available") return labels.diffAvailable
  if (status === "not_applicable") return labels.diffNotApplicable
  return labels.diffNotAvailable
}

function ArtifactDiffSection({
  diff,
  locale,
  labels,
}: {
  diff: ImpactAnalysisDiffResponse
  locale: SupportedLocale
  labels: LineageDiffLabels
}) {
  return (
    <DiffSection title={labels.impactedArtifacts}>
      <ArtifactGroup title={labels.added} items={diff.addedArtifacts} tone="success" locale={locale} labels={labels} />
      <ArtifactGroup title={labels.removed} items={diff.removedArtifacts} tone="danger" locale={locale} labels={labels} />
      <UnavailableGroup title={labels.changed} message={labels.unavailableGroup} />
      <ArtifactGroup title={labels.unchanged} items={diff.unchangedArtifacts} tone="neutral" locale={locale} labels={labels} />
    </DiffSection>
  )
}

function UnknownDiffSection({
  diff,
  locale,
  labels,
}: {
  diff: ImpactAnalysisDiffResponse
  locale: SupportedLocale
  labels: LineageDiffLabels
}) {
  return (
    <DiffSection title={labels.unknowns}>
      <InsightGroup title={labels.resolved} items={diff.resolvedUnknowns} tone="success" locale={locale} labels={labels} />
      <InsightGroup title={labels.newUnknowns} items={diff.newUnknowns} tone="warning" locale={locale} labels={labels} />
      <UnavailableGroup title={labels.stillUnresolved} message={labels.unavailableGroup} />
      <InsightGroup title={labels.removed} items={diff.removedUnknowns} tone="neutral" locale={locale} labels={labels} />
    </DiffSection>
  )
}

function QaDiffSection({
  diff,
  locale,
  labels,
}: {
  diff: ImpactAnalysisDiffResponse
  locale: SupportedLocale
  labels: LineageDiffLabels
}) {
  return (
    <DiffSection title={labels.qaScenarios}>
      <InsightGroup title={labels.addedScenarios} items={diff.addedQaScenarios} tone="info" locale={locale} labels={labels} />
      <UnavailableGroup title={labels.removedScenarios} message={labels.unavailableGroup} />
      <UnavailableGroup title={labels.changedScenarios} message={labels.unavailableGroup} />
      <UnavailableGroup title={labels.unchangedScenarios} message={labels.unavailableGroup} />
    </DiffSection>
  )
}

function EvidenceDiffSection({ labels }: { labels: LineageDiffLabels }) {
  return (
    <DiffSection title={labels.evidence}>
      <div className="rounded-md border border-border/50 bg-background/40 p-4 text-sm text-muted-foreground">
        {labels.evidenceUnavailable}
      </div>
    </DiffSection>
  )
}

function DiffSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-lg border border-border/60 bg-surface p-4">
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      <div className="mt-4 grid gap-3 xl:grid-cols-2">{children}</div>
    </div>
  )
}

function ArtifactGroup({
  title,
  items,
  tone,
  locale,
  labels,
}: {
  title: string
  items: DiffArtifact[]
  tone: "success" | "danger" | "neutral"
  locale: SupportedLocale
  labels: LineageDiffLabels
}) {
  return (
    <div className="rounded-md border border-border/50 bg-background/40 p-3">
      <GroupHeader title={title} count={items.length} />
      <div className="mt-3 grid gap-2">
        {items.length === 0 ? <p className="text-sm text-muted-foreground">{labels.noItems}</p> : null}
        {items.map((item) => (
          <article key={`${title}:${item.artifactKey}`} className={`rounded-md border p-3 ${toneClass(tone)}`}>
            <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
              <div className="min-w-0">
                <h3 className="truncate text-sm font-medium text-foreground">{item.name}</h3>
                <p className="mt-1 truncate font-mono text-xs text-muted-foreground">{item.filePath}</p>
              </div>
              <span className="shrink-0 rounded border border-border/50 bg-surface px-2 py-1 text-[11px] text-muted-foreground">
                {item.universalKind}
              </span>
            </div>
            <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
              <span>{labels.artifactType}: {item.artifactType}</span>
              <span>{labels.review}: {getLocalizedLabel(reviewDecisionLabels, item.reviewStatus, locale)}</span>
              <span className="font-mono">{item.artifactKey}</span>
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}

function InsightGroup({
  title,
  items,
  tone,
  locale,
  labels,
}: {
  title: string
  items: DiffInsight[]
  tone: "success" | "warning" | "neutral" | "info"
  locale: SupportedLocale
  labels: LineageDiffLabels
}) {
  return (
    <div className="rounded-md border border-border/50 bg-background/40 p-3">
      <GroupHeader title={title} count={items.length} />
      <div className="mt-3 grid gap-2">
        {items.length === 0 ? <p className="text-sm text-muted-foreground">{labels.noItems}</p> : null}
        {items.map((item) => (
          <article key={`${title}:${item.insightKey}`} className={`rounded-md border p-3 ${toneClass(tone)}`}>
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
              <span className="rounded border border-border/50 bg-surface px-2 py-1">{item.category}</span>
              <span>{labels.review}: {getLocalizedLabel(reviewDecisionLabels, item.reviewStatus, locale)}</span>
              <span className="font-mono">{item.insightKey}</span>
            </div>
            <p className="mt-2 text-sm text-foreground">{item.statement}</p>
          </article>
        ))}
      </div>
    </div>
  )
}

function UnavailableGroup({ title, message }: { title: string; message: string }) {
  return (
    <div className="rounded-md border border-border/50 bg-background/40 p-3">
      <GroupHeader title={title} count={0} />
      <p className="mt-3 text-sm text-muted-foreground">{message}</p>
    </div>
  )
}

function GroupHeader({ title, count }: { title: string; count: number }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h3 className="text-sm font-medium text-foreground">{title}</h3>
      <span className="text-xs text-muted-foreground">{count}</span>
    </div>
  )
}

function EmptyPanel({ title, description }: { title: string; description?: string }) {
  return (
    <div className="rounded-lg border border-border/60 bg-surface p-8 text-center">
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      {description ? <p className="mt-2 text-sm text-muted-foreground">{description}</p> : null}
    </div>
  )
}

function InfoRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="min-w-0 rounded-md border border-border/50 bg-background/40 p-3">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className={`mt-1 truncate text-sm text-foreground ${mono ? "font-mono" : ""}`}>
        {value}
      </div>
    </div>
  )
}

function toneClass(tone: "success" | "danger" | "warning" | "neutral" | "info") {
  if (tone === "success") return "border-success/20 bg-success/5"
  if (tone === "danger") return "border-danger/20 bg-danger/5"
  if (tone === "warning") return "border-warning/30 bg-warning/5"
  if (tone === "info") return "border-info/20 bg-info/5"
  return "border-border/50 bg-surface/40"
}
