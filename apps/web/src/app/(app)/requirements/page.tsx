"use client"

import { WorkspacePageHeader } from "@/components/workspace/shared/page-header"
import { useCurrentWorkspace } from "@/lib/project-context"
import { canCreateRequirement } from "@/lib/permissions"
import { DataList, DataListHeader, DataListRow, DataListCell } from "@/components/workspace/shared/data-list"
import { NewRequirementDialog, ReadinessStatusBadge } from "@/components/workspace/requirement/new-requirement-dialog"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useRequirements } from "@/hooks/api/use-requirements"
import { Plus, AlertCircle } from "lucide-react"

import { useAuth } from "@/hooks/use-auth"

const gridCols = "minmax(200px, 2.5fr) minmax(100px, 1fr) 180px 110px"

export default function RequirementsPage() {
  const { data, isLoading, error } = useRequirements()
  const { user } = useAuth()
  const workspace = useCurrentWorkspace()
  const canCreateReq = workspace ? canCreateRequirement(workspace.membershipRole) : false

  return (
      <div className="app-page-scroll">
        <div className="max-w-4xl mx-auto w-full py-4">
        <WorkspacePageHeader
          title="Requirements"
          description="Manage change request revisions and their readiness status before running impact analysis."
        >
          <NewRequirementDialog>
            <Button size="sm" className="h-8 shadow-none gap-1.5" disabled={!canCreateReq} title={!canCreateReq ? "Analyst role required to create requirements." : undefined}>
              <Plus className="w-3.5 h-3.5" /> New Requirement
            </Button>
          </NewRequirementDialog>
        </WorkspacePageHeader>

        <DataList>
          <DataListHeader gridCols={gridCols}>
            <DataListCell>Title</DataListCell>
            <DataListCell>Revision ID</DataListCell>
            <DataListCell>Readiness</DataListCell>
            <DataListCell>Created</DataListCell>
          </DataListHeader>

          {isLoading && (
            <>
              {[1, 2, 3].map((i) => (
                <DataListRow key={i} gridCols={gridCols}>
                  <DataListCell><Skeleton className="h-4 w-[200px]" /></DataListCell>
                  <DataListCell><Skeleton className="h-4 w-[80px]" /></DataListCell>
                  <DataListCell><Skeleton className="h-5 w-[100px] rounded-full" /></DataListCell>
                  <DataListCell><Skeleton className="h-4 w-[60px]" /></DataListCell>
                </DataListRow>
              ))}
            </>
          )}

          {error && (
            <div className="flex flex-col items-center py-16 text-muted-foreground">
              <AlertCircle className="w-6 h-6 text-destructive mb-4" />
              <p className="text-[13px] font-medium text-foreground">Failed to load requirements</p>
              <p className="text-[12px]">{error.message}</p>
            </div>
          )}

          {!isLoading && !error && data?.items.length === 0 && (
            <div className="flex flex-col items-center text-center py-16 text-muted-foreground">
              <div className="w-12 h-12 rounded-lg bg-surface border border-border/50 flex items-center justify-center mb-4">
                <Plus className="w-5 h-5" />
              </div>
              <p className="text-[13px] font-medium text-foreground mb-1">No requirements yet.</p>
              <p className="text-[12px] mb-4">Create a requirement change request to analyze backend impact.</p>
              <NewRequirementDialog>
                <Button size="sm" variant="outline" className="h-8 shadow-none gap-1.5" disabled={!canCreateReq} title={!canCreateReq ? "Analyst role required to create requirements." : undefined}>
                  <Plus className="w-3.5 h-3.5" /> New Requirement
                </Button>
              </NewRequirementDialog>
            </div>
          )}

          {data?.items.map(req => {
            const latestRev = req.latestRevision
            return (
              <DataListRow key={req.id} gridCols={gridCols} href={`/requirements/${req.id}`}>
                <DataListCell>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[13px] font-medium text-foreground leading-snug">{latestRev.title}</span>
                    {latestRev.validationIssues.length > 0 && (
                      <span className="text-[10px] text-destructive font-medium flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" /> {latestRev.validationIssues.length} issues
                      </span>
                    )}
                  </div>
                </DataListCell>
                <DataListCell>
                  <span className="font-mono text-[11px] text-muted-foreground/80">{latestRev.id.split("-")[0]}</span>
                </DataListCell>
                <DataListCell>
                  <ReadinessStatusBadge status={latestRev.readinessStatus} />
                </DataListCell>
                <DataListCell>
                  <span className="text-[12px] text-muted-foreground">
                    {new Date(latestRev.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </span>
                </DataListCell>
              </DataListRow>
            )
          })}
        </DataList>
        </div>
      </div>
    )
}
