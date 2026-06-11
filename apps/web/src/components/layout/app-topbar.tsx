"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ThemeToggle } from "@/components/theme-toggle"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ChevronRight, ChevronsUpDown, FolderKanban } from "lucide-react"
import { useSystemHealth } from "@/hooks/api/use-system"
import { useAuth } from "@/hooks/use-auth"
import { useWorkspaceRuntime } from "@/lib/project-context"
import { toast } from "sonner"

const BREADCRUMB_MAP: Record<string, { label: string; parent?: { label: string; href: string } }> = {
  "/analyses": { label: "Impact Analyses" },
  "/repositories": { label: "Repositories" },
  "/requirements": { label: "Requirements" },
  "/reports": { label: "Reports" },
  "/settings/profile": { label: "Profile", parent: { label: "Settings", href: "/settings" } },
  "/settings/members": { label: "Members", parent: { label: "Settings", href: "/settings" } },
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
  const { user, logout } = useAuth()

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
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="outline"
                size="sm"
                className="h-8 min-w-44 justify-between shadow-none"
                disabled={workspace.switchingProjectId !== null}
              />
            }
          >
            <span className="flex items-center gap-2 truncate">
              <FolderKanban className="size-3.5" />
              <span className="truncate">{workspace.name}</span>
            </span>
            <ChevronsUpDown className="size-3.5 text-muted-foreground" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-56">
            <DropdownMenuLabel>Projects</DropdownMenuLabel>
            <DropdownMenuRadioGroup value={workspace.projectId}>
              {workspace.projects.map((project) => (
                <DropdownMenuRadioItem
                  key={project.projectId}
                  value={project.projectId}
                  disabled={workspace.switchingProjectId !== null}
                  onClick={async () => {
                    if (project.projectId === workspace.projectId) return
                    try {
                      await workspace.switchProject(project.projectId)
                    } catch (error) {
                      toast.error(error instanceof Error ? error.message : "Failed to switch project.")
                    }
                  }}
                >
                  <span className="flex min-w-0 flex-1 items-center justify-between gap-3">
                    <span className="truncate">{project.name}</span>
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      {project.membershipRole}
                    </span>
                  </span>
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem render={<Link href="/settings/members" />}>
              Manage members
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Badge variant="outline" className="h-6 rounded-md px-2 text-[10px] uppercase tracking-wider">
          {workspace.mode}
        </Badge>
        {workspace.membershipRole && (
          <Badge variant="outline" className="h-6 rounded-md px-2 text-[10px] uppercase tracking-wider">
            {workspace.membershipRole}
          </Badge>
        )}
        {user && (
          <>
            <Badge variant="outline" className="h-6 rounded-md px-2 text-[10px] uppercase tracking-wider">
              {user.role}
            </Badge>
            <span className="hidden text-sm text-muted-foreground md:inline">
              {user.name ?? user.email}
            </span>
          </>
        )}
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
        <Button variant="outline" size="sm" className="h-8 shadow-none" onClick={() => void logout()}>
          Sign out
        </Button>
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
