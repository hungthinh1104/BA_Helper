"use client"

import { use } from "react"

import { WorkspacePageHeader } from "@/components/workspace/shared/page-header"
import { Button } from "@/components/ui/button"
import { GitBranch, Play, AlertCircle } from "lucide-react"
import { useCurrentWorkspace, useOptionalProjectId } from "@/lib/project-context"
import { canRunScan } from "@/lib/permissions"
import { NewAnalysisDialog } from "@/components/workspace/analysis/new-analysis/new-analysis-dialog"
import { ScanDiagnosticsPanel } from "@/components/workspace/analysis/scan-diagnostics-panel"
import { ScanHealthCard } from "@/components/workspace/repository/scan-health-card"
import { SnapshotDriftCard } from "@/components/workspace/repository/snapshot-drift-card"
import { BackButton } from "@/components/workspace/shared/back-button"
import { useRepositoryDetail } from "@/hooks/api/use-repositories"
import { useRepositorySnapshots } from "@/hooks/api/use-repository-snapshots"
import { useCreateScanJob } from "@/hooks/api/use-scan-jobs"
import { useRepositoryStatusWatcher } from "@/hooks/ui/use-status-watcher"
import { DiagnosticItem } from "@ba-helper/contracts"
import { Skeleton } from "@/components/ui/skeleton"
import { v4 as uuidv4 } from "uuid"

import { RepositorySnapshotBanner } from "./_components/repository-snapshot-banner"
import { RepositoryScannerProfile } from "./_components/repository-scanner-profile"
import { RepositoryArtifactAnalytics } from "./_components/repository-artifact-analytics"

interface PageProps {
  params: Promise<{ repositoryId: string }>
}

export default function RepositoryDetailsPage({ params }: PageProps) {
  // Since Next.js 15, params is a Promise that needs to be unwrapped with React.use
  const { repositoryId } = use(params)
  const activeProjectId = useOptionalProjectId()
  
  const { data: repo, isLoading, error } = useRepositoryDetail(activeProjectId, repositoryId)
  const { data: snapshotList } = useRepositorySnapshots(activeProjectId, repositoryId)
  const { mutateAsync: retryScan, isPending: isRetrying } = useCreateScanJob(activeProjectId, repositoryId)

  const workspace = useCurrentWorkspace()
  const canScan = workspace ? canRunScan(workspace.membershipRole) : false

  // Watch for scan job completion/failure to show toast notifications
  useRepositoryStatusWatcher(undefined, repositoryId)

  if (isLoading) {
    return (
        <div className="max-w-4xl mx-auto w-full flex flex-col gap-8 py-8 px-4">
          <Skeleton className="h-8 w-[200px]" />
          <Skeleton className="h-24 w-full" />
          <div className="grid grid-cols-2 gap-6">
            <Skeleton className="h-[200px] w-full" />
            <Skeleton className="h-[200px] w-full" />
          </div>
        </div>
      )
  }

  if (error) {
    const status = (error as { status?: number }).status
    return (
        <div className="max-w-2xl mx-auto w-full py-12 px-4">
          <div className="rounded-xl border border-danger/20 bg-danger/5 p-6 flex flex-col gap-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-danger shrink-0 mt-0.5" />
              <div className="flex flex-col gap-1">
                <p className="text-[15px] font-semibold text-foreground">
                  {status === 404 ? "Repository not available" : "Failed to load repository"}
                </p>
                <p className="text-[13px] text-muted-foreground">
                  {status === 404
                    ? "This repository does not exist in the current workspace anymore, or the workspace context changed."
                    : error instanceof Error
                      ? error.message
                      : "The repository detail request failed."}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <BackButton href="/repositories" label="Back to Repositories" className="mb-0 w-fit" />
            </div>
          </div>
        </div>
      )
  }

  if (!repo) return null;

  const job = repo.latestScanJob
  const snapshots = snapshotList?.items || []
  const latestUsable = snapshots[0]
  const previousUsable = snapshots[1]

  const isReady = job?.status === "COMPLETED" && repo.latestSnapshot?.id
  const isPartial = repo.latestSnapshot?.coverageStatus === "PARTIAL"
  
  // Combine diagnostics from job and snapshot
  const diagnostics = [
    ...(job?.diagnostics || []),
    ...(repo.latestSnapshot?.diagnostics || [])
  ] satisfies DiagnosticItem[]

  const hasBlocker = diagnostics.some((diagnostic) => diagnostic.severity === "BLOCKER")
  const isBlocked = job?.status === "FAILED" && hasBlocker
  const primaryDiagnostic = diagnostics[0]
  const scanHealthDiag = diagnostics.find(d => d.code === "SCAN_HEALTH")
  const regularDiagnostics = diagnostics.filter(d => d.code !== "SCAN_HEALTH")
  const profile = repo.latestSnapshot?.profile

  const handleRetryScan = async () => {
    try {
      await retryScan({
        requestKey: uuidv4(),
        ref: repo.latestTarget?.requestedRef,
      })
    } catch (error) {
      console.error("Failed to retry scan", error)
    }
  }

  return (
    <div className="app-page-scroll">
        <div className="max-w-4xl mx-auto w-full flex flex-col gap-8 py-4 pb-20">
        {/* Back Link */}
        <BackButton href="/repositories" label="Back to Repositories" className="mb-0 w-fit" />

        {/* Header */}
        <WorkspacePageHeader
          title={repo.displayName}
          className="mb-0"
          description={
            <div className="flex items-center gap-3 mt-1.5 text-[12px] font-mono text-muted-foreground">
              <span className="flex items-center gap-1"><GitBranch className="w-3.5 h-3.5" /> {repo.latestTarget?.requestedRef || "main"}</span>
              <span>·</span>
              <span className="flex items-center gap-1 truncate max-w-[300px]">{repo.canonicalUrl.replace("https://github.com/", "")}</span>
            </div>
          }
        >
          {isReady && (
            <NewAnalysisDialog preselectedRepoId={repo.id}>
              <Button size="sm" className="h-8 shadow-none gap-1.5">
                <Play className="w-3.5 h-3.5 fill-current" /> Start New Analysis
              </Button>
            </NewAnalysisDialog>
          )}
        </WorkspacePageHeader>

        <div className="flex flex-col gap-8">
          
          <RepositorySnapshotBanner
            job={job}
            latestSnapshot={repo.latestSnapshot}
            isPartial={isPartial}
            isBlocked={isBlocked}
            canScan={canScan}
            isRetrying={isRetrying}
            primaryDiagnostic={primaryDiagnostic}
            onRetryScan={handleRetryScan}
          />

          {profile && <RepositoryScannerProfile profile={profile} />}

          {scanHealthDiag && (
            <ScanHealthCard payload={scanHealthDiag.payload} />
          )}

          <div className="flex flex-col gap-3">
            <SnapshotDriftCard 
              projectId={activeProjectId || ''} 
              repositoryId={repositoryId} 
              baseSnapshotId={previousUsable?.id}
              targetSnapshotId={latestUsable?.id}
            />
          </div>

          {regularDiagnostics.length > 0 && (
            <ScanDiagnosticsPanel diagnostics={regularDiagnostics} />
          )}

          {!job && (
            <div className="rounded-xl border border-border/40 bg-surface/50 p-5 shadow-sm">
              <p className="text-[13px] font-medium text-foreground mb-1">Repository connected but not scanned yet</p>
              <p className="text-[12px] text-muted-foreground mb-4">
                Start a scan to build the snapshot, artifact graph, and analysis-ready evidence.
              </p>
              <Button size="sm" className="h-8 shadow-none" onClick={() => canScan && handleRetryScan()} disabled={isRetrying || !canScan} title={!canScan ? "Maintainer role required to run scans." : undefined}>
                {isRetrying ? "Starting..." : "Start Scan"}
              </Button>
            </div>
          )}

          <RepositoryArtifactAnalytics stats={repo.artifactStats} />

        </div>
      </div>
    </div>
  )
}
