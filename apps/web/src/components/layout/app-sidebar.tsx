"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Workflow, PanelLeftClose, PanelLeftOpen, Database, FileText, Activity, BarChart2, User, Users } from "lucide-react"

interface AppSidebarProps {
  isCollapsed?: boolean
  onToggle?: () => void
}

export function AppSidebar({ isCollapsed, onToggle }: AppSidebarProps) {
  const pathname = usePathname()
  const active = (prefix: string) => pathname?.startsWith(prefix) ? "true" : undefined

  return (
    <aside className="app-sidebar h-full flex flex-col transition-all duration-300 overflow-hidden">
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
        <Link href="/reports" className={`nav-item ${isCollapsed ? "justify-center px-0 w-8" : ""}`} data-active={active("/reports")} title="Reports">
          <BarChart2 className="w-4 h-4 shrink-0" />
          {!isCollapsed && <span>Reports</span>}
        </Link>
      </nav>

      <nav className={`nav-section mt-8 ${isCollapsed ? "items-center" : ""}`}>
        {!isCollapsed && <div className="nav-label">Settings</div>}
        <Link href="/settings/profile" className={`nav-item ${isCollapsed ? "justify-center px-0 w-8" : ""}`} data-active={pathname === "/settings/profile" ? "true" : undefined} title="Profile">
          <User className="w-4 h-4 shrink-0" />
          {!isCollapsed && <span>Profile</span>}
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
          >
            <PanelLeftOpen className="w-4 h-4" />
          </button>
        </div>
      )}
    </aside>
  )
}
