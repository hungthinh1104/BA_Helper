"use client"

import { useAnalysisWorkspace } from "@/hooks/api/use-analyses"
import { useRetryReportGeneration } from "@/hooks/api/use-approved-report"
import { ReportGenerationState } from "./report-generation-state"

export function ReportGenerationFailure({ analysisId, printMode }: { analysisId: string; printMode: boolean }) {
  const { data: workspace } = useAnalysisWorkspace(analysisId, { enabled: !printMode })
  const retry = useRetryReportGeneration(analysisId)

  return (
    <ReportGenerationState
      state="failed"
      retryEnabled={Boolean(workspace?.reportStatus.canRetryReportGeneration) && !printMode}
      retryPending={retry.isPending}
      retryFailed={retry.isError}
      onRetry={() => retry.mutate()}
    />
  )
}
