import { ScanJobResponse } from "@ba-helper/contracts"
import { CheckCircle2, Circle, Loader2 } from "lucide-react"

interface ScanJobTimelineProps {
  scanJob: ScanJobResponse
}

const STAGES = [
  "WAITING",
  "CLONING_REPO",
  "RESOLVING_SOURCE_REF",
  "DETECTING_PROJECT",
  "FILTERING_FILES",
  "EXTRACTING_ARTIFACTS",
  "BUILDING_GRAPH",
  "GENERATING_SUMMARIES",
  "DONE"
]

export function ScanJobTimeline({ scanJob }: ScanJobTimelineProps) {
  const currentStageIndex = STAGES.indexOf(scanJob.stage)
  
  return (
    <div className="flex flex-col">
      <h3 className="text-sm font-semibold mb-4 text-foreground/80">Scan Progress</h3>
      <div className="space-y-4 relative before:absolute before:inset-0 before:ml-[7px] before:w-[2px] before:bg-border/50">
        {STAGES.map((stage, index) => {
          const isCompleted = index <= currentStageIndex && scanJob.status === "COMPLETED"
          const isCurrent = index === currentStageIndex && scanJob.status === "RUNNING"
          const isPending = index > currentStageIndex || scanJob.status === "QUEUED"
          
          return (
            <div key={stage} className="flex items-center gap-3 relative z-10">
              <div className="bg-surface-muted/30 p-0.5 rounded-full">
                {isCompleted ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-success fill-success/10" />
                ) : isCurrent ? (
                  <Loader2 className="w-3.5 h-3.5 text-primary animate-spin" />
                ) : (
                  <Circle className="w-3.5 h-3.5 text-border fill-surface" />
                )}
              </div>
              <span className={`text-[11px] tracking-wide font-medium ${isPending ? 'text-muted-foreground/60' : 'text-foreground'}`}>
                {stage.replace(/_/g, ' ')}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
