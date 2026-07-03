"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Workflow, PanelLeftClose, PanelLeftOpen, Database, FileText, Activity, BarChart2, Users } from "lucide-react"
import { useTranslations } from "next-intl"
import { useLocalizedHref } from "@/i18n/navigation"

interface AppSidebarProps {
  isCollapsed?: boolean
  onToggle?: () => void
}

export function AppSidebar({ isCollapsed, onToggle }: AppSidebarProps) {
  const pathname = usePathname()
  const t = useTranslations("app.sidebar")
  const href = useLocalizedHref()
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
            title={t("collapse")}
            aria-label={t("collapse")}
          >
            <PanelLeftClose className="w-4 h-4" />
          </button>
        )}
      </div>

      <nav className={`app-nav-section ${isCollapsed ? "items-center" : ""}`}>
        {!isCollapsed && <div className="app-nav-label">{t("workspace")}</div>}
        <Link href={href("/")} className={`app-nav-item ${isCollapsed ? "justify-center px-0 w-8" : ""}`} data-active={pathname === "/" ? "true" : undefined} title={t("dashboard")}>
          <Workflow className="w-4 h-4 shrink-0" />
          {!isCollapsed && <span>{t("dashboard")}</span>}
        </Link>
        <Link href={href("/repositories")} className={`app-nav-item ${isCollapsed ? "justify-center px-0 w-8" : ""}`} data-active={active("/repositories")} title={t("repositories")}>
          <Database className="w-4 h-4 shrink-0" />
          {!isCollapsed && <span>{t("repositories")}</span>}
        </Link>
        <Link href={href("/requirements")} className={`app-nav-item ${isCollapsed ? "justify-center px-0 w-8" : ""}`} data-active={active("/requirements")} title={t("requirements")}>
          <FileText className="w-4 h-4 shrink-0" />
          {!isCollapsed && <span>{t("requirements")}</span>}
        </Link>
        <Link href={href("/analyses")} className={`app-nav-item ${isCollapsed ? "justify-center px-0 w-8" : ""}`} data-active={active("/analyses")} title={t("impactAnalyses")}>
          <Activity className="w-4 h-4 shrink-0" />
          {!isCollapsed && <span>{t("impactAnalyses")}</span>}
        </Link>
        <Link href={href("/reports")} className={`app-nav-item ${isCollapsed ? "justify-center px-0 w-8" : ""}`} data-active={active("/reports")} title={t("finalizedAnalyses")}>
          <BarChart2 className="w-4 h-4 shrink-0" />
          {!isCollapsed && <span>{t("finalizedAnalyses")}</span>}
        </Link>
      </nav>

      <nav className={`app-nav-section mt-8 ${isCollapsed ? "items-center" : ""}`}>
        {!isCollapsed && <div className="app-nav-label">{t("advanced")}</div>}
        <Link href={href("/analyses/runs")} className={`app-nav-item ${isCollapsed ? "justify-center px-0 w-8" : ""}`} data-active={active("/analyses/runs")} title={t("multiRepoRuns")}>
          <Database className="w-4 h-4 shrink-0" />
          {!isCollapsed && <span>{t("multiRepoRuns")}</span>}
        </Link>
      </nav>

      <nav className={`app-nav-section mt-8 ${isCollapsed ? "items-center" : ""}`}>
        {!isCollapsed && <div className="app-nav-label">{t("settings")}</div>}
        <Link href={href("/settings/profile")} className={`app-nav-item ${isCollapsed ? "justify-center px-0 w-8" : ""}`} data-active={pathname === "/settings/profile" ? "true" : undefined} title={t("diagnostics")}>
          <Activity className="w-4 h-4 shrink-0" />
          {!isCollapsed && <span>{t("diagnostics")}</span>}
        </Link>
        <Link href={href("/settings/members")} className={`app-nav-item ${isCollapsed ? "justify-center px-0 w-8" : ""}`} data-active={pathname === "/settings/members" ? "true" : undefined} title={t("members")}>
          <Users className="w-4 h-4 shrink-0" />
          {!isCollapsed && <span>{t("members")}</span>}
        </Link>
      </nav>
      
      {isCollapsed && onToggle && (
        <div className="mt-auto flex justify-center pb-4">
          <button 
            onClick={onToggle}
            className="w-8 h-8 rounded-md hover:bg-surface-soft flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
            title={t("expand")}
            aria-label={t("expand")}
          >
            <PanelLeftOpen className="w-4 h-4" />
          </button>
        </div>
      )}
    </aside>
  )
}
