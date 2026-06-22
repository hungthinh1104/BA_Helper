import Link from "next/link"
import { AlertCircle, ChevronRight, Database, GitBranch } from "lucide-react"
import { ConnectRepoDialog } from "@/components/workspace/repository/connect-repo-dialog"
import { NewAnalysisDialog } from "@/components/workspace/analysis/new-analysis/new-analysis-dialog"
import { DataCard, EmptyState, SectionHeader } from "@/components/workspace/shared/primitives"
import { CoverageStatusBadge, ScanStatusBadge } from "@/components/workspace/shared/status-badges"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

import type { RepositoryListResponse } from "@ba-helper/contracts"

interface DashboardRecentRepositoriesProps {
  repos: RepositoryListResponse["items"]
  reposLoading: boolean
  canManageRepo: boolean
  canRun: boolean
}

export function DashboardRecentRepositories({
  repos,
  reposLoading,
  canManageRepo,
  canRun,
}: DashboardRecentRepositoriesProps) {
  return (
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
  )
}
