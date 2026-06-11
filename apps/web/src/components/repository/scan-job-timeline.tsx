import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
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
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Scan Progress</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {STAGES.map((stage, index) => {
            const isCompleted = index <= currentStageIndex && scanJob.status === "COMPLETED"
            const isCurrent = index === currentStageIndex && scanJob.status === "RUNNING"
            const isPending = index > currentStageIndex || scanJob.status === "QUEUED"
            
            return (
              <div key={stage} className="flex items-center gap-3">
                {isCompleted ? (
                  <CheckCircle2 className="w-4 h-4 text-success" />
                ) : isCurrent ? (
                  <Loader2 className="w-4 h-4 text-primary animate-spin" />
                ) : (
                  <Circle className="w-4 h-4 text-muted-foreground" />
                )}
                <span className={`text-xs font-medium ${isPending ? 'text-muted-foreground' : 'text-foreground'}`}>
                  {stage.replace(/_/g, ' ')}
                </span>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
