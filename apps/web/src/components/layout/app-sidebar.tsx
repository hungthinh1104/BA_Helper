"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Workflow } from "lucide-react"

export function AppSidebar() {
  const pathname = usePathname()
  const active = (prefix: string) => pathname?.startsWith(prefix) ? "true" : undefined

  return (
    <aside className="app-sidebar">
      <div className="flex items-center gap-2 px-2 mb-8">
        <div className="w-6 h-6 rounded-md bg-primary flex items-center justify-center">
          <Workflow className="w-3.5 h-3.5 text-primary-foreground" />
        </div>
        <span className="font-semibold text-sm">BA Helper</span>
      </div>

      <nav className="nav-section">
        <div className="nav-label">Workspace</div>
        <Link href="/app/repositories" className="nav-item" data-active={active("/app/repositories")}>
          Repositories
        </Link>
        <Link href="/app/requirements" className="nav-item" data-active={active("/app/requirements")}>
          Requirements
        </Link>
        <Link href="/app/analyses" className="nav-item" data-active={active("/app/analyses")}>
          Impact Analyses
        </Link>
        <Link href="/app/reports" className="nav-item" data-active={active("/app/reports")}>
          Reports
        </Link>
      </nav>

      <nav className="nav-section mt-8">
        <div className="nav-label">Settings</div>
        <Link href="/app/settings/profile" className="nav-item" data-active={active("/app/settings")}>
          Profile
        </Link>
      </nav>
    </aside>
  )
}
