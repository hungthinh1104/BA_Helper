"use client"

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
  const workspace = useCurrentWorkspace()
  const workspaceRuntime = useWorkspaceRuntime()
  const health = useSystemHealth()

  return (
    <div className="app-page-scroll">
      <div className="max-w-4xl mx-auto w-full py-4">
        <WorkspacePageHeader
          title="Runtime Diagnostics"
          description="Workspace and API runtime connection diagnostics."
        />

        <WorkspacePanel>
          <WorkspacePanelSection
            title="Workspace Runtime"
            description="Current backend-owned workspace selection used by all project-scoped API requests."
            isLast={true}
          >
            <WorkspaceProperty
              label="Workspace Mode"
              description="Deployment mode resolved by the backend. This helps debug FE/BE connection issues after deploy."
            >
              <Input
                value={workspace.mode}
                readOnly
                className="max-w-sm h-8 text-[13px] bg-surface-muted/50 border-border/50 shadow-none focus-visible:ring-0"
              />
            </WorkspaceProperty>

            <WorkspaceProperty
              label="Project Name"
              description="Resolved current workspace name returned by the API."
            >
              <Input
                value={workspace.name}
                readOnly
                className="max-w-sm h-8 text-[13px] bg-surface-muted/50 border-border/50 shadow-none focus-visible:ring-0"
              />
            </WorkspaceProperty>

            <WorkspaceProperty
              label="Project Role"
              description="Current actor role resolved from project membership for this workspace."
            >
              <Input
                value={workspace.membershipRole ?? "No membership resolved"}
                readOnly
                className="max-w-sm h-8 text-[13px] bg-surface-muted/50 border-border/50 shadow-none focus-visible:ring-0"
              />
            </WorkspaceProperty>

            <WorkspaceProperty
              label="Project ID"
              description="Project UUID used by repository, requirement, scan, and analysis requests."
            >
              <Input
                value={workspace.projectId}
                readOnly
                className="max-w-lg h-8 text-[13px] bg-surface-muted/50 border-border/50 shadow-none focus-visible:ring-0"
              />
            </WorkspaceProperty>

            <WorkspaceProperty
              label="API Base URL"
              description="Configured frontend target for separate web/API deployments."
            >
              <Input
                value={workspaceRuntime.apiBaseUrl}
                readOnly
                className="max-w-lg h-8 text-[13px] bg-surface-muted/50 border-border/50 shadow-none focus-visible:ring-0"
              />
            </WorkspaceProperty>

            <WorkspaceProperty
              label="API Health"
              description="Live connectivity check against the backend health endpoint."
            >
              <Input
                value={
                  health.isLoading
                    ? "Checking API health"
                    : health.isError
                      ? "API unavailable"
                      : "API healthy"
                }
                readOnly
                className="max-w-sm h-8 text-[13px] bg-surface-muted/50 border-border/50 shadow-none focus-visible:ring-0"
              />
            </WorkspaceProperty>

            <WorkspaceProperty
              label="Backend Server Time"
              description="Current server timestamp from the API health response."
            >
              <Input
                value={health.data?.serverTime ?? "Unavailable"}
                readOnly
                className="max-w-lg h-8 text-[13px] bg-surface-muted/50 border-border/50 shadow-none focus-visible:ring-0"
              />
            </WorkspaceProperty>

            <WorkspaceProperty
              label="Runtime Dependencies"
              description="Backend-authored database and queue connectivity state."
            >
              <div className="grid w-full max-w-lg grid-cols-2 gap-2 text-[12px]">
                <HealthPill label="Database" value={health.data?.dependencies.database} />
                <HealthPill label="PGVector" value={health.data?.dependencies.pgvector} />
                <HealthPill label="Redis" value={health.data?.dependencies.redis} />
                <HealthPill label="Queue" value={health.data?.dependencies.queue} />
              </div>
            </WorkspaceProperty>

            <WorkspaceProperty
              label="Job Operations"
              description="Aggregate queue counts only. Raw job payloads are not exposed."
            >
              <div className="grid w-full max-w-2xl gap-2">
                <JobQueueSummary label="Scan jobs" summary={health.data?.operations.scanJobs} />
                <JobQueueSummary label="Analysis jobs" summary={health.data?.operations.analysisJobs} />
                <JobQueueSummary label="Document jobs" summary={health.data?.operations.documentJobs} />
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
  const status = summary?.status ?? "down"
  return (
    <div className="grid grid-cols-1 gap-2 rounded-md border border-border/60 bg-surface-muted/40 px-3 py-2 text-[12px] sm:grid-cols-[1fr_repeat(4,auto)] sm:items-center">
      <span className="font-medium text-foreground/80">{label}</span>
      <span className={status === "up" ? "text-success" : "text-destructive"}>
        {status.toUpperCase()}
      </span>
      <span className="text-muted-foreground">Pending {summary?.pending ?? 0}</span>
      <span className="text-muted-foreground">Running {summary?.running ?? 0}</span>
      <span className="text-muted-foreground">Failed {summary?.failed ?? 0}</span>
    </div>
  )
}
