"use client"

import type { AnalysisWorkspaceResponse } from "@ba-helper/contracts"
import { ArtifactKindBadge } from "@/components/workspace/shared/status-badges"
import { evidenceBasisLabels, getLocalizedLabel, type SupportedLocale } from "@/lib/i18n/status-labels"
import type { AnalysisWorkspaceLabels } from "@/lib/i18n/analysis-labels"
import { InlineReviewAction } from "../shared/inline-review-action"

type ImpactGroup = AnalysisWorkspaceResponse["impactGroups"][number]
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
        <div key={group.group} className="rounded-lg border border-border/40 bg-surface flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b border-border/40 bg-surface-muted/30">
            <h2 className="text-[13px] font-semibold text-foreground">{group.title}</h2>
            <p className="text-[12px] text-muted-foreground mt-0.5">{group.description}</p>
          </div>
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
                      <div className="flex flex-col items-end gap-1 text-[10px] text-muted-foreground uppercase tracking-wide font-medium">
                        <span>{labels.basis}: {getLocalizedLabel(evidenceBasisLabels, artifact.impactBasis, locale)}</span>
                        <span>{artifact.evidenceIds.length} {labels.evidence}</span>
                      </div>
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        </div>
      ))}
    </section>
  )
}

function EmptyState({ title }: { title: string }) {
  return (
    <div className="rounded-lg border border-border/60 bg-surface p-8 text-center text-sm text-muted-foreground">
      {title}
    </div>
  )
}
