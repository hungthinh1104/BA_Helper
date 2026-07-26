import type { ReactNode } from "react"
import Link from "next/link"
import { useTranslations } from "next-intl"
import { ActionPanel } from "@/components/workspace/shared/primitives"
import { NewAnalysisDialog } from "@/components/workspace/analysis/new-analysis/new-analysis-dialog"
import { ConnectRepoDialog } from "@/components/workspace/repository/connect-repo-dialog"
import { NewRequirementDialog } from "@/components/workspace/requirement/new-requirement-dialog"
import { Button } from "@/components/ui/button"
import { useLocalizedHref } from "@/i18n/navigation"
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
  const t = useTranslations("dashboard")
  const href = useLocalizedHref()

  if (isLoading) return null

  let nextAction: { title: string; description: string; action?: ReactNode } | null = null

  if (repos.length === 0) {
    nextAction = canManageRepo
      ? {
          title: t("connectFirstRepository"),
          description: t("connectFirstRepositoryDescription"),
          action: (
            <ConnectRepoDialog>
              <Button size="sm" className="shadow-none">{t("connectRepository")}</Button>
            </ConnectRepoDialog>
          ),
        }
      : {
          title: t("repositoryConnectionRequired"),
          description: t("repositoryConnectionRequiredDescription"),
        }
  } else if (reqs.length === 0) {
    nextAction = canCreateReq
      ? {
          title: t("createFirstRequirement"),
          description: t("createFirstRequirementDescription"),
          action: (
            <NewRequirementDialog>
              <Button size="sm" className="shadow-none">{t("newRequirement")}</Button>
            </NewRequirementDialog>
          ),
        }
      : {
          title: t("requirementInputMissing"),
          description: t("requirementInputMissingDescription"),
        }
  } else if (analyses.length === 0 && readyRepos.length > 0 && readyReqs.length > 0) {
    nextAction = canRun
      ? {
          title: t("runFirstAnalysis"),
          description: t("runFirstAnalysisDescription"),
          action: (
            <NewAnalysisDialog>
              <Button size="sm" className="shadow-none">{t("startAnalysis")}</Button>
            </NewAnalysisDialog>
          ),
        }
      : {
          title: t("analysisReadyToStart"),
          description: t("analysisReadyToStartDescription"),
        }
  } else if (reviewBlocked > 0) {
    const reviewAnalysis = analyses.find(a => a.status === "WAITING_FOR_REVIEW")
    nextAction = canRev
      ? {
          title: t("reviewBlockingEvidence"),
          description: t("reviewBlockingEvidenceDescription", {
            title: reviewAnalysis?.requirementRevisionTitle ?? t("unknown"),
          }),
          action: (
            <Link href={href(`/analyses/${reviewAnalysis?.id}?view=review&filter=blocking`)}>
              <Button size="sm" className="shadow-none">{t("openReviewQueue")}</Button>
            </Link>
          ),
        }
      : {
          title: t("reviewBlockingFinalization"),
          description: t("reviewBlockingFinalizationDescription"),
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
