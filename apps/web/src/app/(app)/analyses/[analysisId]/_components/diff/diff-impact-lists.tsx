import { Plus, Minus, Check, AlertTriangle } from "lucide-react"
import { ImpactAnalysisDiffResponse } from "@ba-helper/contracts"

interface DiffImpactListsProps {
  diff: ImpactAnalysisDiffResponse
}

export function DiffImpactLists({ diff }: DiffImpactListsProps) {
  return (
    <div className="flex flex-col gap-8 mt-4">
      {/* Impacted Code Artifact Changes */}
      <div className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold border-b border-border/40 pb-2 flex items-center gap-2">
          <span>Impacted Code Artifacts</span>
          <span className="text-xs font-normal text-muted-foreground">({diff.addedArtifacts.length + diff.removedArtifacts.length} changes)</span>
        </h3>

        <div className="flex flex-col gap-2">
          {diff.addedArtifacts.map((art) => (
            <div key={art.artifactKey} className="flex items-center justify-between gap-3 p-3 rounded-lg border border-success/20 bg-success/5 text-[13px]">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="flex items-center gap-1 text-success font-semibold shrink-0">
                  <Plus className="w-3.5 h-3.5" /> Added
                </span>
                <span className="text-muted-foreground/60">|</span>
                <span className="font-medium text-foreground truncate">{art.name}</span>
                <span className="text-[11px] px-1.5 py-0.2 rounded bg-surface border border-border text-muted-foreground select-none shrink-0">{art.artifactType}</span>
              </div>
              <div className="text-xs text-muted-foreground truncate select-all">{art.filePath}</div>
            </div>
          ))}

          {diff.removedArtifacts.map((art) => (
            <div key={art.artifactKey} className="flex items-center justify-between gap-3 p-3 rounded-lg border border-danger/25 bg-danger/5 text-[13px]">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="flex items-center gap-1 text-danger font-semibold shrink-0">
                  <Minus className="w-3.5 h-3.5" /> Removed
                </span>
                <span className="text-muted-foreground/60">|</span>
                <span className="font-medium text-foreground truncate">{art.name}</span>
                <span className="text-[11px] px-1.5 py-0.2 rounded bg-surface border border-border text-muted-foreground select-none shrink-0">{art.artifactType}</span>
              </div>
              <div className="text-xs text-muted-foreground truncate select-all">{art.filePath}</div>
            </div>
          ))}

          {diff.addedArtifacts.length === 0 && diff.removedArtifacts.length === 0 && (
            <div className="text-xs text-muted-foreground py-6 text-center bg-surface-muted/20 border border-dashed border-border/50 rounded-lg">
              No code artifact impact changes found between these analyses.
            </div>
          )}
        </div>
      </div>

      {/* Ambiguity & Unknowns Changes */}
      <div className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold border-b border-border/40 pb-2 flex items-center gap-2">
          <span>Ambiguity & Unknowns</span>
          <span className="text-xs font-normal text-muted-foreground">({diff.resolvedUnknowns.length + diff.removedUnknowns.length + diff.newUnknowns.length} changes)</span>
        </h3>

        <div className="flex flex-col gap-2">
          {diff.resolvedUnknowns.map((ins, idx) => (
            <div key={idx} className="flex flex-col gap-1.5 p-3 rounded-lg border border-success/20 bg-success/5 text-[13px]">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="flex items-center gap-1 text-success font-semibold shrink-0 text-xs uppercase tracking-wider">
                  <Check className="w-3.5 h-3.5" /> Resolved
                </span>
                <span className="text-muted-foreground/60">|</span>
                <span className="text-foreground font-medium text-[11px] bg-surface px-1.5 py-0.2 rounded border border-border shrink-0">{ins.category}</span>
                {ins.insightKey && <span className="text-[10px] text-muted-foreground font-mono">({ins.insightKey})</span>}
              </div>
              <div className="text-muted-foreground text-xs leading-relaxed pl-1 mt-0.5">{ins.statement}</div>
            </div>
          ))}

          {diff.newUnknowns.map((ins, idx) => (
            <div key={idx} className="flex flex-col gap-1.5 p-3 rounded-lg border border-warning/30 bg-warning/5 text-[13px]">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="flex items-center gap-1 text-warning font-semibold shrink-0 text-xs uppercase tracking-wider">
                  <AlertTriangle className="w-3.5 h-3.5" /> New Unknown
                </span>
                <span className="text-muted-foreground/60">|</span>
                <span className="text-foreground font-medium text-[11px] bg-surface px-1.5 py-0.2 rounded border border-border shrink-0">{ins.category}</span>
                {ins.insightKey && <span className="text-[10px] text-muted-foreground font-mono">({ins.insightKey})</span>}
              </div>
              <div className="text-muted-foreground text-xs leading-relaxed pl-1 mt-0.5">{ins.statement}</div>
            </div>
          ))}

          {diff.removedUnknowns.map((ins, idx) => (
            <div key={idx} className="flex flex-col gap-1.5 p-3 rounded-lg border border-border/40 bg-surface/50 text-[13px] opacity-80">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="flex items-center gap-1 text-muted-foreground font-semibold shrink-0 text-xs uppercase tracking-wider">
                  <Minus className="w-3.5 h-3.5" /> Removed
                </span>
                <span className="text-muted-foreground/60">|</span>
                <span className="text-foreground font-medium text-[11px] bg-surface px-1.5 py-0.2 rounded border border-border shrink-0">{ins.category}</span>
                {ins.insightKey && <span className="text-[10px] text-muted-foreground font-mono">({ins.insightKey})</span>}
              </div>
              <div className="text-muted-foreground text-xs leading-relaxed pl-1 mt-0.5">{ins.statement}</div>
            </div>
          ))}

          {diff.resolvedUnknowns.length === 0 && diff.newUnknowns.length === 0 && diff.removedUnknowns.length === 0 && (
            <div className="text-xs text-muted-foreground py-6 text-center bg-surface-muted/20 border border-dashed border-border/50 rounded-lg">
              No unknown or ambiguity status changes between these analyses.
            </div>
          )}
        </div>
      </div>

      {/* QA Scenarios Added */}
      <div className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold border-b border-border/40 pb-2 flex items-center gap-2">
          <span>QA Coverage Scenarios</span>
          <span className="text-xs font-normal text-muted-foreground">({diff.addedQaScenarios.length} new)</span>
        </h3>

        <div className="flex flex-col gap-2">
          {diff.addedQaScenarios.map((ins, idx) => (
            <div key={idx} className="flex flex-col gap-1.5 p-3 rounded-lg border border-info/20 bg-info/5 text-[13px]">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="flex items-center gap-1 text-info font-semibold shrink-0 text-xs uppercase tracking-wider">
                  <Plus className="w-3.5 h-3.5" /> New QA Scenario
                </span>
                <span className="text-muted-foreground/60">|</span>
                {ins.insightKey && <span className="text-[10px] text-muted-foreground font-mono">({ins.insightKey})</span>}
              </div>
              <div className="text-foreground text-xs leading-relaxed pl-1 mt-0.5">{ins.statement}</div>
            </div>
          ))}

          {diff.addedQaScenarios.length === 0 && (
            <div className="text-xs text-muted-foreground py-6 text-center bg-surface-muted/20 border border-dashed border-border/50 rounded-lg">
              No new QA scenarios generated in the current analysis compared to baseline.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
