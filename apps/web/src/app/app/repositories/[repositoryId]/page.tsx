"use client"

import { use } from "react"
import { AppShell } from "@/components/layout/app-shell"
import { WorkspacePageHeader } from "@/components/workspace/page-header"

import { Button } from "@/components/ui/button"
import { Play, GitBranch, AlertTriangle, Layers, Server, Box, Beaker, Database, Activity, AlertCircle } from "lucide-react"
import { notFound } from "next/navigation"
import { ScanJobProgress } from "@/components/workspace/scan-job-progress"
import { NewAnalysisDialog } from "@/components/workspace/new-analysis-dialog"
import { BackButton } from "@/components/workspace/back-button"
import { useRepositoryDetail } from "@/hooks/api/use-repositories"
import { useCreateScanJob } from "@/hooks/api/use-scan-jobs"
import { Skeleton } from "@/components/ui/skeleton"
import { v4 as uuidv4 } from "uuid"

interface PageProps {
  params: Promise<{ repositoryId: string }>
}

export default function RepositoryDetailsPage({ params }: PageProps) {
  // Since Next.js 15, params is a Promise that needs to be unwrapped with React.use
  const { repositoryId } = use(params)
  
  const { data: repo, isLoading, error } = useRepositoryDetail("default-project", repositoryId)
  const { mutateAsync: retryScan, isPending: isRetrying } = useCreateScanJob("default-project", repositoryId)

  if (isLoading) {
    return (
      <AppShell>
        <div className="max-w-4xl mx-auto w-full flex flex-col gap-8 py-8 px-4">
          <Skeleton className="h-8 w-[200px]" />
          <Skeleton className="h-24 w-full" />
          <div className="grid grid-cols-2 gap-6">
            <Skeleton className="h-[200px] w-full" />
            <Skeleton className="h-[200px] w-full" />
          </div>
        </div>
      </AppShell>
    )
  }

  if (error) {
    if ((error as { status?: number }).status === 404) {
      notFound()
    }
    return (
      <AppShell>
        <div className="flex flex-col items-center py-32 text-muted-foreground">
          <AlertCircle className="w-8 h-8 text-destructive mb-4" />
          <p className="text-[14px] font-medium text-foreground">Failed to load repository</p>
          <p className="text-[13px]">{error instanceof Error ? error.message : "Repository not found"}</p>
        </div>
      </AppShell>
    )
  }

  if (!repo) return null;

  const job = repo.latestScanJob
  const isReady = job?.status === "COMPLETED" && repo.latestSnapshot?.id
  const isPartial = repo.latestSnapshot?.coverageStatus === "PARTIAL"

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
    <AppShell>
      <div className="app-page-scroll">
        <div className="max-w-4xl mx-auto w-full flex flex-col gap-8 py-4 pb-20">
        {/* Back Link */}
        <BackButton href="/app/repositories" label="Back to Repositories" className="mb-0 w-fit" />

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
          
          {/* Snapshot Status Banner */}
          <div className="flex flex-col gap-3 p-5 rounded-xl border border-border/40 bg-surface/50 backdrop-blur-xl shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex flex-col gap-1 w-full max-w-sm">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Current Snapshot</span>
                <div className="mt-1">
                  {job ? (
                    <ScanJobProgress job={job} snapshot={repo.latestSnapshot} />
                  ) : (
                    <span className="text-[12px] font-medium text-muted-foreground">No jobs</span>
                  )}
                </div>
              </div>
              {isPartial && (
                <div className="flex items-center gap-2 px-3 py-2 bg-warning/10 border border-warning/25 rounded-lg shrink-0">
                  <AlertTriangle className="w-4 h-4 text-warning" />
                  <span className="text-[12px] font-medium text-warning">PARTIAL Coverage</span>
                </div>
              )}
            </div>

            {job?.status === "FAILED" && (
              <div className="mt-2 flex items-center justify-between p-3 rounded-lg border border-danger/30 bg-danger/5">
                <div className="flex items-center gap-3">
                  <AlertCircle className="w-4 h-4 text-danger shrink-0" />
                  <span className="text-[13px] text-danger/90 font-medium">Scan failed. Please check the logs or try again.</span>
                </div>
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="h-8 border-danger/20 hover:bg-danger/10 hover:text-danger text-danger"
                  onClick={handleRetryScan}
                  disabled={isRetrying}
                >
                  {isRetrying ? "Retrying..." : "Rerun Scan"}
                </Button>
              </div>
            )}
          </div>

          {/* Artifact Analytics */}
          <div className="flex flex-col gap-4">
            <h2 className="text-[14px] font-semibold text-foreground flex items-center gap-2">
              <Layers className="w-4 h-4 text-muted-foreground" />
              Artifact Analytics
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <ArtifactStatCard icon={<Server />} label="Controllers" count={repo.artifactStats?.controllers || 0} />
              <ArtifactStatCard icon={<Box />} label="Services" count={repo.artifactStats?.services || 0} />
              <ArtifactStatCard icon={<Database />} label="Entities" count={repo.artifactStats?.entities || 0} />
              <ArtifactStatCard icon={<Beaker />} label="Tests" count={repo.artifactStats?.tests || 0} />
              <ArtifactStatCard icon={<Activity />} label="Data Access" count={0} />
            </div>
          </div>

            {/* Graph Explorer Preview */}
          <div className="flex flex-col gap-4">
            <h2 className="text-[14px] font-semibold text-foreground flex items-center gap-2">
              <Activity className="w-4 h-4 text-muted-foreground" />
              Graph Preview
            </h2>
            <div className="flex flex-col border border-border/40 rounded-xl bg-surface/50 backdrop-blur-xl shadow-lg ring-1 ring-black/5 dark:ring-white/5 py-12 items-center text-center">
              <Activity className="w-8 h-8 text-muted-foreground mb-4" />
              <p className="text-[13px] font-medium text-foreground">Graph Explorer Coming Soon</p>
              <p className="text-[12px] text-muted-foreground mt-1">Detailed endpoint and entity visualization will be available in a future update.</p>
            </div>
          </div>

        </div>
        </div>
      </div>
    </AppShell>
  )
}

function ArtifactStatCard({ label, count, icon }: { label: string; count: number; icon: React.ReactNode }) {
  return (
    <div className="flex flex-col p-4 rounded-xl border border-border/40 bg-surface/40 backdrop-blur-md shadow-sm transition-colors hover:bg-surface-soft/60">
      <div className="flex items-center justify-between mb-3">
        <div className="text-muted-foreground [&>svg]:w-4 [&>svg]:h-4">
          {icon}
        </div>
        <span className="text-xl font-bold text-foreground">{count}</span>
      </div>
      <span className="text-[12px] font-medium text-muted-foreground">{label}</span>
    </div>
  )
}
