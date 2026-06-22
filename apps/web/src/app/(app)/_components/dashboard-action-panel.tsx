import type { ReactNode } from "react"
import Link from "next/link"
import { ActionPanel } from "@/components/workspace/shared/primitives"
import { NewAnalysisDialog } from "@/components/workspace/analysis/new-analysis/new-analysis-dialog"
import { ConnectRepoDialog } from "@/components/workspace/repository/connect-repo-dialog"
import { NewRequirementDialog } from "@/components/workspace/requirement/new-requirement-dialog"
import { Button } from "@/components/ui/button"
import type { RepositoryListResponse, ImpactAnalysisListResponse, RequirementListResponse } from "@ba-helper/contracts"

interface DashboardActionPanelProps {
  repos: RepositoryListResponse["items"]
  analyses: ImpactAnalysisListResponse["items"]
  reqs: RequirementListResponse["items"]
  readyRepos: RepositoryListResponse["items"]
  readyReqs: RequirementListResponse["items"]
  reviewBlocked: number
  canManageRepo: boolean
  canCreateReq: boolean
  canRun: boolean
  canRev: boolean
  isLoading: boolean
}

export function DashboardActionPanel({
  repos,
  analyses,
  reqs,
  readyRepos,
  readyReqs,
  reviewBlocked,
  canManageRepo,
  canCreateReq,
  canRun,
  canRev,
  isLoading,
}: DashboardActionPanelProps) {
  if (isLoading) return null

  let nextAction: { title: string; description: string; action?: ReactNode } | null = null

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

  if (!nextAction) return null

  return (
    <ActionPanel
      title={nextAction.title}
      description={nextAction.description}
      action={nextAction.action}
    />
  )
}
