"use client"

import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { WorkspacePageHeader } from "@/components/workspace/page-header"
import { WorkspacePanel, WorkspacePanelSection, WorkspaceProperty } from "@/components/workspace/panel"
import { useCurrentWorkspace, useWorkspaceRuntime } from "@/lib/project-context"
import { useSystemHealth } from "@/hooks/api/use-system"

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
          title="Profile Settings"
          description="Manage your account preferences and developer options."
        />

        <WorkspacePanel>
          <WorkspacePanelSection
            title="Workspace"
            description="Current backend-owned workspace selection used by all project-scoped API requests."
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
          </WorkspacePanelSection>

          <WorkspacePanelSection
            title="Personal Information"
            description="Your primary contact details for notifications and billing."
          >
            <WorkspaceProperty label="Full Name">
              <Input
                defaultValue="BA Helper User"
                readOnly
                className="max-w-sm h-8 text-[13px] bg-surface-muted/50 border-border/50 shadow-none focus-visible:ring-0"
              />
            </WorkspaceProperty>

            <WorkspaceProperty label="Email Address">
              <Input
                defaultValue="user@bahelper.dev"
                readOnly
                className="max-w-sm h-8 text-[13px] bg-surface-muted/50 border-border/50 shadow-none focus-visible:ring-0"
              />
            </WorkspaceProperty>
          </WorkspacePanelSection>

          <WorkspacePanelSection
            title="Preferences"
            description="Customize your workspace behavior and notifications."
            isLast={true}
          >
            <WorkspaceProperty
              label="Email Notifications"
              description="Receive an email when your impact analysis is complete and ready for review."
            >
              <Switch disabled defaultChecked />
            </WorkspaceProperty>

            <WorkspaceProperty
              label="Developer Mode"
              description="Show raw JSON outputs, backend debug IDs, and execution trace logs in the UI."
            >
              <Switch disabled />
            </WorkspaceProperty>
          </WorkspacePanelSection>
        </WorkspacePanel>
      </div>
    </div>
  )
}
