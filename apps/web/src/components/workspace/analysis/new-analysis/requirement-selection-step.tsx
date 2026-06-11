import { Loader2, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { RequirementSelectionStepProps } from "./new-analysis-types"

export function RequirementSelectionStep({
  reqsLoading,
  reqsError,
  readyReqs,
  selectedReq,
  setSelectedReq,
  handleNext,
}: RequirementSelectionStepProps) {
  return (
    <div className="flex flex-col">
      <div className="px-6 py-4 flex flex-col gap-2 max-h-72 overflow-y-auto">
        {reqsLoading ? (
          <div className="py-8 flex flex-col items-center gap-2 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
            <span className="text-[13px]">Loading requirements...</span>
          </div>
        ) : reqsError ? (
          <div className="py-8 flex flex-col items-center gap-2 text-muted-foreground">
            <AlertCircle className="w-5 h-5 text-danger" />
            <span className="text-[13px]">Failed to load requirements.</span>
          </div>
        ) : readyReqs.length === 0 ? (
          <div className="py-8 text-center text-[13px] text-muted-foreground">
            No READY requirements. Create and qualify a requirement first.
          </div>
        ) : (
          readyReqs.map((req) => (
            <button
              key={req.id}
              onClick={() => setSelectedReq(req)}
              className={`text-left p-3.5 rounded-lg border transition-all ${
                selectedReq?.id === req.id
                  ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                  : "border-border/60 bg-surface hover:bg-surface-soft hover:border-border"
              }`}
            >
              <p className="text-[13px] font-medium text-foreground">{req.latestRevision.title}</p>
              <p className="text-[11px] text-muted-foreground font-mono mt-1">{req.latestRevision.id}</p>
              <p className="text-[12px] text-muted-foreground/70 mt-1 line-clamp-2 leading-relaxed">
                {req.latestRevision.rawText}
              </p>
            </button>
          ))
        )}
      </div>
      <div className="px-6 py-4 border-t border-border/60 bg-surface-muted/30 flex justify-end">
        <Button size="sm" className="h-8 shadow-none" disabled={!selectedReq} onClick={handleNext}>
          Next →
        </Button>
      </div>
    </div>
  )
}
