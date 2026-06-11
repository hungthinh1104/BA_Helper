import { AppShell } from "@/components/layout/app-shell"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { WorkspacePageHeader } from "@/components/workspace/page-header"
import { WorkspacePanel, WorkspacePanelSection, WorkspaceProperty } from "@/components/workspace/panel"

export default function ProfileSettingsPage() {
  return (
    <AppShell>
      <div className="app-page-scroll">
        <div className="max-w-4xl mx-auto w-full py-4">
        <WorkspacePageHeader 
          title="Profile Settings" 
          description="Manage your account preferences and developer options."
        />
        
        <WorkspacePanel>
          <WorkspacePanelSection 
            title="Personal Information"
            description="Your primary contact details for notifications and billing."
          >
            <WorkspaceProperty label="Full Name">
              <Input defaultValue="BA Helper User" readOnly className="max-w-sm h-8 text-[13px] bg-surface-muted/50 border-border/50 shadow-none focus-visible:ring-0" />
            </WorkspaceProperty>
            
            <WorkspaceProperty label="Email Address">
              <Input defaultValue="user@bahelper.dev" readOnly className="max-w-sm h-8 text-[13px] bg-surface-muted/50 border-border/50 shadow-none focus-visible:ring-0" />
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
    </AppShell>
  )
}
