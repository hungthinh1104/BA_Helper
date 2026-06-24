"use client"

import type { AnalysisWorkspaceResponse } from "@ba-helper/contracts"
import { ArtifactKindBadge } from "@/components/workspace/shared/status-badges"

type ImpactGroup = AnalysisWorkspaceResponse["impactGroups"][number]

export function ImpactMapTab({ groups }: { groups: ImpactGroup[] }) {
  if (groups.length === 0) {
    return <EmptyState title="No impacted artifacts" />
  }

  return (
    <section className="grid gap-4">
      {groups.map((group) => (
        <div key={group.group} className="rounded-lg border border-border/60 bg-surface p-4">
          <div className="flex flex-col gap-1">
            <h2 className="text-sm font-semibold text-foreground">{group.title}</h2>
            <p className="text-sm text-muted-foreground">{group.description}</p>
          </div>
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {group.artifacts.map((artifact) => (
              <article
                key={`${artifact.artifactId}:${artifact.traceabilityLinkIds.join(",")}`}
                className="rounded-md border border-border/50 bg-background/40 p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-medium text-foreground">
                      {artifact.name}
                    </h3>
                    <p className="mt-1 truncate font-mono text-xs text-muted-foreground">
                      {artifact.filePath}
                    </p>
                  </div>
                  <ArtifactKindBadge kind={artifact.universalKind} />
                </div>
                <p className="mt-3 text-sm text-muted-foreground">{artifact.impactReason}</p>
                <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                  <span>Basis: {artifact.impactBasis}</span>
                  <span>Evidence: {artifact.evidenceIds.length}</span>
                  <span>Review: {artifact.reviewDecision}</span>
                </div>
              </article>
            ))}
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
