"use client"

import { use } from "react"

import { WorkspacePageHeader } from "@/components/workspace/page-header"

import { Button } from "@/components/ui/button"
import { Play, GitBranch, AlertTriangle, Layers, Server, Box, Beaker, Database, Activity, AlertCircle, ShieldAlert } from "lucide-react"
import { ScanJobProgress } from "@/components/workspace/scan-job-progress"
import { NewAnalysisDialog } from "@/components/workspace/new-analysis-dialog"
import { ScanDiagnosticsPanel } from "@/components/workspace/scan-diagnostics-panel"
import { BackButton } from "@/components/workspace/back-button"
import { useRepositoryDetail } from "@/hooks/api/use-repositories"
import { useCreateScanJob } from "@/hooks/api/use-scan-jobs"
import { useRepositoryStatusWatcher } from "@/hooks/ui/use-status-watcher"
import { useAuth } from "@/hooks/use-auth"
import { DiagnosticItem } from "@ba-helper/contracts"
import { Skeleton } from "@/components/ui/skeleton"
import { v4 as uuidv4 } from "uuid"

interface PageProps {
  params: Promise<{ repositoryId: string }>
}

function getFailureGuidance(errorCode?: string, message?: string) {
  if (errorCode === "CLONE_FAILED" && message?.includes("spawn git ENOENT")) {
    return "Scanner runtime is missing the git binary. Rebuild or restart the API/worker runtime with git installed, then rerun the scan."
  }

  if (errorCode === "UNSUPPORTED_FRAMEWORK") {
    return "This repository is outside the current MVP support boundary. The analyzer currently targets public TypeScript NestJS repositories only."
  }

  if (errorCode === "SECURITY_RISK_BLOCKED") {
    return "The repository was blocked by security guardrails. Check diagnostics to see which rule stopped ingestion before retrying."
  }

  return "Check the diagnostics below, fix the runtime or repository issue, and rerun the scan."
}

export default function RepositoryDetailsPage({ params }: PageProps) {
  // Since Next.js 15, params is a Promise that needs to be unwrapped with React.use
  const { repositoryId } = use(params)
  
  const { data: repo, isLoading, error } = useRepositoryDetail(undefined, repositoryId)
  const { mutateAsync: retryScan, isPending: isRetrying } = useCreateScanJob(undefined, repositoryId)

  const { user } = useAuth()
  const isAdmin = user?.role === 'ADMIN'

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
  const failureGuidance = getFailureGuidance(job?.error?.code, job?.error?.message ?? primaryDiagnostic?.message)

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
              {isPartial && !isBlocked && (
                <div className="flex items-center gap-2 px-3 py-2 bg-warning/10 border border-warning/25 rounded-lg shrink-0">
                  <AlertTriangle className="w-4 h-4 text-warning" />
                  <div className="flex flex-col">
                    <span className="text-[12px] font-bold text-warning">PARTIAL Coverage</span>
                  </div>
                </div>
              )}
              {isBlocked && (
                <div className="flex items-center gap-2 px-3 py-2 bg-danger/10 border border-danger/25 rounded-lg shrink-0">
                  <ShieldAlert className="w-4 h-4 text-danger" />
                  <div className="flex flex-col">
                    <span className="text-[12px] font-bold text-danger">BLOCKED</span>
                  </div>
                </div>
              )}
            </div>

            {isPartial && !isBlocked && (
              <p className="text-[12px] text-warning/90 mt-1 px-1">
                Partial snapshot: some files were skipped due to scan limits or security rules. The analysis may miss impacts in skipped files.
              </p>
            )}

            {isBlocked && (
              <p className="text-[12px] font-medium text-danger/90 mt-1 px-1">
                Scan blocked for security risk. No repository content was sent to LLM or embedding providers.
              </p>
            )}

            {job?.status === "FAILED" && (
              <div className="mt-2 flex items-center justify-between p-3 rounded-lg border border-danger/30 bg-danger/5">
                <div className="flex items-center gap-3">
                  <AlertCircle className="w-4 h-4 text-danger shrink-0" />
                  <div className="flex flex-col gap-1">
                    <span className="text-[13px] text-danger/90 font-medium">
                      {job.error?.code ? `Scan failed: ${job.error.code}` : "Scan failed"}
                    </span>
                    <span className="text-[12px] text-danger/80">
                      {job.error?.message || primaryDiagnostic?.message || "Please check diagnostics or try again."}
                    </span>
                  </div>
                </div>
                <Button 
                  size="sm" 
                  variant="outline" 
                  className={`h-8 border-danger/20 ${!isAdmin ? 'opacity-50 cursor-not-allowed text-danger' : 'hover:bg-danger/10 hover:text-danger text-danger'}`}
                  onClick={() => isAdmin && handleRetryScan()}
                  disabled={isRetrying || !isAdmin}
                  title={!isAdmin ? "Admin role required to run scans." : undefined}
                >
                  {isRetrying ? "Retrying..." : "Rerun Scan"}
                </Button>
              </div>
            )}

            {job?.status === "FAILED" && (
              <div className="rounded-lg border border-warning/20 bg-warning/5 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-warning mb-1">
                  Recommended action
                </p>
                <p className="text-[12px] text-foreground/85">
                  {failureGuidance}
                </p>
              </div>
            )}
          </div>

          {diagnostics.length > 0 && (
            <ScanDiagnosticsPanel diagnostics={diagnostics} />
          )}

          {!job && (
            <div className="rounded-xl border border-border/40 bg-surface/50 p-5 shadow-sm">
              <p className="text-[13px] font-medium text-foreground mb-1">Repository connected but not scanned yet</p>
              <p className="text-[12px] text-muted-foreground mb-4">
                Start a scan to build the snapshot, artifact graph, and analysis-ready evidence.
              </p>
              <Button size="sm" className="h-8 shadow-none" onClick={() => isAdmin && handleRetryScan()} disabled={isRetrying || !isAdmin} title={!isAdmin ? "Admin role required to run scans." : undefined}>
                {isRetrying ? "Starting..." : "Start Scan"}
              </Button>
            </div>
          )}

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
