"use client"

import {
  Activity,
  Database,
  FileText,
  ListChecks,
} from "lucide-react"
import { useLocale, useTranslations } from "next-intl"

import {
  MetricCard,
  PageShell,
} from "@/components/workspace/shared/primitives"
import { WorkspacePageHeader } from "@/components/workspace/shared/page-header"
import { DashboardActionPanel } from "./_components/dashboard-action-panel"
import { DashboardRecentRepositories } from "./_components/dashboard-recent-repositories"
import { DashboardRecentAnalyses } from "./_components/dashboard-recent-analyses"
import { DashboardActiveIssues } from "./_components/dashboard-active-issues"

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
import { analysisStatusLabels, getLocalizedLabel } from "@/lib/i18n/status-labels"


export default function DashboardPage() {
  const t = useTranslations("dashboard")
  const locale = useLocale()
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



  return (
    <PageShell>
      <WorkspacePageHeader
        title={t("title")}
        description={t("description")}
        className="mb-0"
      />

      <div className="grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-3">
        <MetricCard
          label={t("repositories")}
          value={`${repos.length}`}
          detail={t("readyPartial", { ready: readyRepos.length, partial: partialRepos.length })}
          accent={repos.length > 0 ? "success" : "default"}
          icon={<Database className="h-4 w-4" />}
        />
        <MetricCard
          label={t("requirements")}
          value={`${readyReqs.length}`}
          detail={t("totalRevisions", { total: reqs.length })}
          accent={readyReqs.length > 0 ? "success" : "default"}
          icon={<FileText className="h-4 w-4" />}
        />
        <MetricCard
          label={t("latestAnalysis")}
          value={analyses[0] ? getLocalizedLabel(analysisStatusLabels, analyses[0].status, locale) : t("none")}
          detail={analyses[0] ? analyses[0].requirementRevisionTitle : t("noAnalysisRun")}
          accent={analyses[0]?.status === "FAILED" ? "danger" : analyses[0]?.status === "WAITING_FOR_REVIEW" ? "warning" : "default"}
          icon={<Activity className="h-4 w-4" />}
        />
        <MetricCard
          label={t("reviewBlocking")}
          value={`${reviewBlocked}`}
          detail={reviewBlocked > 0 ? t("reviewBlockingDetail") : t("noReviewBlockers")}
          accent={reviewBlocked > 0 ? "warning" : "success"}
          icon={<ListChecks className="h-4 w-4" />}
        />
        <MetricCard
          label={t("latestReport")}
          value={latestCompleted ? t("available") : t("unavailable")}
          detail={latestCompleted ? latestCompleted.requirementRevisionTitle : t("noFinalizedAnalysis")}
          accent={latestCompleted ? "success" : "default"}
          icon={<FileText className="h-4 w-4" />}
        />
      </div>

      <DashboardActionPanel
        repos={repos}
        analyses={analyses}
        reqs={reqs}
        readyRepos={readyRepos}
        readyReqs={readyReqs}
        reviewBlocked={reviewBlocked}
        canManageRepo={canManageRepo}
        canCreateReq={canCreateReq}
        canRun={canRun}
        canRev={canRev}
        isLoading={reposLoading || analysesLoading || reqsLoading}
      />

      <div className="grid grid-cols-1 gap-8 xl:grid-cols-2">
        <DashboardRecentRepositories
          repos={repos}
          reposLoading={reposLoading}
          canManageRepo={canManageRepo}
          canRun={canRun}
        />
        <DashboardRecentAnalyses
          analyses={analyses}
          analysesLoading={analysesLoading}
          runningAnalyses={runningAnalyses}
          canRun={canRun}
        />
      </div>

      <DashboardActiveIssues
        failedAnalyses={failedAnalyses}
        runningAnalyses={runningAnalyses}
      />
    </PageShell>
  )
}
