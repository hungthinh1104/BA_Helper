"use client"

import * as React from "react"
import { useAnalysisDriftFreshness, useCreateAnalysis } from "@/hooks/api/use-analyses"
import { useRepositoryDetail } from "@/hooks/api/use-repositories"
import { AlertCircle, Info, ShieldAlert, FileDigit, FilePlus, FileMinus } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { ImpactAnalysisDetailResponse } from "@ba-helper/contracts"
import { DriftDetailsDrawer } from "./drift-details-drawer"
import { v4 as uuidv4 } from "uuid"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { DenseAlert } from "@/components/workspace/shared/dense-card"

interface AnalysisDriftWarningProps {
  projectId: string | undefined
  analysisId: string
  analysis: ImpactAnalysisDetailResponse | undefined
}

export function AnalysisDriftWarning({ projectId, analysisId, analysis }: AnalysisDriftWarningProps) {
  const router = useRouter()
  const { data: driftRecommendation, isLoading, error } = useAnalysisDriftFreshness(projectId, analysisId)
  const { data: repoDetail } = useRepositoryDetail(projectId, analysis?.snapshot.repositoryId ?? '')
  const createAnalysis = useCreateAnalysis(projectId)

  const [drawerOpen, setDrawerOpen] = React.useState(false)

  if (!projectId || !analysisId || isLoading || error || !driftRecommendation || !analysis) {
    return null
  }

  const { status, severity, reason, driftSummary, shouldRerunAnalysis } = driftRecommendation

  const handleRerun = async () => {
    if (!repoDetail?.latestSnapshot?.id) {
      toast.error("Cannot find the latest snapshot to re-run analysis.")
      return
    }

    try {
      const result = await createAnalysis.mutateAsync({
        revisionId: analysis.requirement.revisionId,
        data: {
          snapshotId: repoDetail.latestSnapshot.id,
          sourceTargetId: analysis.sourceTarget.id,
          allowPartialSnapshot: repoDetail.latestSnapshot.coverageStatus === 'PARTIAL',
          requestKey: uuidv4(),
          derivedFromAnalysisId: analysis.id,
        }
      })

      toast.success("New analysis started")
      router.push(`/analyses/${result.id}`)
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Unknown error'
      toast.error("Failed to re-run analysis: " + message)
    }
  }

  const rerunCTA = (
    <Button
      size="sm"
      variant="secondary"
      className="ml-auto h-7 text-xs px-3 font-semibold"
      onClick={handleRerun}
      disabled={createAnalysis.isPending || !repoDetail?.latestSnapshot?.id}
    >
      {createAnalysis.isPending ? "Starting..." : "Re-run analysis"}
    </Button>
  )

  const reviewCTA = (
    <Button
      size="sm"
      variant="secondary"
      className="ml-auto h-7 text-xs px-3 font-semibold"
      onClick={() => setDrawerOpen(true)}
    >
      Review drift details
    </Button>
  )

  if (status === 'CURRENT') {
    return (
      <DenseAlert className="items-center gap-2 border-border/30 bg-surface-soft/40 px-3 py-2 text-muted-foreground">
        <Info className="w-4 h-4 shrink-0 text-foreground/50" />
        <span className="text-[12px] font-medium leading-relaxed">
          {reason || "This analysis is based on the latest usable repository snapshot."}
        </span>
      </DenseAlert>
    )
  }

  if (status === 'UNKNOWN') {
    return (
      <DenseAlert variant="warning" className="items-center gap-3 px-4 py-3 text-foreground/80 shadow-sm">
        <AlertCircle className="w-5 h-5 shrink-0 text-warning" />
        <span className="text-[13px] font-medium leading-relaxed">
          {reason || "Repository freshness cannot be fully determined because some artifacts do not have content hashes."}
        </span>
        {reviewCTA}
        <DriftDetailsDrawer
          open={drawerOpen}
          onOpenChange={setDrawerOpen}
          projectId={projectId}
          repositoryId={analysis.snapshot.repositoryId}
          baseSnapshotId={analysis.snapshot.id}
          targetCommitSha={repoDetail?.latestSnapshot?.commitSha}
        />
      </DenseAlert>
    )
  }

  if (status === 'INCOMPATIBLE') {
    return (
      <DenseAlert variant="danger" className="items-center gap-3 px-4 py-3 text-foreground/90 shadow-sm">
        <ShieldAlert className="w-5 h-5 shrink-0 text-danger" />
        <span className="text-[13px] font-medium leading-relaxed flex-1">
          {reason || "Repository scanner/analyzer versions changed significantly. Re-analysis is recommended."}
        </span>
        {rerunCTA}
      </DenseAlert>
    )
  }

  // DRIFTED
  const isHighSeverity = severity === 'HIGH'

  return (
    <>
      <DenseAlert className={cn(
        "items-center gap-3 px-4 py-3 shadow-sm",
        isHighSeverity
          ? "bg-warning/10 border-warning/30 text-foreground/90"
          : "bg-warning/5 border-warning/20 text-foreground/80",
      )}>
        <AlertCircle className={cn("w-5 h-5 shrink-0", isHighSeverity ? "text-warning" : "text-warning/80")} />

        <div className="flex flex-col gap-1 flex-1">
          <span className="text-[13px] font-medium leading-relaxed">
            {reason || "The repository has changed since this analysis was created. Review the drift summary before relying on this result."}
          </span>
          {driftSummary && (
            <div className="flex items-center gap-3 mt-0.5 text-[11px] text-muted-foreground/80">
              {driftSummary.changedArtifactCount > 0 && (
                <span className="flex items-center gap-1" title="Changed Artifacts">
                  <FileDigit className="w-3 h-3 text-warning/70" /> {driftSummary.changedArtifactCount} changed
                </span>
              )}
              {driftSummary.addedArtifactCount > 0 && (
                <span className="flex items-center gap-1" title="Added Artifacts">
                  <FilePlus className="w-3 h-3 text-success/70" /> {driftSummary.addedArtifactCount} added
                </span>
              )}
              {driftSummary.removedArtifactCount > 0 && (
                <span className="flex items-center gap-1" title="Removed Artifacts">
                  <FileMinus className="w-3 h-3 text-danger/70" /> {driftSummary.removedArtifactCount} removed
                </span>
              )}
            </div>
          )}
        </div>

        <div className="flex gap-2">
          {reviewCTA}
          {shouldRerunAnalysis && rerunCTA}
        </div>
      </DenseAlert>

      <DriftDetailsDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        projectId={projectId}
        repositoryId={analysis.snapshot.repositoryId}
        baseSnapshotId={analysis.snapshot.id}
        targetCommitSha={repoDetail?.latestSnapshot?.commitSha}
      />
    </>
  )
}
