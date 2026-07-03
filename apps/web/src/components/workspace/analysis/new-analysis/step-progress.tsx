import { ChevronRight } from "lucide-react"
import type { Step } from "./new-analysis-types"

interface StepProgressProps {
  currentStep: Step
  labels: string[]
  hasPreselectedRepo: boolean
  hasPreselectedRequirement: boolean
}

function displayStepNumber(
  step: Step,
  hasPreselectedRepo: boolean,
  hasPreselectedRequirement: boolean,
) {
  if (step === 3 && (hasPreselectedRepo || hasPreselectedRequirement)) return "2"
  if (step === 2 && hasPreselectedRequirement) return "1"
  return String(step)
}

export function StepProgress({
  currentStep,
  labels,
  hasPreselectedRepo,
  hasPreselectedRequirement,
}: StepProgressProps) {
  const visibleSteps = ([1, 2, 3] as Step[]).filter(
    (step) =>
      !(hasPreselectedRepo && step === 2) &&
      !(hasPreselectedRequirement && step === 1),
  )

  return (
    <div className="flex items-center gap-1 mt-3">
      {visibleSteps.map((step, index) => (
        <div key={step} className="flex items-center gap-1">
          <div
            className={`flex items-center gap-1.5 text-[11px] font-medium transition-colors ${
              currentStep === step
                ? "text-foreground"
                : currentStep > step
                  ? "text-success"
                  : "text-muted-foreground/50"
            }`}
          >
            <div
              className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold transition-colors ${
                currentStep > step
                  ? "bg-success text-white"
                  : currentStep === step
                    ? "bg-foreground text-background"
                    : "bg-surface-muted border border-border text-muted-foreground"
              }`}
            >
              {currentStep > step
                ? "✓"
                : displayStepNumber(step, hasPreselectedRepo, hasPreselectedRequirement)}
            </div>
            <span className="hidden sm:inline">{labels[step - 1]}</span>
          </div>
          {index < visibleSteps.length - 1 ? (
            <ChevronRight className="w-3 h-3 text-border mx-1" />
          ) : null}
        </div>
      ))}
    </div>
  )
}
