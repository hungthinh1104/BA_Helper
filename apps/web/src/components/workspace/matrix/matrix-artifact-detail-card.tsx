import React from "react"
import { MatrixRowArtifactDetail, MatrixRowInsightRef } from "@ba-helper/contracts"
import { Card } from "@/components/ui/card"
import { CertaintyBadge, ArtifactKindBadge } from "@/components/workspace/shared/status-badges"
import { MatrixEvidenceList } from "./matrix-evidence-list"

interface MatrixArtifactDetailCardProps {
  artifact: MatrixRowArtifactDetail
  risks: MatrixRowInsightRef[]
  qaScenarios: MatrixRowInsightRef[]
}

export function MatrixArtifactDetailCard({
  artifact,
  risks,
  qaScenarios,
}: MatrixArtifactDetailCardProps) {
  const artifactRisks = risks.filter((r) => artifact.relatedRisks.includes(r.insightId))
  const artifactQa = qaScenarios.filter((qa) => artifact.relatedQaScenarios.includes(qa.insightId))

  return (
    <Card className="flex flex-col overflow-hidden bg-surface mb-3 border-border">
      <div className="flex flex-col gap-2 p-3 pb-2 border-b bg-muted/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ArtifactKindBadge kind={artifact.universalKind || artifact.rawArtifactType} />
            <span className="text-[13px] font-medium text-foreground">{artifact.displayName}</span>
          </div>
          <div className="flex items-center gap-2 text-[11px]">
            {artifact.evidenceItems.length > 0 && (
              <span className="text-muted-foreground bg-muted px-1.5 py-0.5 rounded-sm">
                {artifact.evidenceItems.length} evidence
              </span>
            )}
            {artifactRisks.length > 0 && (
              <span className="text-destructive bg-destructive/10 px-1.5 py-0.5 rounded-sm">
                {artifactRisks.length} risk
              </span>
            )}
            {artifactQa.length > 0 && (
              <span className="text-success bg-success/10 px-1.5 py-0.5 rounded-sm">
                {artifactQa.length} QA
              </span>
            )}
          </div>
        </div>
        <div className="text-[11px] text-muted-foreground font-mono truncate">
          {artifact.filePath}
          {artifact.startLine !== null && artifact.endLine !== null
            ? `:${artifact.startLine}-${artifact.endLine}`
            : ""}
        </div>
      </div>

      <div className="w-full flex flex-col">
        <MatrixEvidenceList artifact={artifact} />

        {artifactRisks.length > 0 && (
          <details className="group border-b px-3 py-1 open:pb-3" open>
            <summary className="text-[12px] font-medium py-2 text-destructive hover:text-destructive/80 cursor-pointer list-none flex items-center justify-between">
              Related Risks ({artifactRisks.length})
              <span className="text-muted-foreground/50 text-[10px] group-open:rotate-180 transition-transform">▼</span>
            </summary>
            <div className="pt-1 space-y-3">
              {artifactRisks.map((risk) => (
                <div key={risk.insightId} className="rounded border border-destructive/20 bg-destructive/5 p-2">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <span className="text-[12px] font-medium text-foreground">{risk.title}</span>
                    {risk.certainty && (
                      <CertaintyBadge certainty={risk.certainty} />
                    )}
                  </div>
                  {risk.description && (
                    <p className="text-[12px] text-muted-foreground leading-relaxed">
                      {risk.description}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </details>
        )}

        {artifactQa.length > 0 && (
          <details className="group border-b px-3 py-1 open:pb-3" open>
            <summary className="text-[12px] font-medium py-2 text-success hover:text-success/80 cursor-pointer list-none flex items-center justify-between">
              Related QA Scenarios ({artifactQa.length})
              <span className="text-muted-foreground/50 text-[10px] group-open:rotate-180 transition-transform">▼</span>
            </summary>
            <div className="pt-1 space-y-3">
              {artifactQa.map((qa) => (
                <div key={qa.insightId} className="rounded border border-success/20 bg-success/5 p-2">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <span className="text-[12px] font-medium text-foreground">{qa.title}</span>
                    {qa.certainty && (
                      <CertaintyBadge certainty={qa.certainty} />
                    )}
                  </div>
                  {qa.description && (
                    <p className="text-[12px] text-muted-foreground leading-relaxed">
                      {qa.description}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </details>
        )}

        {artifact.retrievalDiagnostics && (
          <details className="group border-b-0 px-3 py-1 border-t border-border open:pb-3">
            <summary className="text-[11px] font-medium py-2 text-muted-foreground cursor-pointer list-none flex items-center justify-between hover:text-foreground">
              Why selected?
              <span className="text-muted-foreground/50 text-[10px] group-open:rotate-180 transition-transform">▼</span>
            </summary>
            <div className="pt-1">
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-[11px] font-mono bg-muted/30 p-2 rounded border border-border">
                {Object.entries(artifact.retrievalDiagnostics)
                  .filter(([, v]) => typeof v === "number" || typeof v === "string")
                  .map(([k, v]) => (
                    <div key={k} className="flex justify-between gap-4">
                      <span className="text-muted-foreground">{k}</span>
                      <span className="text-foreground truncate" title={String(v)}>{typeof v === "number" ? v.toFixed(3) : String(v)}</span>
                    </div>
                  ))}
              </div>
            </div>
          </details>
        )}
      </div>
    </Card>
  )
}
