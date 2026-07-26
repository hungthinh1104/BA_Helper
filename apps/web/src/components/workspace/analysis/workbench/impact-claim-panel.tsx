import type { AnalysisWorkspaceResponse } from "@ba-helper/contracts"
import { Badge } from "@/components/ui/badge"
import { ArtifactKindBadge } from "@/components/workspace/shared/status-badges"
import { evidenceBasisLabels, getLocalizedLabel, type SupportedLocale } from "@/lib/i18n/status-labels"
import type { AnalysisWorkspaceLabels } from "@/lib/i18n/analysis-labels"
import type { ReviewWorkbenchItem } from "./analysis-workbench-types"

type Artifact = AnalysisWorkspaceResponse["impactGroups"][number]["artifacts"][number]

export function ImpactClaimPanel({
  item,
  artifact,
  locale,
  labels,
}: {
  item: ReviewWorkbenchItem
  artifact: Artifact | null
  locale: SupportedLocale
  labels: AnalysisWorkspaceLabels["reviewWorkbench"]
}) {
  return (
    <section className="rounded-lg border border-border/50 bg-surface p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{labels.impactClaim}</p>
      <h2 className="mt-1 text-base font-semibold text-foreground">{item.title}</h2>
      {artifact ? (
        <div className="mt-4 grid gap-2 text-sm">
          <div className="flex flex-wrap items-center gap-2"><ArtifactKindBadge kind={artifact.universalKind} /><Badge variant="outline">{getLocalizedLabel(evidenceBasisLabels, artifact.impactBasis, locale)}</Badge><Badge variant="outline">{artifact.evidenceIds.length} {labels.evidence}</Badge></div>
          <p className="font-medium text-foreground">{artifact.name}</p>
          <p className="font-mono text-xs text-muted-foreground">{artifact.filePath}</p>
          <p className="text-sm leading-relaxed text-muted-foreground"><span className="font-medium text-foreground">{labels.impactReason}: </span>{artifact.impactReason}</p>
        </div>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">{item.evidenceCount} {labels.evidence}</p>
      )}
    </section>
  )
}
