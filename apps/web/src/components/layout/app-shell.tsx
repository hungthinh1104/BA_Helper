"use client"

import { ReactNode } from "react"
import { AppSidebar } from "./app-sidebar"
import { AppTopbar } from "./app-topbar"
import { useProjectStatus } from "@/lib/project-context"

interface AppShellProps {
  children: ReactNode
}

import { useRef, useState, useCallback } from "react"
import { Group, Panel, Separator, PanelImperativeHandle } from "react-resizable-panels"

export function AppShell({ children }: AppShellProps) {
  return (
    <AppShellInner>{children}</AppShellInner>
  )
}

function AppShellInner({ children }: AppShellProps) {
  const status = useProjectStatus()
  const sidebarRef = useRef<PanelImperativeHandle>(null)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)

  const toggleSidebar = () => {
    const panel = sidebarRef.current
    if (panel) {
      if (panel.isCollapsed()) {
        panel.expand()
      } else {
        panel.collapse()
      }
    }
  }

  const handleSidebarResize = useCallback(() => {
    if (sidebarRef.current) {
      setIsSidebarCollapsed(sidebarRef.current.isCollapsed())
    }
  }, [])

  if (status.status === "loading") {
    return (
      <div className="app-shell flex items-center justify-center">
        <main className="p-6 text-sm text-muted-foreground">
          Initializing workspace...
        </main>
      </div>
    )
  }

  if (status.status === "error") {
    return (
      <div className="app-shell flex items-center justify-center">
        <main className="p-6">
          <div className="max-w-2xl rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-sm">
            <div className="font-medium text-destructive">Workspace bootstrap failed</div>
            <p className="mt-1 text-destructive/90">{status.message}</p>
            <div className="mt-3 space-y-1 text-xs text-muted-foreground">
              <p>Error code: <span className="font-mono">{status.code}</span></p>
              <p>API URL: <span className="font-mono">{status.apiBaseUrl ?? "unresolved"}</span></p>
            </div>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="app-shell">
      <Group orientation="horizontal" id="app-shell-panels" className="h-full w-full">
        <Panel
          panelRef={sidebarRef}
          defaultSize="248px"
          minSize="200px"
          maxSize="400px"
          collapsible={true}
          collapsedSize="64px"
          onResize={handleSidebarResize}
          className="h-full border-r border-border bg-surface transition-all duration-300 ease-in-out"
        >
          <AppSidebar isCollapsed={isSidebarCollapsed} onToggle={toggleSidebar} />
        </Panel>

        <Separator className="w-1.5 flex items-center justify-center cursor-col-resize shrink-0 group outline-none hover:bg-transparent">
          <div className="h-full w-[1px] bg-border group-hover:bg-accent/60 group-active:bg-accent transition-colors" />
        </Separator>

        <Panel className="flex flex-col h-full min-w-0">
          <AppTopbar />
          <main className="app-main flex-1 min-h-0">
            {children}
          </main>
        </Panel>
      </Group>
    </div>
  )
}
