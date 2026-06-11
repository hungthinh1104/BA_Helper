import { ArrowRight, FileCode, HelpCircle, ShieldCheck, History } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ImpactAnalysisDiffResponse } from "@ba-helper/contracts"

interface DiffSummaryCardsProps {
  diff: ImpactAnalysisDiffResponse
  onGoToBaseline: (baseAnalysisId: string) => void
}

export function DiffSummaryCards({ diff, onGoToBaseline }: DiffSummaryCardsProps) {
  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border border-border/40 bg-surface/30">
        <div className="flex flex-col gap-1.5 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-foreground uppercase tracking-wider text-[10px]">Context:</span>
            {diff.comparisonContext.requirementChanged ? (
              <span className="px-1.5 py-0.5 rounded bg-info/10 text-info border border-info/20 text-[10px]">Requirement Updated</span>
            ) : (
              <span className="px-1.5 py-0.5 rounded bg-surface border border-border text-[10px]">Same Requirement</span>
            )}
            {diff.comparisonContext.snapshotChanged ? (
              <span className="px-1.5 py-0.5 rounded bg-warning/10 text-warning border border-warning/20 text-[10px]">Code Changed</span>
            ) : (
              <span className="px-1.5 py-0.5 rounded bg-success/10 text-success border border-success/20 text-[10px]">Identical Codebase</span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1 text-[11px]">
            <span>Baseline revision:</span>
            <code className="text-foreground bg-surface border border-border px-1 rounded text-[10px]">{diff.comparisonContext.baseRequirementRevisionId.slice(0, 8)}</code>
            <ArrowRight className="w-3 h-3 text-muted-foreground/60" />
            <span>Current:</span>
            <code className="text-foreground bg-surface border border-border px-1 rounded text-[10px]">{diff.comparisonContext.currentRequirementRevisionId.slice(0, 8)}</code>
          </div>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px]">
            <span>Baseline snapshot:</span>
            <code className="text-foreground bg-surface border border-border px-1 rounded text-[10px]">{diff.comparisonContext.baseCommitSha?.slice(0, 7) ?? "N/A"}</code>
            <ArrowRight className="w-3 h-3 text-muted-foreground/60" />
            <span>Current:</span>
            <code className="text-foreground bg-surface border border-border px-1 rounded text-[10px]">{diff.comparisonContext.currentCommitSha?.slice(0, 7) ?? "N/A"}</code>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onGoToBaseline(diff.baseAnalysisId)}
          className="flex items-center gap-1.5 h-8 bg-surface shrink-0 text-xs shadow-none"
        >
          <History className="w-3.5 h-3.5" />
          Go to Baseline Analysis
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="flex flex-col p-4 rounded-xl border border-border/40 bg-surface/50">
          <div className="flex items-center gap-2 mb-3">
            <FileCode className="w-4 h-4 text-muted-foreground" />
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Code Impacts</h4>
          </div>
          <div className="flex flex-col gap-2 mt-auto">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Added:</span>
              <span className={`font-semibold px-1.5 py-0.5 rounded text-[11px] ${diff.summary.addedImpacts > 0 ? "bg-success/15 text-success" : "text-muted-foreground"}`}>
                +{diff.summary.addedImpacts}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Removed:</span>
              <span className={`font-semibold px-1.5 py-0.5 rounded text-[11px] ${diff.summary.removedImpacts > 0 ? "bg-danger/15 text-danger" : "text-muted-foreground"}`}>
                -{diff.summary.removedImpacts}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Unchanged:</span>
              <span className="font-semibold text-foreground">{diff.summary.unchangedImpacts}</span>
            </div>
          </div>
        </div>

        <div className="flex flex-col p-4 rounded-xl border border-border/40 bg-surface/50">
          <div className="flex items-center gap-2 mb-3">
            <HelpCircle className="w-4 h-4 text-muted-foreground" />
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Ambiguity & Unknowns</h4>
          </div>
          <div className="flex flex-col gap-2 mt-auto">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Resolved:</span>
              <span className={`font-semibold px-1.5 py-0.5 rounded text-[11px] ${diff.summary.resolvedUnknowns > 0 ? "bg-success/15 text-success" : "text-muted-foreground"}`}>
                {diff.summary.resolvedUnknowns} resolved
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Removed:</span>
              <span className={`font-semibold px-1.5 py-0.5 rounded text-[11px] ${diff.summary.removedUnknowns > 0 ? "bg-danger/15 text-danger" : "text-muted-foreground"}`}>
                {diff.summary.removedUnknowns} removed
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">New Unknowns:</span>
              <span className={`font-semibold px-1.5 py-0.5 rounded text-[11px] ${diff.summary.newUnknowns > 0 ? "bg-warning/15 text-warning" : "text-muted-foreground"}`}>
                +{diff.summary.newUnknowns}
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-col p-4 rounded-xl border border-border/40 bg-surface/50">
          <div className="flex items-center gap-2 mb-3">
            <ShieldCheck className="w-4 h-4 text-muted-foreground" />
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">QA Coverage</h4>
          </div>
          <div className="flex flex-col gap-2 mt-auto">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground font-medium">New QA Scenarios:</span>
              <span className={`font-bold text-[14px] px-2 py-0.5 rounded ${diff.summary.addedQaScenarios > 0 ? "bg-info/10 text-info" : "text-muted-foreground"}`}>
                +{diff.summary.addedQaScenarios}
              </span>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
