"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ThemeToggle } from "@/components/theme-toggle"
import { ChevronRight } from "lucide-react"
import { useSystemHealth } from "@/hooks/api/use-system"
import { useWorkspaceRuntime } from "@/lib/project-context"

const BREADCRUMB_MAP: Record<string, { label: string; parent?: { label: string; href: string } }> = {
  "/analyses": { label: "Impact Analyses" },
  "/repositories": { label: "Repositories" },
  "/requirements": { label: "Requirements" },
  "/reports": { label: "Reports" },
  "/settings/profile": { label: "Profile", parent: { label: "Settings", href: "/settings" } },
}

function getBreadcrumb(pathname: string) {
  // Exact match first
  if (BREADCRUMB_MAP[pathname]) return BREADCRUMB_MAP[pathname]
  // Dynamic segments
  if (pathname.startsWith("/analyses/")) return { label: "Analysis Detail", parent: { label: "Impact Analyses", href: "/analyses" } }
  if (pathname.startsWith("/repositories/")) return { label: "Repository Detail", parent: { label: "Repositories", href: "/repositories" } }
  if (pathname.startsWith("/requirements/")) return { label: "Requirement Detail", parent: { label: "Requirements", href: "/requirements" } }
  return { label: "Workspace" }
}

export function AppTopbar() {
  const pathname = usePathname() ?? ""
  const breadcrumb = getBreadcrumb(pathname)
  const isAnalysisDetail = pathname.startsWith("/analyses/") && pathname !== "/analyses"
  const analysisId = isAnalysisDetail ? pathname.split("/")[2] : null
  const workspace = useWorkspaceRuntime()
  const health = useSystemHealth()

  const healthLabel = health.isLoading
    ? "API checking"
    : health.isError
      ? "API down"
      : "API ok"

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
        <Badge variant="outline" className="h-6 rounded-md px-2 text-[10px] uppercase tracking-wider">
          {workspace.mode}
        </Badge>
        <Badge
          variant="outline"
          className={`h-6 rounded-md px-2 text-[10px] uppercase tracking-wider ${
            health.isError
              ? "border-destructive/30 text-destructive"
              : health.isSuccess
                ? "border-success/30 text-success"
                : "border-border text-muted-foreground"
          }`}
        >
          {healthLabel}
        </Badge>
        <ThemeToggle />
        {isAnalysisDetail && (
          <>
            <Button variant="ghost" size="sm" className="h-8 shadow-none text-muted-foreground">Share</Button>
            <Link href={analysisId ? `/reports?analysisId=${analysisId}` : "/reports"}>
              <Button size="sm" className="h-8 shadow-none">Export Report</Button>
            </Link>
          </>
        )}
      </div>
    </header>
  )
}
