"use client"

import { useTranslations } from "next-intl"
import { Input } from "@/components/ui/input"

import { WorkspacePageHeader } from "@/components/workspace/shared/page-header"
import { WorkspacePanel, WorkspacePanelSection, WorkspaceProperty } from "@/components/workspace/shared/panel"
import { useCurrentWorkspace, useWorkspaceRuntime } from "@/lib/project-context"
import { useSystemHealth } from "@/hooks/api/use-system"
import type { SystemJobQueueSummary } from "@ba-helper/contracts"

export default function ProfileSettingsPage() {
  return (
      <ProfileSettingsContent />
    )
}

function ProfileSettingsContent() {
  const t = useTranslations("settings")
  const workspace = useCurrentWorkspace()
  const workspaceRuntime = useWorkspaceRuntime()
  const health = useSystemHealth()

  return (
    <div className="app-page-scroll">
      <div className="max-w-4xl mx-auto w-full py-4">
        <WorkspacePageHeader
          title={t("runtimeDiagnostics")}
          description={t("runtimeDiagnosticsDescription")}
        />

        <WorkspacePanel>
          <WorkspacePanelSection
            title={t("workspaceRuntime")}
            description={t("workspaceRuntimeDescription")}
            isLast={true}
          >
            <WorkspaceProperty
              label={t("workspaceMode")}
              description={t("workspaceModeDescription")}
            >
              <Input
                value={workspace.mode}
                readOnly
                className="max-w-sm h-8 text-[13px] bg-surface-muted/50 border-border/50 shadow-none focus-visible:ring-0"
              />
            </WorkspaceProperty>

            <WorkspaceProperty
              label={t("projectName")}
              description={t("projectNameDescription")}
            >
              <Input
                value={workspace.name}
                readOnly
                className="max-w-sm h-8 text-[13px] bg-surface-muted/50 border-border/50 shadow-none focus-visible:ring-0"
              />
            </WorkspaceProperty>

            <WorkspaceProperty
              label={t("projectRole")}
              description={t("projectRoleDescription")}
            >
              <Input
                value={workspace.membershipRole ?? t("noMembershipResolved")}
                readOnly
                className="max-w-sm h-8 text-[13px] bg-surface-muted/50 border-border/50 shadow-none focus-visible:ring-0"
              />
            </WorkspaceProperty>

            <WorkspaceProperty
              label={t("projectId")}
              description={t("projectIdDescription")}
            >
              <Input
                value={workspace.projectId}
                readOnly
                className="max-w-lg h-8 text-[13px] bg-surface-muted/50 border-border/50 shadow-none focus-visible:ring-0"
              />
            </WorkspaceProperty>

            <WorkspaceProperty
              label={t("apiBaseUrl")}
              description={t("apiBaseUrlDescription")}
            >
              <Input
                value={workspaceRuntime.apiBaseUrl}
                readOnly
                className="max-w-lg h-8 text-[13px] bg-surface-muted/50 border-border/50 shadow-none focus-visible:ring-0"
              />
            </WorkspaceProperty>

            <WorkspaceProperty
              label={t("apiHealth")}
              description={t("apiHealthDescription")}
            >
              <Input
                value={
                  health.isLoading
                    ? t("checkingApiHealth")
                    : health.isError
                      ? t("apiUnavailable")
                      : t("apiHealthy")
                }
                readOnly
                className="max-w-sm h-8 text-[13px] bg-surface-muted/50 border-border/50 shadow-none focus-visible:ring-0"
              />
            </WorkspaceProperty>

            <WorkspaceProperty
              label={t("backendServerTime")}
              description={t("backendServerTimeDescription")}
            >
              <Input
                value={health.data?.serverTime ?? t("unavailable")}
                readOnly
                className="max-w-lg h-8 text-[13px] bg-surface-muted/50 border-border/50 shadow-none focus-visible:ring-0"
              />
            </WorkspaceProperty>

            <WorkspaceProperty
              label={t("runtimeDependencies")}
              description={t("runtimeDependenciesDescription")}
            >
              <div className="grid w-full max-w-lg grid-cols-2 gap-2 text-[12px]">
                <HealthPill label={t("database")} value={health.data?.dependencies.database} />
                <HealthPill label="PGVector" value={health.data?.dependencies.pgvector} />
                <HealthPill label="Redis" value={health.data?.dependencies.redis} />
                <HealthPill label={t("queue")} value={health.data?.dependencies.queue} />
              </div>
            </WorkspaceProperty>

            <WorkspaceProperty
              label={t("jobOperations")}
              description={t("jobOperationsDescription")}
            >
              <div className="grid w-full max-w-2xl gap-2">
                <JobQueueSummary label={t("scanJobs")} summary={health.data?.operations.scanJobs} />
                <JobQueueSummary label={t("analysisJobs")} summary={health.data?.operations.analysisJobs} />
                <JobQueueSummary label={t("documentJobs")} summary={health.data?.operations.documentJobs} />
              </div>
            </WorkspaceProperty>
          </WorkspacePanelSection>
        </WorkspacePanel>
      </div>
    </div>
  )
}

function HealthPill({ label, value }: { label: string; value?: "up" | "down" }) {
  const resolved = value ?? "down"
  return (
    <div className="flex items-center justify-between rounded-md border border-border/60 bg-surface-muted/40 px-3 py-2">
      <span className="font-medium text-foreground/80">{label}</span>
      <span className={resolved === "up" ? "text-success" : "text-destructive"}>
        {resolved.toUpperCase()}
      </span>
    </div>
  )
}

function JobQueueSummary({
  label,
  summary,
}: {
  label: string
  summary?: SystemJobQueueSummary
}) {
  const t = useTranslations("settings")
  const status = summary?.status ?? "down"
  return (
    <div className="grid grid-cols-1 gap-2 rounded-md border border-border/60 bg-surface-muted/40 px-3 py-2 text-[12px] sm:grid-cols-[1fr_repeat(4,auto)] sm:items-center">
      <span className="font-medium text-foreground/80">{label}</span>
      <span className={status === "up" ? "text-success" : "text-destructive"}>
        {status.toUpperCase()}
      </span>
      <span className="text-muted-foreground">{t("pendingCount", { count: summary?.pending ?? 0 })}</span>
      <span className="text-muted-foreground">{t("runningCount", { count: summary?.running ?? 0 })}</span>
      <span className="text-muted-foreground">{t("failedCount", { count: summary?.failed ?? 0 })}</span>
    </div>
  )
}
