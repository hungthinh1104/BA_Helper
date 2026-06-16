"use client"

import { use } from "react"
import { WorkspacePageHeader } from "@/components/workspace/shared/page-header"
import { Button } from "@/components/ui/button"
import { ReadinessStatusBadge } from "@/components/workspace/requirement/new-requirement-dialog"
import { Play, AlertCircle, FileText, CheckCircle2, Archive, Clock } from "lucide-react"
import { notFound } from "next/navigation"
import { NewAnalysisDialog } from "@/components/workspace/analysis/new-analysis/new-analysis-dialog"
import { BackButton } from "@/components/workspace/shared/back-button"
import { useRequirementDetail } from "@/hooks/api/use-requirements"
import { Skeleton } from "@/components/ui/skeleton"
import { useAuth } from "@/hooks/use-auth"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { useCurrentWorkspace } from "@/lib/project-context"
import { canRunAnalysis } from "@/lib/permissions"

export default function RequirementDetailsPage({ params }: { params: Promise<{ requirementId: string }> }) {
  const { requirementId } = use(params)
  
  const { data: req, isLoading, error } = useRequirementDetail(undefined, requirementId)
  const { user } = useAuth()
  const workspace = useCurrentWorkspace()
  const canRun = workspace ? canRunAnalysis(workspace.membershipRole) : false

  if (isLoading) {
    return (
        <div className="max-w-4xl mx-auto w-full flex flex-col gap-8 py-8 px-4">
          <Skeleton className="h-8 w-[200px]" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2 flex flex-col gap-6">
              <Skeleton className="h-[200px] w-full" />
            </div>
            <div className="flex flex-col gap-6">
              <Skeleton className="h-[300px] w-full" />
            </div>
          </div>
        </div>
      )
  }

  if (error) {
    // If it's a 404 from the real API
    if ((error as { status?: number }).status === 404) {
      notFound()
    }
    return (
        <div className="flex flex-col items-center py-32 text-muted-foreground">
          <AlertCircle className="w-8 h-8 text-destructive mb-4" />
          <p className="text-[14px] font-medium text-foreground">Failed to load requirement</p>
          <p className="text-[12px]">{error.message}</p>
        </div>
      )
  }

  if (!req) return null;

  const history = [...req.revisions].sort((a, b) => b.versionNumber - a.versionNumber)
  const latestRev = history[0]
  const isReady = latestRev.readinessStatus === "READY_FOR_ANALYSIS"

  return (
      <div className="app-page-scroll">
        <div className="max-w-4xl mx-auto w-full flex flex-col gap-8 py-4 pb-20">
        <BackButton href="/requirements" label="Back to Requirements" className="mb-0" />

        <WorkspacePageHeader
          title={latestRev.title}
          description={`Requirement ID: ${req.id}`}
          className="mb-0"
        >
          <div className="flex items-center gap-2">
            {/* <NewRequirementDialog existingRequirement={req}>
              <Button variant="outline" size="sm" className="h-8 shadow-none gap-1.5 bg-surface">
                <Edit3 className="w-3.5 h-3.5" /> Edit Request
              </Button>
            </NewRequirementDialog> */}
            <NewAnalysisDialog preselectedReqId={req.id}>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger render={<span className="inline-block" />}>
                    <Button size="sm" className="h-8 shadow-none gap-1.5 pointer-events-auto" disabled={!isReady || !canRun}>
                      <Play className="w-3.5 h-3.5" /> Run Analysis
                    </Button>
                  </TooltipTrigger>
                  {(!isReady || !canRun) && (
                    <TooltipContent>
                      {!isReady ? "Requirement is not ready for analysis. Wait for processing to complete." : "Only analysts and admins can start analyses."}
                    </TooltipContent>
                  )}
                </Tooltip>
              </TooltipProvider>
            </NewAnalysisDialog>
          </div>
        </WorkspacePageHeader>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
          
          {/* Main Column - Current Revision */}
          <div className="md:col-span-2 flex flex-col gap-6">
            <div className="flex flex-col gap-4 rounded-xl border border-border/60 bg-surface shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-border/60 flex items-center justify-between bg-surface-muted/30">
                <div className="flex items-center gap-3">
                  <h2 className="text-[14px] font-semibold text-foreground">Current Revision</h2>
                  <span className="text-[10px] font-semibold bg-primary/10 text-primary px-2 py-0.5 rounded-full border border-primary/20">
                    v{latestRev.versionNumber}
                  </span>
                </div>
                <ReadinessStatusBadge status={latestRev.readinessStatus} />
              </div>
              
              <div className="px-5 py-2">
                <div className="text-[13px] text-foreground/80 font-mono leading-relaxed whitespace-pre-wrap">
                  {latestRev.rawText}
                </div>
              </div>

              {latestRev.validationIssues.length > 0 && (
                <div className="px-5 py-4 bg-destructive/5 border-t border-destructive/10">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertCircle className="w-4 h-4 text-destructive" />
                    <h3 className="text-[12px] font-semibold text-destructive">Validation Issues</h3>
                  </div>
                  <ul className="flex flex-col gap-1.5 pl-6">
                    {latestRev.validationIssues.map((issue: string, i: number) => (
                      <li key={i} className="text-[12px] text-destructive/80 list-disc">{issue}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="px-5 py-3 border-t border-border/60 bg-surface-muted/20 flex items-center justify-between text-[11px] text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5" />
                  <span>Revision ID: {latestRev.id}</span>
                </div>
                <span>Created on {new Date(latestRev.createdAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
              </div>
            </div>
          </div>

          {/* Sidebar Column - Revision History */}
          <div className="md:col-span-1 flex flex-col gap-4">
            <h3 className="text-[13px] font-semibold text-foreground flex items-center gap-2">
              <Clock className="w-4 h-4 text-muted-foreground" />
              Revision History
            </h3>
            
            <div className="flex flex-col">
              {history.map((rev, index) => {
                const isCurrent = index === 0
                return (
                  <div key={rev.id} className="relative flex gap-4 pb-6 last:pb-0">
                    {/* Timeline Line */}
                    {index !== history.length - 1 && (
                      <div className="absolute left-3.5 top-7 bottom-0 w-px bg-border"></div>
                    )}
                    
                    {/* Timeline Node */}
                    <div className="relative z-10 flex flex-col items-center mt-1">
                      <div className={`w-7 h-7 rounded-full border-2 flex items-center justify-center shrink-0 ${
                        isCurrent 
                          ? "bg-surface border-primary text-primary" 
                          : "bg-surface-muted border-border text-muted-foreground"
                      }`}>
                        {isCurrent ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Archive className="w-3 h-3" />}
                      </div>
                    </div>
                    
                    {/* Timeline Content */}
                    <div className={`flex flex-col gap-1 pt-1.5 ${!isCurrent && "opacity-70"}`}>
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-semibold text-foreground">v{rev.versionNumber}</span>
                        {isCurrent && (
                          <span className="text-[9px] font-bold uppercase tracking-wider text-primary bg-primary/10 px-1.5 py-0.5 rounded">Current</span>
                        )}
                      </div>
                      <span className="text-[11px] text-muted-foreground">
                        {new Date(rev.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </span>
                      <div className="mt-1">
                        <ReadinessStatusBadge status={rev.readinessStatus} />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
          
        </div>
        </div>
      </div>
    )
}
