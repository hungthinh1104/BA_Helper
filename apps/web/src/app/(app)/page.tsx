"use client"

import type { ReactNode } from "react"
import Link from "next/link"
import {
  Activity,
  AlertCircle,
  ChevronRight,
  Database,
  FileText,
  GitBranch,
  ListChecks,
} from "lucide-react"

import { NewAnalysisDialog } from "@/components/workspace/analysis/new-analysis/new-analysis-dialog"
import { ConnectRepoDialog } from "@/components/workspace/repository/connect-repo-dialog"
import {
  ActionPanel,
  DataCard,
  EmptyState,
  MetricCard,
  PageShell,
  SectionHeader,
} from "@/components/workspace/shared/primitives"
import {
  AnalysisStatusBadge,
  CoverageStatusBadge,
  ScanStatusBadge,
} from "@/components/workspace/shared/status-badges"
import { WorkspacePageHeader } from "@/components/workspace/shared/page-header"
import { NewRequirementDialog } from "@/components/workspace/requirement/new-requirement-dialog"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useAnalyses } from "@/hooks/api/use-analyses"
import { useRepositories } from "@/hooks/api/use-repositories"
import { useRequirements } from "@/hooks/api/use-requirements"
import { useCurrentWorkspace } from "@/lib/project-context"
import {
  canCreateRequirement,
  canManageRepository,
  canReview,
  canRunAnalysis,
} from "@/lib/permissions"

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

export default function DashboardPage() {
  const { data: reposData, isLoading: reposLoading } = useRepositories({ limit: 4 })
  const { data: analysesData, isLoading: analysesLoading } = useAnalyses({ limit: 4 })
  const { data: reqsData, isLoading: reqsLoading } = useRequirements()
  const workspace = useCurrentWorkspace()

  const repos = reposData?.items ?? []
  const analyses = analysesData?.items ?? []
  const reqs = reqsData?.items ?? []

  const readyRepos = repos.filter(r => r.latestScanJob?.status === "COMPLETED" && r.latestSnapshot?.id)
  const partialRepos = repos.filter(r => r.latestSnapshot?.coverageStatus === "PARTIAL")
  const readyReqs = reqs.filter(r => r.latestRevision?.readinessStatus === "READY_FOR_ANALYSIS")
  const reviewBlocked = analyses.filter(a => a.status === "WAITING_FOR_REVIEW").length
  const failedAnalyses = analyses.filter(a => a.status === "FAILED")
  const runningAnalyses = analyses.filter(a => a.status === "RUNNING" || a.status === "QUEUED")
  const latestCompleted = analyses.find(a => a.status === "COMPLETED")

  const canManageRepo = workspace ? canManageRepository(workspace.membershipRole) : false
  const canCreateReq = workspace ? canCreateRequirement(workspace.membershipRole) : false
  const canRun = workspace ? canRunAnalysis(workspace.membershipRole) : false
  const canRev = workspace ? canReview(workspace.membershipRole) : false

  let nextAction: { title: string; description: string; action?: ReactNode } | null = null

  if (!reposLoading && !analysesLoading && !reqsLoading) {
    if (repos.length === 0) {
      nextAction = canManageRepo
        ? {
            title: "Connect the first repository",
            description: "Start by indexing one repository so the app has persisted evidence to work from.",
            action: (
              <ConnectRepoDialog>
                <Button size="sm" className="shadow-none">Connect Repository</Button>
              </ConnectRepoDialog>
            ),
          }
        : {
            title: "Repository connection required",
            description: "A Maintainer or Owner needs to connect a repository before anyone can run the evidence flow.",
          }
    } else if (reqs.length === 0) {
      nextAction = canCreateReq
        ? {
            title: "Create the first requirement",
            description: "Define one analysis-ready requirement revision to drive the impact workflow.",
            action: (
              <NewRequirementDialog>
                <Button size="sm" className="shadow-none">New Requirement</Button>
              </NewRequirementDialog>
            ),
          }
        : {
            title: "Requirement input missing",
            description: "An Analyst or Owner needs to create a requirement revision before analysis can start.",
          }
    } else if (analyses.length === 0 && readyRepos.length > 0 && readyReqs.length > 0) {
      nextAction = canRun
        ? {
            title: "Run the first impact analysis",
            description: "You already have a usable snapshot and a ready requirement. Start the requirement-to-code workflow.",
            action: (
              <NewAnalysisDialog>
                <Button size="sm" className="shadow-none">Start Analysis</Button>
              </NewAnalysisDialog>
            ),
          }
        : {
            title: "Analysis is ready to start",
            description: "An Analyst or Owner can now start the first impact analysis from the current repository snapshot.",
          }
    } else if (reviewBlocked > 0) {
      const reviewAnalysis = analyses.find(a => a.status === "WAITING_FOR_REVIEW")
      nextAction = canRev
        ? {
            title: "Review blocking evidence decisions",
            description: `The latest analysis for "${reviewAnalysis?.requirementRevisionTitle}" is waiting for review before finalization.`,
            action: (
              <Link href={`/analyses/${reviewAnalysis?.id}?tab=review-queue`}>
                <Button size="sm" className="shadow-none">Open Review Queue</Button>
              </Link>
            ),
          }
        : {
            title: "Review is blocking finalization",
            description: "A Reviewer or Owner needs to finish evidence decisions before the latest analysis can be finalized.",
          }
    }
  }

  return (
    <PageShell>
      <WorkspacePageHeader
        title="Project Dashboard"
        description="Monitor repository readiness, active analyses, review blockers, and the next action for the primary evidence-first workflow."
        className="mb-0"
      />

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
        <MetricCard
          label="Repositories"
          value={`${repos.length}`}
          detail={`${readyRepos.length} ready · ${partialRepos.length} partial`}
          accent={repos.length > 0 ? "success" : "default"}
          icon={<Database className="h-4 w-4" />}
        />
        <MetricCard
          label="Requirements"
          value={`${readyReqs.length}`}
          detail={`${reqs.length} total revisions in workspace`}
          accent={readyReqs.length > 0 ? "success" : "default"}
          icon={<FileText className="h-4 w-4" />}
        />
        <MetricCard
          label="Latest Analysis"
          value={analyses[0]?.status?.replace(/_/g, " ") ?? "None"}
          detail={analyses[0] ? analyses[0].requirementRevisionTitle : "No analysis has been run yet"}
          accent={analyses[0]?.status === "FAILED" ? "danger" : analyses[0]?.status === "WAITING_FOR_REVIEW" ? "warning" : "default"}
          icon={<Activity className="h-4 w-4" />}
        />
        <MetricCard
          label="Review Blocking"
          value={`${reviewBlocked}`}
          detail={reviewBlocked > 0 ? "Analyses waiting on evidence decisions" : "No current review blockers"}
          accent={reviewBlocked > 0 ? "warning" : "success"}
          icon={<ListChecks className="h-4 w-4" />}
        />
        <MetricCard
          label="Latest Report"
          value={latestCompleted ? "Available" : "Unavailable"}
          detail={latestCompleted ? latestCompleted.requirementRevisionTitle : "No finalized analysis yet"}
          accent={latestCompleted ? "success" : "default"}
          icon={<FileText className="h-4 w-4" />}
        />
      </div>

      {nextAction ? (
        <ActionPanel
          title={nextAction.title}
          description={nextAction.description}
          action={nextAction.action}
        />
      ) : null}

      <div className="grid grid-cols-1 gap-8 xl:grid-cols-2">
        <section className="space-y-4">
          <SectionHeader
            title="Recent Repositories"
            description="Focus on scan state, snapshot coverage, and the next useful action."
            action={
              <Link href="/repositories" className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-foreground">
                View all <ChevronRight className="ml-1 h-4 w-4" />
              </Link>
            }
          />

          <DataCard>
            {reposLoading ? (
              <div className="space-y-3 p-4">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            ) : repos.length === 0 ? (
              <EmptyState
                title="No repositories connected"
                description="Connect one public repository to start collecting persisted code evidence."
                icon={<Database className="h-5 w-5" />}
                action={
                  canManageRepo ? (
                    <ConnectRepoDialog>
                      <Button size="sm" variant="outline" className="shadow-none">Connect Repository</Button>
                    </ConnectRepoDialog>
                  ) : undefined
                }
              />
            ) : (
              <div className="divide-y divide-border/50">
                {repos.map(repo => {
                  const job = repo.latestScanJob
                  const coverage = repo.latestSnapshot?.coverageStatus ?? "UNKNOWN"
                  const isAnalyzable = job?.status === "COMPLETED" && repo.latestSnapshot?.id
                  const scanFailed = job?.status === "FAILED"

                  return (
                    <div key={repo.id} className="flex items-center justify-between gap-4 px-4 py-4">
                      <div className="min-w-0 space-y-2">
                        <Link href={`/repositories/${repo.id}`} className="block truncate text-sm font-semibold text-foreground hover:underline">
                          {repo.displayName}
                        </Link>
                        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                          <span className="inline-flex items-center gap-1.5">
                            <GitBranch className="h-3.5 w-3.5" />
                            {repo.latestTarget?.requestedRef ?? "No ref"}
                          </span>
                          {job?.status ? <ScanStatusBadge status={job.status} /> : null}
                          <CoverageStatusBadge status={coverage} />
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Added {formatDate(repo.createdAt)}
                          {scanFailed && job?.error?.message ? ` · ${job.error.message}` : ""}
                        </p>
                      </div>

                      <div className="shrink-0">
                        {scanFailed ? (
                          <span className="inline-flex items-center gap-1.5 rounded-md border border-danger/20 bg-danger/10 px-2.5 py-1 text-sm font-medium text-danger">
                            <AlertCircle className="h-4 w-4" />
                            Scan failed
                          </span>
                        ) : isAnalyzable && canRun ? (
                          <NewAnalysisDialog preselectedRepoId={repo.id}>
                            <Button size="sm" variant="outline" className="shadow-none">Analyze</Button>
                          </NewAnalysisDialog>
                        ) : isAnalyzable ? (
                          <span className="text-sm text-muted-foreground">Analyst or Owner required</span>
                        ) : (
                          <span className="text-sm text-muted-foreground">Waiting for usable snapshot</span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </DataCard>
        </section>

        <section className="space-y-4">
          <SectionHeader
            title="Recent Analyses"
            description="Prioritize review blockers, failed runs, and active processing before browsing completed history."
            action={
              <Link href="/analyses" className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-foreground">
                View all <ChevronRight className="ml-1 h-4 w-4" />
              </Link>
            }
          />

          <DataCard>
            {analysesLoading ? (
              <div className="space-y-3 p-4">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            ) : analyses.length === 0 ? (
              <EmptyState
                title="No analyses yet"
                description="Run one impact analysis to populate this queue with evidence-backed impacts, risks, and review work."
                icon={<Activity className="h-5 w-5" />}
                action={
                  canRun ? (
                    <NewAnalysisDialog>
                      <Button size="sm" variant="outline" className="shadow-none">Start Analysis</Button>
                    </NewAnalysisDialog>
                  ) : undefined
                }
              />
            ) : (
              <div className="divide-y divide-border/50">
                {[...analyses]
                  .sort((a, b) => {
                    const rank = (status: string) => {
                      if (status === "WAITING_FOR_REVIEW") return 0
                      if (status === "FAILED") return 1
                      if (status === "RUNNING" || status === "QUEUED") return 2
                      if (status === "COMPLETED") return 3
                      return 4
                    }
                    return rank(a.status) - rank(b.status)
                  })
                  .map(analysis => {
                    const isFailed = analysis.status === "FAILED"
                    const isReview = analysis.status === "WAITING_FOR_REVIEW"
                    const isCompleted = analysis.status === "COMPLETED"

                    return (
                      <div key={analysis.id} className="flex items-center justify-between gap-4 px-4 py-4">
                        <div className="min-w-0 space-y-2">
                          <Link href={`/analyses/${analysis.id}`} className="block truncate text-sm font-semibold text-foreground hover:underline">
                            {analysis.requirementRevisionTitle}
                          </Link>
                          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                            <span>{analysis.repositoryDisplayName}</span>
                            <span>·</span>
                            <span className="font-mono">{analysis.snapshotCommitSha.substring(0, 7)}</span>
                            <AnalysisStatusBadge status={analysis.status} />
                          </div>
                          {isFailed ? (
                            <p className="text-sm text-danger">
                              {analysis.error?.message ?? "Analysis failed. Open the detail page for the error code and rerun guidance."}
                            </p>
                          ) : runningAnalyses.some(item => item.id === analysis.id) ? (
                            <p className="text-sm text-muted-foreground">
                              The backend is still processing evidence for this analysis.
                            </p>
                          ) : null}
                        </div>

                        <div className="shrink-0">
                          {isReview ? (
                            <Link href={`/analyses/${analysis.id}?tab=review-queue`}>
                              <Button size="sm" className="border border-warning/20 bg-warning/10 text-warning shadow-none hover:bg-warning/20">
                                Review Queue
                              </Button>
                            </Link>
                          ) : isCompleted ? (
                            <Link href={`/reports?analysisId=${analysis.id}`}>
                              <Button size="sm" variant="outline" className="border-success/20 bg-success/10 text-success shadow-none hover:bg-success/20">
                                <FileText className="mr-1.5 h-4 w-4" />
                                Report
                              </Button>
                            </Link>
                          ) : (
                            <Link href={`/analyses/${analysis.id}`}>
                              <Button size="sm" variant="outline" className="shadow-none">
                                Open
                              </Button>
                            </Link>
                          )}
                        </div>
                      </div>
                    )
                  })}
              </div>
            )}
          </DataCard>
        </section>
      </div>

      {(failedAnalyses.length > 0 || runningAnalyses.length > 0) && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {failedAnalyses.length > 0 ? (
            <DataCard className="p-4">
              <SectionHeader
                title="Recent failures"
                description="Short reasons only. Open the analysis page for exact provider, stale, or partial-snapshot remediation."
              />
              <div className="mt-4 space-y-3">
                {failedAnalyses.slice(0, 3).map(analysis => (
                  <Link key={analysis.id} href={`/analyses/${analysis.id}`} className="block rounded-lg border border-danger/20 bg-danger/5 p-3 hover:bg-danger/10">
                    <p className="text-sm font-medium text-foreground">{analysis.requirementRevisionTitle}</p>
                    <p className="mt-1 text-sm text-danger">{analysis.error?.message ?? "Analysis failed."}</p>
                  </Link>
                ))}
              </div>
            </DataCard>
          ) : null}

          {runningAnalyses.length > 0 ? (
            <DataCard className="p-4">
              <SectionHeader
                title="Currently running"
                description="These analyses are still processing persisted evidence. Results appear in the analysis detail page first."
              />
              <div className="mt-4 space-y-3">
                {runningAnalyses.slice(0, 3).map(analysis => (
                  <Link key={analysis.id} href={`/analyses/${analysis.id}`} className="block rounded-lg border border-info/20 bg-info/5 p-3 hover:bg-info/10">
                    <p className="text-sm font-medium text-foreground">{analysis.requirementRevisionTitle}</p>
                    <div className="mt-2 flex items-center gap-2">
                      <AnalysisStatusBadge status={analysis.status} />
                    </div>
                  </Link>
                ))}
              </div>
            </DataCard>
          ) : null}
        </div>
      )}
    </PageShell>
  )
}
