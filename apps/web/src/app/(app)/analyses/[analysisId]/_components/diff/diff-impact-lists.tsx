import { Plus, Minus, Check, AlertTriangle } from "lucide-react"
import { useTranslations } from "next-intl"
import { ImpactAnalysisDiffResponse } from "@ba-helper/contracts"
import { DenseCard } from "@/components/workspace/shared/dense-card"

interface DiffImpactListsProps {
  diff: ImpactAnalysisDiffResponse
}

export function DiffImpactLists({ diff }: DiffImpactListsProps) {
  const t = useTranslations("workspace")
  return (
    <div className="flex flex-col gap-8 mt-4">
      {/* Impacted Code Artifact Changes */}
      <div className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold border-b border-border/40 pb-2 flex items-center gap-2">
          <span>{t("impactedCodeArtifacts")}</span>
          <span className="text-xs font-normal text-muted-foreground">({t("changesCount", { count: diff.addedArtifacts.length + diff.removedArtifacts.length })})</span>
        </h3>

        <div className="flex flex-col gap-2">
          {diff.addedArtifacts.map((art) => (
            <DenseCard key={art.artifactKey} className="flex-row items-center justify-between gap-3 border-success/20 bg-success/5 p-3 text-[13px]">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="flex items-center gap-1 text-success font-semibold shrink-0">
                  <Plus className="w-3.5 h-3.5" /> {t("added")}
                </span>
                <span className="text-muted-foreground/60">|</span>
                <span className="font-medium text-foreground truncate">{art.name}</span>
                <span className="text-[11px] px-1.5 py-0.2 rounded bg-surface border border-border text-muted-foreground select-none shrink-0">{art.artifactType}</span>
              </div>
              <div className="text-xs text-muted-foreground truncate select-all">{art.filePath}</div>
            </DenseCard>
          ))}

          {diff.removedArtifacts.map((art) => (
            <DenseCard key={art.artifactKey} className="flex-row items-center justify-between gap-3 border-danger/25 bg-danger/5 p-3 text-[13px]">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="flex items-center gap-1 text-danger font-semibold shrink-0">
                  <Minus className="w-3.5 h-3.5" /> {t("removed")}
                </span>
                <span className="text-muted-foreground/60">|</span>
                <span className="font-medium text-foreground truncate">{art.name}</span>
                <span className="text-[11px] px-1.5 py-0.2 rounded bg-surface border border-border text-muted-foreground select-none shrink-0">{art.artifactType}</span>
              </div>
              <div className="text-xs text-muted-foreground truncate select-all">{art.filePath}</div>
            </DenseCard>
          ))}

          {diff.addedArtifacts.length === 0 && diff.removedArtifacts.length === 0 && (
            <DenseCard variant="dashed" className="py-6 text-center text-xs text-muted-foreground">
              {t("noCodeArtifactImpactChanges")}
            </DenseCard>
          )}
        </div>
      </div>

      {/* Ambiguity & Unknowns Changes */}
      <div className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold border-b border-border/40 pb-2 flex items-center gap-2">
          <span>{t("ambiguityUnknowns")}</span>
          <span className="text-xs font-normal text-muted-foreground">({t("changesCount", { count: diff.resolvedUnknowns.length + diff.removedUnknowns.length + diff.newUnknowns.length })})</span>
        </h3>

        <div className="flex flex-col gap-2">
          {diff.resolvedUnknowns.map((ins, idx) => (
            <DenseCard key={idx} className="gap-1.5 border-success/20 bg-success/5 p-3 text-[13px]">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="flex items-center gap-1 text-success font-semibold shrink-0 text-xs uppercase tracking-wider">
                  <Check className="w-3.5 h-3.5" /> {t("resolved")}
                </span>
                <span className="text-muted-foreground/60">|</span>
                <span className="text-foreground font-medium text-[11px] bg-surface px-1.5 py-0.2 rounded border border-border shrink-0">{ins.category}</span>
                {ins.insightKey && <span className="text-[10px] text-muted-foreground font-mono">({ins.insightKey})</span>}
              </div>
              <div className="text-muted-foreground text-xs leading-relaxed pl-1 mt-0.5">{ins.statement}</div>
            </DenseCard>
          ))}

          {diff.newUnknowns.map((ins, idx) => (
            <DenseCard key={idx} className="gap-1.5 border-warning/30 bg-warning/5 p-3 text-[13px]">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="flex items-center gap-1 text-warning font-semibold shrink-0 text-xs uppercase tracking-wider">
                  <AlertTriangle className="w-3.5 h-3.5" /> {t("newUnknown")}
                </span>
                <span className="text-muted-foreground/60">|</span>
                <span className="text-foreground font-medium text-[11px] bg-surface px-1.5 py-0.2 rounded border border-border shrink-0">{ins.category}</span>
                {ins.insightKey && <span className="text-[10px] text-muted-foreground font-mono">({ins.insightKey})</span>}
              </div>
              <div className="text-muted-foreground text-xs leading-relaxed pl-1 mt-0.5">{ins.statement}</div>
            </DenseCard>
          ))}

          {diff.removedUnknowns.map((ins, idx) => (
            <DenseCard key={idx} className="gap-1.5 bg-surface/50 p-3 text-[13px] opacity-80">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="flex items-center gap-1 text-muted-foreground font-semibold shrink-0 text-xs uppercase tracking-wider">
                  <Minus className="w-3.5 h-3.5" /> {t("removed")}
                </span>
                <span className="text-muted-foreground/60">|</span>
                <span className="text-foreground font-medium text-[11px] bg-surface px-1.5 py-0.2 rounded border border-border shrink-0">{ins.category}</span>
                {ins.insightKey && <span className="text-[10px] text-muted-foreground font-mono">({ins.insightKey})</span>}
              </div>
              <div className="text-muted-foreground text-xs leading-relaxed pl-1 mt-0.5">{ins.statement}</div>
            </DenseCard>
          ))}

          {diff.resolvedUnknowns.length === 0 && diff.newUnknowns.length === 0 && diff.removedUnknowns.length === 0 && (
            <DenseCard variant="dashed" className="py-6 text-center text-xs text-muted-foreground">
              {t("noUnknownAmbiguityChanges")}
            </DenseCard>
          )}
        </div>
      </div>

      {/* QA Scenarios Added */}
      <div className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold border-b border-border/40 pb-2 flex items-center gap-2">
          <span>{t("qaCoverageScenarios")}</span>
          <span className="text-xs font-normal text-muted-foreground">({t("newCount", { count: diff.addedQaScenarios.length })})</span>
        </h3>

        <div className="flex flex-col gap-2">
          {diff.addedQaScenarios.map((ins, idx) => (
            <DenseCard key={idx} className="gap-1.5 border-info/20 bg-info/5 p-3 text-[13px]">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="flex items-center gap-1 text-info font-semibold shrink-0 text-xs uppercase tracking-wider">
                  <Plus className="w-3.5 h-3.5" /> {t("newQaScenario")}
                </span>
                <span className="text-muted-foreground/60">|</span>
                {ins.insightKey && <span className="text-[10px] text-muted-foreground font-mono">({ins.insightKey})</span>}
              </div>
              <div className="text-foreground text-xs leading-relaxed pl-1 mt-0.5">{ins.statement}</div>
            </DenseCard>
          ))}

          {diff.addedQaScenarios.length === 0 && (
            <DenseCard variant="dashed" className="py-6 text-center text-xs text-muted-foreground">
              {t("noNewQaScenariosCompared")}
            </DenseCard>
          )}
        </div>
      </div>
    </div>
  )
}
