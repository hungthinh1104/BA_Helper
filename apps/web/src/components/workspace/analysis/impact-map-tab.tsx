"use client"

import type { AnalysisWorkspaceResponse } from "@ba-helper/contracts"
import { ArtifactKindBadge } from "@/components/workspace/shared/status-badges"
import { cn } from "@/lib/utils"
import { evidenceBasisLabels, getLocalizedLabel, type SupportedLocale } from "@/lib/i18n/status-labels"
import type { AnalysisWorkspaceLabels } from "@/lib/i18n/analysis-labels"
import { InlineReviewAction } from "../shared/inline-review-action"
import { DenseCard, DenseCardDescription, DenseCardHeader, DenseCardTitle } from "../shared/dense-card"

type ImpactGroup = AnalysisWorkspaceResponse["impactGroups"][number]
type Artifact = ImpactGroup["artifacts"][number]
type EvidenceCard = AnalysisWorkspaceResponse["evidenceCards"][number]

export function ImpactMapTab({
  groups,
  evidenceCards,
  locale,
  labels,
  analysisId,
  isStale,
}: {
  groups: ImpactGroup[]
  evidenceCards: EvidenceCard[]
  locale: SupportedLocale
  labels: AnalysisWorkspaceLabels["impactMap"]
  analysisId: string
  isStale: boolean
}) {
  if (groups.length === 0) {
    return <EmptyState title={labels.empty} />
  }

  return (
    <section className="grid gap-4">
      {groups.map((group) => (
        <DenseCard key={group.group}>
          <DenseCardHeader className="border-b border-border/40 bg-surface-muted/30 px-4 py-3">
            <DenseCardTitle>{group.title}</DenseCardTitle>
            <DenseCardDescription>{group.description}</DenseCardDescription>
          </DenseCardHeader>
          <div className="flex flex-col divide-y divide-border/40">
            {group.artifacts.map((artifact) => {
              const firstEvidence = artifact.evidenceIds.length > 0
                ? evidenceCards.find(e => e.evidenceId === artifact.evidenceIds[0])
                : undefined;

              return (
                <article
                  key={`${artifact.artifactId}:${artifact.traceabilityLinkIds.join(",")}`}
                  className="flex flex-col p-4 hover:bg-surface-muted/30 transition-colors gap-3"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-[10px] font-medium bg-muted text-muted-foreground px-1.5 py-0.5 rounded font-mono">
                          {artifact.artifactKey}
                        </span>
                        <ArtifactKindBadge kind={artifact.universalKind} />
                      </div>
                      <h3 className="truncate text-[13px] font-semibold text-foreground">
                        {artifact.name}
                      </h3>
                      <p className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground">
                        {artifact.filePath}
                      </p>
                      <p className="mt-2 text-[13px] text-muted-foreground leading-relaxed">
                        {artifact.impactReason || labels.fallbackImpactReason}
                      </p>

                      {firstEvidence && (
                        <pre className="mt-3 overflow-x-auto rounded border border-border/40 bg-background/60 p-2 text-[11px] leading-relaxed text-foreground font-mono">
                          <code>{firstEvidence.excerpt}</code>
                        </pre>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-3 shrink-0">
                      <InlineReviewAction analysisId={analysisId} itemId={artifact.traceabilityLinkIds[0]} itemType="impact" itemTitle={artifact.name} currentStatus={artifact.reviewDecision.toUpperCase()} isStale={isStale} />
                      <div className="flex flex-col items-end gap-1.5">
                        <ImpactBasisBadge basis={artifact.impactBasis} locale={locale} labels={labels} />
                        <span className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">
                          {artifact.evidenceIds.length} {labels.evidence}
                        </span>
                      </div>
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        </DenseCard>
      ))}
    </section>
  )
}

function ImpactBasisBadge({
  basis,
  locale,
  labels,
}: {
  basis: Artifact["impactBasis"]
  locale: SupportedLocale
  labels: AnalysisWorkspaceLabels["impactMap"]
}) {
  const config = {
    evidenced: {
      className: "border-success/30 bg-success/10 text-success",
      title: labels.evidencedDescription,
    },
    inferred: {
      className: "border-warning/30 bg-warning/10 text-warning",
      title: labels.inferredDescription,
    },
    unknown: {
      className: "border-border/60 bg-surface-muted text-muted-foreground",
      title: labels.unknownDescription,
    },
    conflicting: {
      className: "border-danger/30 bg-danger/10 text-danger",
      title: labels.conflictingDescription,
    },
  } as const

  const meta = config[basis] ?? config.unknown
  const label = getLocalizedLabel(evidenceBasisLabels, basis, locale)

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        meta.className,
      )}
      title={meta.title}
    >
      {basis === "inferred" && (
        <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
      )}
      {label}
    </span>
  )
}

function EmptyState({ title }: { title: string }) {
  return (
    <DenseCard className="p-8 text-center text-sm text-muted-foreground">
      {title}
    </DenseCard>
  )
}
