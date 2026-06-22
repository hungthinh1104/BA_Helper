"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ThemeToggle } from "@/components/theme-toggle"
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet"
import { AppSidebar } from "./app-sidebar"
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
import { ChevronRight, ChevronsUpDown, FolderKanban, Menu, UserCircle } from "lucide-react"
import { useSystemHealth } from "@/hooks/api/use-system"
import { useAuth } from "@/hooks/use-auth"
import { useWorkspaceRuntime } from "@/lib/project-context"
import { toast } from "sonner"

const BREADCRUMB_MAP: Record<string, { label: string; parent?: { label: string; href: string } }> = {
  "/analyses": { label: "Impact Analyses" },
  "/analyses/runs": { label: "Multi-repo Runs", parent: { label: "Impact Analyses", href: "/analyses" } },
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
  if (pathname.startsWith("/analyses/runs/") && pathname.endsWith("/merged-report")) {
    return { label: "Merged Report Draft", parent: { label: "Multi-repo Runs", href: "/analyses/runs" } }
  }
  if (pathname.startsWith("/analyses/runs/")) return { label: "Run Detail", parent: { label: "Multi-repo Runs", href: "/analyses/runs" } }
  if (pathname.startsWith("/analyses/")) return { label: "Analysis Detail", parent: { label: "Impact Analyses", href: "/analyses" } }
  if (pathname.startsWith("/repositories/")) return { label: "Repository Detail", parent: { label: "Repositories", href: "/repositories" } }
  if (pathname.startsWith("/requirements/")) return { label: "Requirement Detail", parent: { label: "Requirements", href: "/requirements" } }
  return { label: "Workspace" }
}

export function AppTopbar({ isMobile }: { isMobile?: boolean }) {
  const pathname = usePathname() ?? ""
  const breadcrumb = getBreadcrumb(pathname)
  const workspace = useWorkspaceRuntime()
  const health = useSystemHealth()
  const { user, logout } = useAuth()

  const healthLabel = health.isLoading
    ? "API checking"
    : health.isError
      ? "API down"
      : "API ok"

  return (
    <header className="app-topbar gap-2 sm:gap-4">
      {isMobile && (
        <Sheet>
          <SheetTrigger
            render={<Button variant="ghost" size="icon" className="size-8 shrink-0" />}
          >
            <Menu className="size-4" />
            <span className="sr-only">Toggle menu</span>
          </SheetTrigger>
          <SheetContent side="left" className="w-64 p-0">
            <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
            <AppSidebar />
          </SheetContent>
        </Sheet>
      )}

      <div className="flex min-w-0 flex-1 items-center gap-2 text-sm">
        {breadcrumb.parent ? (
          <>
            <Link href={breadcrumb.parent.href} className="text-muted-foreground hover:text-foreground transition-colors shrink-0">
              {breadcrumb.parent.label}
            </Link>
            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/50 shrink-0" />
            <span className="font-medium text-foreground truncate">{breadcrumb.label}</span>
          </>
        ) : (
          <span className="font-medium text-foreground truncate">{breadcrumb.label}</span>
        )}
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="outline"
                size="sm"
                className="h-8 min-w-0 max-w-[42vw] justify-between shadow-none sm:min-w-44 sm:max-w-56"
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
            <DropdownMenuRadioGroup value={workspace.projectId}>
              <DropdownMenuLabel>Projects</DropdownMenuLabel>
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
                    <span className="text-xs uppercase text-muted-foreground">
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

        {!isMobile ? (
          <>
            <Badge variant="outline" className="h-6 rounded-md px-2 text-xs uppercase">
              {workspace.mode}
            </Badge>
            {workspace.membershipRole && (
              <Badge variant="outline" className="h-6 rounded-md px-2 text-xs uppercase">
                {workspace.membershipRole}
              </Badge>
            )}
            {user && (
              <>
                <Badge variant="outline" className="h-6 rounded-md px-2 text-xs uppercase">
                  {user.role}
                </Badge>
                <span className="hidden text-sm text-muted-foreground md:inline">
                  {user.name ?? user.email}
                </span>
              </>
            )}
            <Badge
              variant="outline"
              className={`h-6 rounded-md px-2 text-xs uppercase ${
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
          </>
        ) : (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="outline"
                  size="icon"
                  className="size-8 shrink-0"
                  aria-label="Open account menu"
                />
              }
            >
              <UserCircle className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                {user?.name ?? user?.email ?? "Account"}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <div className="flex flex-col gap-2 p-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs">Theme</span>
                  <ThemeToggle />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs">Health</span>
                  <Badge
                    variant="outline"
                    className={`h-5 rounded px-1.5 text-xs uppercase ${
                      health.isError
                        ? "border-destructive/30 text-destructive"
                        : health.isSuccess
                          ? "border-success/30 text-success"
                          : "border-border text-muted-foreground"
                    }`}
                  >
                    {healthLabel}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs">Mode</span>
                  <Badge variant="outline" className="h-5 rounded px-1.5 text-xs uppercase">
                    {workspace.mode}
                  </Badge>
                </div>
                {workspace.membershipRole && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs">Project Role</span>
                    <Badge variant="outline" className="h-5 rounded px-1.5 text-xs uppercase">
                      {workspace.membershipRole}
                    </Badge>
                  </div>
                )}
                {user?.role && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs">System Role</span>
                    <Badge variant="outline" className="h-5 rounded px-1.5 text-xs uppercase">
                      {user.role}
                    </Badge>
                  </div>
                )}
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => void logout()}>
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </header>
  )
}
