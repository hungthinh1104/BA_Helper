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
  DropdownMenuGroup,
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
import { useTranslations } from "next-intl"
import { LocaleSwitcher } from "@/components/i18n/locale-switcher"
import { useLocalizedHref } from "@/i18n/navigation"

type BreadcrumbKey =
  | "workspace"
  | "impactAnalyses"
  | "multiRepoRuns"
  | "repositories"
  | "requirements"
  | "reports"
  | "settings"
  | "profile"
  | "members"
  | "mergedReportDraft"
  | "runDetail"
  | "analysisDetail"
  | "repositoryDetail"
  | "requirementDetail"

type Breadcrumb = {
  labelKey: BreadcrumbKey
  parent?: { labelKey: BreadcrumbKey; href: string }
}

const BREADCRUMB_MAP: Record<string, Breadcrumb> = {
  "/analyses": { labelKey: "impactAnalyses" },
  "/analyses/runs": { labelKey: "multiRepoRuns", parent: { labelKey: "impactAnalyses", href: "/analyses" } },
  "/repositories": { labelKey: "repositories" },
  "/requirements": { labelKey: "requirements" },
  "/reports": { labelKey: "reports" },
  "/settings/profile": { labelKey: "profile", parent: { labelKey: "settings", href: "/settings" } },
  "/settings/members": { labelKey: "members", parent: { labelKey: "settings", href: "/settings" } },
}

function getBreadcrumb(pathname: string): Breadcrumb {
  // Exact match first
  if (BREADCRUMB_MAP[pathname]) return BREADCRUMB_MAP[pathname]
  // Dynamic segments
  if (pathname.startsWith("/analyses/runs/") && pathname.endsWith("/merged-report")) {
    return { labelKey: "mergedReportDraft", parent: { labelKey: "multiRepoRuns", href: "/analyses/runs" } }
  }
  if (pathname.startsWith("/analyses/runs/")) return { labelKey: "runDetail", parent: { labelKey: "multiRepoRuns", href: "/analyses/runs" } }
  if (pathname.startsWith("/analyses/")) return { labelKey: "analysisDetail", parent: { labelKey: "impactAnalyses", href: "/analyses" } }
  if (pathname.startsWith("/repositories/")) return { labelKey: "repositoryDetail", parent: { labelKey: "repositories", href: "/repositories" } }
  if (pathname.startsWith("/requirements/")) return { labelKey: "requirementDetail", parent: { labelKey: "requirements", href: "/requirements" } }
  return { labelKey: "workspace" }
}

export function AppTopbar({ isMobile }: { isMobile?: boolean }) {
  const pathname = usePathname() ?? ""
  const breadcrumb = getBreadcrumb(pathname)
  const tTopbar = useTranslations("app.topbar")
  const tBreadcrumbs = useTranslations("app.breadcrumbs")
  const tLocale = useTranslations("app.locale")
  const href = useLocalizedHref()
  const workspace = useWorkspaceRuntime()
  const health = useSystemHealth()
  const { user, logout } = useAuth()

  const healthLabel = health.isLoading
    ? tTopbar("apiChecking")
    : health.isError
      ? tTopbar("apiDown")
      : tTopbar("apiOk")

  return (
    <header className="app-topbar gap-2 sm:gap-4">
      {isMobile && (
        <Sheet>
          <SheetTrigger
            render={<Button variant="ghost" size="icon" className="size-8 shrink-0" />}
          >
            <Menu className="size-4" />
            <span className="sr-only">{tTopbar("toggleMenu")}</span>
          </SheetTrigger>
          <SheetContent side="left" className="w-64 p-0">
            <SheetTitle className="sr-only">{tTopbar("navigationMenu")}</SheetTitle>
            <AppSidebar />
          </SheetContent>
        </Sheet>
      )}

      <div className="flex min-w-0 flex-1 items-center gap-2 text-sm">
        {breadcrumb.parent ? (
          <>
            <Link href={href(breadcrumb.parent.href)} className="text-muted-foreground hover:text-foreground transition-colors shrink-0">
              {tBreadcrumbs(breadcrumb.parent.labelKey)}
            </Link>
            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/50 shrink-0" />
            <span className="font-medium text-foreground truncate">{tBreadcrumbs(breadcrumb.labelKey)}</span>
          </>
        ) : (
          <span className="font-medium text-foreground truncate">{tBreadcrumbs(breadcrumb.labelKey)}</span>
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
              <DropdownMenuLabel>{tTopbar("projects")}</DropdownMenuLabel>
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
            <DropdownMenuItem render={<Link href={href("/settings/members")} />}>
              {tTopbar("manageMembers")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {!isMobile ? (
          <>
            <LocaleSwitcher />
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
              {tTopbar("signOut")}
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
                  aria-label={tTopbar("openAccountMenu")}
                />
              }
            >
              <UserCircle className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuGroup>
                <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                  {user?.name ?? user?.email ?? tTopbar("account")}
                </DropdownMenuLabel>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <div className="flex flex-col gap-2 p-2">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs">{tLocale("label")}</span>
                  <LocaleSwitcher />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs">{tTopbar("theme")}</span>
                  <ThemeToggle />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs">{tTopbar("health")}</span>
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
                {tTopbar("signOut")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </header>
  )
}
