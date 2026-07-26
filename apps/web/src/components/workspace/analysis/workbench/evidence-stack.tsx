import type { AnalysisWorkspaceResponse } from "@ba-helper/contracts"
import type { AnalysisWorkspaceLabels } from "@/lib/i18n/analysis-labels"
import { EvidenceCard } from "./evidence-card"

type Evidence = AnalysisWorkspaceResponse["evidenceCards"][number]

export function EvidenceStack({
  evidence,
  labels,
  commitSha,
}: {
  evidence: Evidence[]
  labels: AnalysisWorkspaceLabels["reviewWorkbench"]
  commitSha?: string
}) {
  return (
    <section>
      <h3 className="text-sm font-semibold text-foreground">{labels.sourceEvidence}</h3>
      {/* Evidence sufficiency explanation. */}
      <p className="mt-1 text-xs text-muted-foreground">
        {evidence.length === 0
          ? labels.noEvidenceSufficiency
          : labels.evidenceSufficiency.replace("{count}", String(evidence.length))}
      </p>
      {evidence.length === 0 ? (
        <p className="mt-2 rounded-lg border border-dashed border-border/60 p-4 text-sm text-muted-foreground">{labels.noEvidence}</p>
      ) : (
        <div className="mt-2 grid gap-3">
          {evidence.map((item) => (
            <EvidenceCard key={item.evidenceId} evidence={item} labels={labels} commitSha={commitSha} />
          ))}
        </div>
      )}
    </section>
  )
}
