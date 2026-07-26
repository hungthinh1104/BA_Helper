"use client"

import { useState, type ReactElement, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { v4 as uuidv4 } from "uuid"
import { toast } from "sonner"
import type {
  AnalysisWorkspaceResponse,
  ImpactAnalysisCreateRequest,
} from "@ba-helper/contracts"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import type { AnalysisWorkspaceLabels } from "@/lib/i18n/analysis-labels"
import { useCreateAnalysis } from "@/hooks/api/use-analyses"
import { useRepositoryDetail } from "@/hooks/api/use-repositories"
import { useOptionalProjectId } from "@/lib/project-context"

type LatestSnapshot = {
  id: string
  commitSha?: string
  coverageStatus?: string
} | null | undefined

/**
 * Builds the create-analysis request that re-runs the current requirement
 * revision against the latest repository snapshot, deriving the new analysis
 * from the current one. Returns null when the latest snapshot or the source
 * target is not available (so the caller can keep the action disabled).
 *
 * The current analysis is never mutated: a re-run always produces a new,
 * separate analysis linked back via derivedFromAnalysisId.
 */
export function buildRerunAnalysisRequest(
  workspace: AnalysisWorkspaceResponse,
  latestSnapshot: LatestSnapshot,
  requestKey: string,
): { revisionId: string; data: ImpactAnalysisCreateRequest } | null {
  const sourceTargetId = workspace.driftStatus.sourceTargetId
  if (!latestSnapshot?.id || !sourceTargetId) return null
  return {
    revisionId: workspace.overview.requirement.revisionId,
    data: {
      snapshotId: latestSnapshot.id,
      sourceTargetId,
      allowPartialSnapshot: latestSnapshot.coverageStatus === "PARTIAL",
      requestKey,
      derivedFromAnalysisId: workspace.overview.analysisId,
    },
  }
}

export function RerunAnalysisDialog({
  children,
  workspace,
  labels,
}: {
  children: ReactNode
  workspace: AnalysisWorkspaceResponse
  labels: AnalysisWorkspaceLabels["rerunDialog"]
}) {
  const [open, setOpen] = useState(false)
  const router = useRouter()
  const projectId = useOptionalProjectId()
  const { data: repoDetail } = useRepositoryDetail(
    projectId,
    workspace.overview.snapshot.repositoryId,
  )
  const createAnalysis = useCreateAnalysis(projectId)

  const latestSnapshot = repoDetail?.latestSnapshot as LatestSnapshot
  const canRerun = Boolean(latestSnapshot?.id && workspace.driftStatus.sourceTargetId)

  const handleRerun = async () => {
    const payload = buildRerunAnalysisRequest(workspace, latestSnapshot, uuidv4())
    if (!payload) {
      toast.error(labels.unavailable)
      return
    }
    try {
      const result = await createAnalysis.mutateAsync(payload)
      toast.success(labels.started)
      setOpen(false)
      router.push(`/analyses/${result.id}`)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error"
      toast.error(`${labels.failed}: ${message}`)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger render={children as ReactElement} />
      <AlertDialogContent data-rerun-dialog>
        <AlertDialogHeader>
          <AlertDialogTitle>{labels.title}</AlertDialogTitle>
          <AlertDialogDescription>
            {canRerun ? labels.description : labels.unavailable}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {canRerun && latestSnapshot?.commitSha ? (
          <p className="font-mono text-xs text-muted-foreground">
            {labels.latestCommit.replace("{commit}", latestSnapshot.commitSha.substring(0, 7))}
          </p>
        ) : null}
        <AlertDialogFooter>
          <AlertDialogCancel>{labels.cancel}</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              void handleRerun()
            }}
            disabled={!canRerun || createAnalysis.isPending}
          >
            {createAnalysis.isPending ? labels.starting : labels.confirm}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
