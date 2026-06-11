"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import { ThemeToggle } from "@/components/theme-toggle"
import { ChevronRight } from "lucide-react"

const BREADCRUMB_MAP: Record<string, { label: string; parent?: { label: string; href: string } }> = {
  "/app/analyses": { label: "Impact Analyses" },
  "/app/repositories": { label: "Repositories" },
  "/app/requirements": { label: "Requirements" },
  "/app/reports": { label: "Reports" },
  "/app/settings/profile": { label: "Profile", parent: { label: "Settings", href: "/app/settings" } },
}

function getBreadcrumb(pathname: string) {
  // Exact match first
  if (BREADCRUMB_MAP[pathname]) return BREADCRUMB_MAP[pathname]
  // Dynamic segments
  if (pathname.startsWith("/app/analyses/")) return { label: "Analysis Detail", parent: { label: "Impact Analyses", href: "/app/analyses" } }
  if (pathname.startsWith("/app/reports/")) return { label: "Report View", parent: { label: "Reports", href: "/app/reports" } }
  if (pathname.startsWith("/app/repositories/")) return { label: "Repository Detail", parent: { label: "Repositories", href: "/app/repositories" } }
  if (pathname.startsWith("/app/requirements/")) return { label: "Requirement Detail", parent: { label: "Requirements", href: "/app/requirements" } }
  return { label: "Workspace" }
}

export function AppTopbar() {
  const pathname = usePathname() ?? ""
  const breadcrumb = getBreadcrumb(pathname)
  const isAnalysisDetail = pathname.startsWith("/app/analyses/") && pathname !== "/app/analyses"

  return (
    <header className="app-topbar">
      <div className="flex items-center gap-2 text-sm">
        {breadcrumb.parent ? (
          <>
            <Link href={breadcrumb.parent.href} className="text-muted-foreground hover:text-foreground transition-colors">
              {breadcrumb.parent.label}
            </Link>
            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/50" />
            <span className="font-medium text-foreground">{breadcrumb.label}</span>
          </>
        ) : (
          <span className="font-medium text-foreground">{breadcrumb.label}</span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <ThemeToggle />
        {isAnalysisDetail && (
          <>
            <Button variant="ghost" size="sm" className="h-8 shadow-none text-muted-foreground">Share</Button>
            <Link href={pathname.replace("/app/analyses/", "/app/reports/")}>
              <Button size="sm" className="h-8 shadow-none">Export Report</Button>
            </Link>
          </>
        )}
      </div>
    </header>
  )
}
