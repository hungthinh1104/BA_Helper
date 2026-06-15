"use client"

import { useRepositories } from "@/hooks/api/use-repositories"
import { useAnalyses } from "@/hooks/api/use-analyses"
import { useRequirements } from "@/hooks/api/use-requirements"
import { WorkspacePageHeader } from "@/components/workspace/shared/page-header"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { GitBranch, Activity, Database, ChevronRight, AlertCircle, FileText } from "lucide-react"
import Link from "next/link"
import { ConnectRepoDialog } from "@/components/workspace/repository/connect-repo-dialog"
import { NewRequirementDialog } from "@/components/workspace/requirement/new-requirement-dialog"
import { NewAnalysisDialog } from "@/components/workspace/analysis/new-analysis/new-analysis-dialog"
import { useAuth } from "@/hooks/use-auth"

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

export default function DashboardPage() {
  const { data: reposData, isLoading: reposLoading } = useRepositories({ limit: 3 })
  const { data: analysesData, isLoading: analysesLoading } = useAnalyses({ limit: 3 })
  const { data: reqsData, isLoading: reqsLoading } = useRequirements()

  const repos = reposData?.items || []
  const analyses = analysesData?.items || []
  const reqs = reqsData?.items || []

  const readyRepos = repos.filter(r => r.latestScanJob?.status === "COMPLETED" && r.latestSnapshot?.id)
  const readyReqs = reqs.filter(r => r.latestRevision?.readinessStatus === "READY_FOR_ANALYSIS")

  const { role } = useAuth()
  const canEdit = role === "ADMIN" || role === "REVIEWER"

  // Determine Next Best Action
  let nextAction = null
  if (reposLoading || analysesLoading || reqsLoading) {
    nextAction = null
  } else if (repos.length === 0) {
    if (canEdit) {
      nextAction = {
        title: "Connect a Repository",
        description: "Start by connecting a GitHub repository to build the evidence index.",
        action: <ConnectRepoDialog><Button size="sm" className="shadow-none">Connect Repository</Button></ConnectRepoDialog>
      }
    } else {
      nextAction = {
        title: "No Repository Connected",
        description: "An administrator needs to connect a repository to get started.",
        action: null
      }
    }
  } else if (reqs.length === 0) {
    if (canEdit) {
      nextAction = {
        title: "Create a Requirement",
        description: "Define a change request to analyze against your repository.",
        action: <NewRequirementDialog><Button size="sm" className="shadow-none">New Requirement</Button></NewRequirementDialog>
      }
    } else {
      nextAction = {
        title: "No Requirements",
        description: "Wait for an editor or admin to create a requirement.",
        action: null
      }
    }
  } else if (analyses.length === 0 && readyRepos.length > 0 && readyReqs.length > 0) {
    if (canEdit) {
      nextAction = {
        title: "Run Impact Analysis",
        description: "You have a ready repository and requirement. Run your first analysis.",
        action: <NewAnalysisDialog><Button size="sm" className="shadow-none">Start Analysis</Button></NewAnalysisDialog>
      }
    } else {
      nextAction = {
        title: "Ready for Analysis",
        description: "A workspace editor needs to start the first analysis.",
        action: null
      }
    }
  } else if (analyses.some(a => a.status === "WAITING_FOR_REVIEW")) {
    const analysis = analyses.find(a => a.status === "WAITING_FOR_REVIEW")
    nextAction = {
      title: "Review Insights",
      description: `Analysis for "${analysis?.requirementRevisionTitle}" needs review.`,
      action: <Link href={`/analyses/${analysis?.id}`}><Button size="sm" className="shadow-none">Go to Review Queue</Button></Link>
    }
  }

  return (
    <div className="app-page-scroll">
      <div className="max-w-5xl mx-auto w-full py-4 pb-20 flex flex-col gap-10">
        
        {/* Header */}
        <WorkspacePageHeader
          title="Project Dashboard"
          description="Overview of your current workspace, recent activities, and impact analyses."
          className="mb-0"
        />

        {/* Next Best Action */}
        {nextAction && (
          <div className="flex flex-col md:flex-row items-center justify-between gap-6 p-6 bg-primary/5 border border-primary/20 rounded-xl">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                <Activity className="w-5 h-5 text-primary" />
              </div>
              <div className="flex flex-col gap-1">
                <h3 className="text-[15px] font-semibold text-foreground">{nextAction.title}</h3>
                <p className="text-[13px] text-muted-foreground">{nextAction.description}</p>
              </div>
            </div>
            <div className="shrink-0">{nextAction.action}</div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Recent Repositories */}
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="text-[15px] font-semibold text-foreground flex items-center gap-2">
                <Database className="w-4 h-4 text-muted-foreground" />
                Recent Repositories
              </h2>
              <Link href="/repositories" className="text-[12px] font-medium text-muted-foreground hover:text-foreground flex items-center">
                View all <ChevronRight className="w-3 h-3 ml-0.5" />
              </Link>
            </div>
            
            <div className="flex flex-col border border-border/40 rounded-xl bg-surface/50 backdrop-blur-xl shadow-sm overflow-hidden">
              {reposLoading ? (
                <div className="p-4 flex flex-col gap-3"><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" /></div>
              ) : repos.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
                  <Database className="w-8 h-8 text-muted-foreground/50 mb-3" />
                  <p className="text-[13px] font-medium text-foreground">No repositories connected</p>
                  <p className="text-[12px] text-muted-foreground mb-4">Connect a public GitHub repo to get started.</p>
                  <ConnectRepoDialog>
                    <Button size="sm" variant="outline" className="shadow-none">Connect Repository</Button>
                  </ConnectRepoDialog>
                </div>
              ) : (
                <div className="flex flex-col divide-y divide-border/40">
                  {repos.map(repo => {
                    const job = repo.latestScanJob
                    const isReady = job?.status === "COMPLETED" && repo.latestSnapshot?.coverageStatus === "READY"
                    const isPartial = job?.status === "COMPLETED" && repo.latestSnapshot?.coverageStatus === "PARTIAL"
                    const isFailed = job?.status === "FAILED"
                    
                    return (
                      <div key={repo.id} className="p-4 flex items-center justify-between gap-4 hover:bg-surface-soft transition-colors">
                        <div className="flex flex-col gap-1 min-w-0">
                          <Link href={`/repositories/${repo.id}`} className="text-[13px] font-mono font-medium text-foreground hover:underline truncate">
                            {repo.displayName}
                          </Link>
                          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                            <span className="flex items-center gap-1"><GitBranch className="w-3 h-3" /> {repo.latestTarget?.requestedRef}</span>
                            <span>·</span>
                            <span>{formatDate(repo.createdAt)}</span>
                          </div>
                        </div>
                        <div className="shrink-0 flex items-center gap-3">
                          {isFailed ? (
                            <span className="flex items-center gap-1 text-[11px] font-medium text-danger bg-danger/10 px-2 py-0.5 rounded border border-danger/20">
                              <AlertCircle className="w-3 h-3" /> Failed
                            </span>
                          ) : isReady || isPartial ? (
                            <NewAnalysisDialog preselectedRepoId={repo.id}>
                              <Button size="sm" variant="outline" className="h-7 text-[11px] px-2.5">Analyze</Button>
                            </NewAnalysisDialog>
                          ) : (
                            <span className="flex items-center gap-1 text-[11px] font-medium text-primary bg-primary/10 px-2 py-0.5 rounded border border-primary/20">
                              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" /> Scanning
                            </span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Recent Analyses */}
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="text-[15px] font-semibold text-foreground flex items-center gap-2">
                <Activity className="w-4 h-4 text-muted-foreground" />
                Recent Analyses
              </h2>
              <Link href="/analyses" className="text-[12px] font-medium text-muted-foreground hover:text-foreground flex items-center">
                View all <ChevronRight className="w-3 h-3 ml-0.5" />
              </Link>
            </div>
            
            <div className="flex flex-col border border-border/40 rounded-xl bg-surface/50 backdrop-blur-xl shadow-sm overflow-hidden">
              {analysesLoading ? (
                <div className="p-4 flex flex-col gap-3"><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" /></div>
              ) : analyses.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
                  <Activity className="w-8 h-8 text-muted-foreground/50 mb-3" />
                  <p className="text-[13px] font-medium text-foreground">No analyses run yet</p>
                  <p className="text-[12px] text-muted-foreground mb-4">Run an impact analysis to see results here.</p>
                  {canEdit && (
                    <NewAnalysisDialog>
                      <Button size="sm" variant="outline" className="shadow-none">Start Analysis</Button>
                    </NewAnalysisDialog>
                  )}
                </div>
              ) : (
                <div className="flex flex-col divide-y divide-border/40">
                  {analyses.map(analysis => {
                    const isReview = analysis.status === "WAITING_FOR_REVIEW"
                    const isCompleted = analysis.status === "COMPLETED"
                    const isFailed = analysis.status === "FAILED"
                    
                    return (
                      <div key={analysis.id} className="p-4 flex items-center justify-between gap-4 hover:bg-surface-soft transition-colors">
                        <div className="flex flex-col gap-1 min-w-0">
                          <Link href={`/analyses/${analysis.id}`} className="text-[13px] font-medium text-foreground hover:underline truncate">
                            {analysis.requirementRevisionTitle}
                          </Link>
                          <div className="flex items-center gap-2 text-[11px] font-mono text-muted-foreground truncate">
                            <span>{analysis.repositoryDisplayName}</span>
                            <span>·</span>
                            <span>{analysis.snapshotCommitSha.substring(0,7)}</span>
                          </div>
                        </div>
                        <div className="shrink-0">
                          {isFailed ? (
                            <span className="flex items-center gap-1 text-[11px] font-medium text-danger bg-danger/10 px-2 py-0.5 rounded border border-danger/20">
                              <AlertCircle className="w-3 h-3" /> Failed
                            </span>
                          ) : isReview ? (
                            <Link href={`/analyses/${analysis.id}`}>
                              <Button size="sm" className="h-7 text-[11px] px-2.5 bg-warning/10 text-warning hover:bg-warning/20 border border-warning/20 shadow-none">
                                Review Queue
                              </Button>
                            </Link>
                          ) : isCompleted ? (
                            <Link href={`/reports?analysisId=${analysis.id}`}>
                              <Button size="sm" variant="outline" className="h-7 text-[11px] px-2.5 bg-success/10 text-success hover:bg-success/20 border border-success/20 shadow-none">
                                <FileText className="w-3 h-3 mr-1" /> Report
                              </Button>
                            </Link>
                          ) : (
                            <span className="flex items-center gap-1 text-[11px] font-medium text-primary bg-primary/10 px-2 py-0.5 rounded border border-primary/20">
                              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" /> Processing
                            </span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
