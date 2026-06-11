"use client"

import { Check, X, Loader2, AlertTriangle, FileText, Database, GitBranch, Activity, CheckCircle2 } from "lucide-react"

export type TimelineStepState = "pending" | "current" | "completed" | "failed" | "warning"

export interface E2ETimelineProps {
  // We can derive the steps from these objects, or pass explicit state
  repoConnected?: boolean
  scanJobStatus?: "QUEUED" | "RUNNING" | "COMPLETED" | "FAILED" | "CANCELLED"
  snapshotCoverage?: "READY" | "PARTIAL"
  snapshotIndex?: "NOT_INDEXED" | "LEXICAL_READY" | "VECTOR_INDEXING" | "VECTOR_READY" | "VECTOR_FAILED"
  analysisStatus?: "QUEUED" | "RUNNING" | "WAITING_FOR_REVIEW" | "COMPLETED" | "FAILED" | "CANCELLED"
  hasApprovedReport?: boolean
}

export function E2ETimeline({
  repoConnected,
  scanJobStatus,
  snapshotCoverage,
  snapshotIndex,
  analysisStatus,
  hasApprovedReport
}: E2ETimelineProps) {
  
  // 1. Repository Connected
  const step1State: TimelineStepState = repoConnected ? "completed" : "pending"
  
  // 2. Scan & Index Completed
  let step2State: TimelineStepState = "pending"
  if (repoConnected) {
    if (scanJobStatus === "FAILED" || snapshotIndex === "VECTOR_FAILED") {
      step2State = "failed"
    } else if (scanJobStatus === "RUNNING" || scanJobStatus === "QUEUED" || snapshotIndex === "VECTOR_INDEXING") {
      step2State = "current"
    } else if (scanJobStatus === "COMPLETED") {
      if (snapshotCoverage === "PARTIAL") step2State = "warning"
      else step2State = "completed"
    }
  }
  
  // 3. Analysis Processing
  let step3State: TimelineStepState = "pending"
  if (step2State === "completed" || step2State === "warning") {
    if (analysisStatus === "FAILED") {
      step3State = "failed"
    } else if (analysisStatus === "QUEUED" || analysisStatus === "RUNNING") {
      step3State = "current"
    } else if (analysisStatus === "WAITING_FOR_REVIEW" || analysisStatus === "COMPLETED") {
      step3State = "completed"
    }
  }

  // 4. Review Required
  let step4State: TimelineStepState = "pending"
  if (step3State === "completed") {
    if (analysisStatus === "WAITING_FOR_REVIEW") {
      step4State = "current"
    } else if (analysisStatus === "COMPLETED") {
      step4State = "completed"
    }
  }

  // 5. Report Finalized
  let step5State: TimelineStepState = "pending"
  if (step4State === "completed") {
    if (analysisStatus === "COMPLETED") {
      if (hasApprovedReport) {
        step5State = "completed"
      } else {
        step5State = "warning"
      }
    }
  }

  const steps = [
    { id: 1, label: "Repository Connected", state: step1State, icon: GitBranch },
    { id: 2, label: "Scan & Index", state: step2State, icon: Database, tooltip: "Source scanned and evidence retrieval is ready." },
    { id: 3, label: "Analysis", state: step3State, icon: Activity },
    { id: 4, label: "Review", state: step4State, icon: CheckCircle2 },
    { id: 5, label: "Report Finalized", state: step5State, icon: FileText },
  ]

  return (
    <div className="w-full overflow-x-auto pb-4 -mb-4 scrollbar-hide">
      <div className="flex items-start w-full min-w-[600px] px-2" role="navigation" aria-label="End to End Timeline">
      {steps.map((step, i) => (
        <div key={step.id} className="flex-1 relative group">
          <div className="flex flex-col items-center w-full z-10">
            {/* Node */}
            <div 
              className={`w-8 h-8 rounded-full shrink-0 flex items-center justify-center border-2 transition-colors bg-background ${
                step.state === "completed" ? "border-success text-success" :
                step.state === "current" ? "border-primary text-primary" :
                step.state === "failed" ? "border-danger text-danger bg-danger/5" :
                step.state === "warning" ? "border-warning text-warning bg-warning/5" :
                "border-border text-muted-foreground/50"
              }`}
              title={step.tooltip}
              aria-label={step.label}
              aria-current={step.state === "current" ? "step" : undefined}
            >
              {step.state === "completed" ? <Check className="w-4 h-4" /> :
               step.state === "failed" ? <X className="w-4 h-4" /> :
               step.state === "warning" ? <AlertTriangle className="w-4 h-4" /> :
               step.state === "current" ? <Loader2 className="w-4 h-4 animate-spin" /> :
               <step.icon className="w-4 h-4 opacity-50" />}
            </div>
            
            {/* Label */}
            <div className="mt-2.5 px-1 w-full flex justify-center text-center">
              <span className={`text-[11.5px] font-medium leading-snug max-w-[100px] ${
                step.state === "pending" ? "text-muted-foreground/60" : 
                step.state === "current" ? "text-foreground" :
                step.state === "warning" ? "text-warning" :
                step.state === "failed" ? "text-danger" :
                "text-foreground/80"
              }`}>
                {step.label}
              </span>
            </div>
          </div>

          {/* Line to next step */}
          {i < steps.length - 1 && (
            <div className="absolute top-4 left-1/2 w-full h-[2px] -translate-y-1/2 -z-10">
              <div className="h-full bg-border w-full absolute top-0 left-0" />
              <div 
                className={`h-full absolute top-0 left-0 transition-all duration-500 ease-out ${
                  steps[i+1].state === "completed" || steps[i+1].state === "warning" ? "w-full bg-success" : 
                  steps[i+1].state === "current" ? "w-1/2 bg-primary" : 
                  "w-0 bg-primary"
                }`} 
              />
            </div>
          )}
        </div>
      ))}
    </div>
    </div>
  )
}
