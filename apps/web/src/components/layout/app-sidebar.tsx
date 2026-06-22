"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Workflow, PanelLeftClose, PanelLeftOpen, Database, FileText, Activity, BarChart2, Users } from "lucide-react"

interface AppSidebarProps {
  isCollapsed?: boolean
  onToggle?: () => void
}

export function AppSidebar({ isCollapsed, onToggle }: AppSidebarProps) {
  const pathname = usePathname()
  const active = (prefix: string) => pathname?.startsWith(prefix) ? "true" : undefined

  return (
    <aside className="app-sidebar flex h-full flex-col overflow-hidden">
      <div className={`flex items-center ${isCollapsed ? "justify-center" : "gap-2 px-2"} mb-8 relative`}>
        <div className="w-6 h-6 rounded-md bg-primary flex items-center justify-center shrink-0">
          <Workflow className="w-3.5 h-3.5 text-primary-foreground" />
        </div>
        {!isCollapsed && <span className="font-semibold text-sm whitespace-nowrap">BA Helper</span>}
        
        {onToggle && (
          <button 
            onClick={onToggle}
            className={`absolute right-1 w-6 h-6 rounded-md hover:bg-surface-soft flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors ${isCollapsed ? 'hidden' : ''}`}
            title="Collapse Sidebar"
            aria-label="Collapse Sidebar"
          >
            <PanelLeftClose className="w-4 h-4" />
          </button>
        )}
      </div>

      <nav className={`nav-section ${isCollapsed ? "items-center" : ""}`}>
        {!isCollapsed && <div className="nav-label">Workspace</div>}
        <Link href="/" className={`nav-item ${isCollapsed ? "justify-center px-0 w-8" : ""}`} data-active={pathname === "/" ? "true" : undefined} title="Dashboard">
          <Workflow className="w-4 h-4 shrink-0" />
          {!isCollapsed && <span>Dashboard</span>}
        </Link>
        <Link href="/repositories" className={`nav-item ${isCollapsed ? "justify-center px-0 w-8" : ""}`} data-active={active("/repositories")} title="Repositories">
          <Database className="w-4 h-4 shrink-0" />
          {!isCollapsed && <span>Repositories</span>}
        </Link>
        <Link href="/requirements" className={`nav-item ${isCollapsed ? "justify-center px-0 w-8" : ""}`} data-active={active("/requirements")} title="Requirements">
          <FileText className="w-4 h-4 shrink-0" />
          {!isCollapsed && <span>Requirements</span>}
        </Link>
        <Link href="/analyses" className={`nav-item ${isCollapsed ? "justify-center px-0 w-8" : ""}`} data-active={active("/analyses")} title="Impact Analyses">
          <Activity className="w-4 h-4 shrink-0" />
          {!isCollapsed && <span>Impact Analyses</span>}
        </Link>
        <Link href="/reports" className={`nav-item ${isCollapsed ? "justify-center px-0 w-8" : ""}`} data-active={active("/reports")} title="Finalized Analyses">
          <BarChart2 className="w-4 h-4 shrink-0" />
          {!isCollapsed && <span>Finalized Analyses</span>}
        </Link>
      </nav>

      <nav className={`nav-section mt-8 ${isCollapsed ? "items-center" : ""}`}>
        {!isCollapsed && <div className="nav-label">Advanced / Experimental</div>}
        <Link href="/analyses/runs" className={`nav-item ${isCollapsed ? "justify-center px-0 w-8" : ""}`} data-active={active("/analyses/runs")} title="Multi-repo Runs">
          <Database className="w-4 h-4 shrink-0" />
          {!isCollapsed && <span>Multi-repo Runs</span>}
        </Link>
      </nav>

      <nav className={`nav-section mt-8 ${isCollapsed ? "items-center" : ""}`}>
        {!isCollapsed && <div className="nav-label">Settings & Diagnostics</div>}
        <Link href="/settings/profile" className={`nav-item ${isCollapsed ? "justify-center px-0 w-8" : ""}`} data-active={pathname === "/settings/profile" ? "true" : undefined} title="Diagnostics">
          <Activity className="w-4 h-4 shrink-0" />
          {!isCollapsed && <span>Diagnostics</span>}
        </Link>
        <Link href="/settings/members" className={`nav-item ${isCollapsed ? "justify-center px-0 w-8" : ""}`} data-active={pathname === "/settings/members" ? "true" : undefined} title="Members">
          <Users className="w-4 h-4 shrink-0" />
          {!isCollapsed && <span>Members</span>}
        </Link>
      </nav>
      
      {isCollapsed && onToggle && (
        <div className="mt-auto flex justify-center pb-4">
          <button 
            onClick={onToggle}
            className="w-8 h-8 rounded-md hover:bg-surface-soft flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
            title="Expand Sidebar"
            aria-label="Expand Sidebar"
          >
            <PanelLeftOpen className="w-4 h-4" />
          </button>
        </div>
      )}
    </aside>
  )
}
