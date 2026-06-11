import React from "react"
import { AlertCircle, FileText, CheckCircle2, AlertTriangle, HelpCircle } from "lucide-react"
import { MatrixRowDetailResponse } from "@ba-helper/contracts"
import { useMatrixRowDetail } from "@/hooks/api/use-analyses"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { MatrixArtifactDetailCard } from "./matrix-artifact-detail-card"

interface MatrixRowDetailDrawerProps {
  runId: string
  analysisId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

const CERTAINTY_COLORS: Record<string, string> = {
  EVIDENCED: "bg-success/10 text-success border-success/20",
  INFERRED: "bg-warning/10 text-warning border-warning/20",
  UNKNOWN: "bg-destructive/10 text-destructive border-destructive/20",
  CONFLICTING: "bg-destructive/10 text-destructive border-destructive/20",
}

const STATUS_ICONS: Record<string, React.ReactNode> = {
  ACCEPTED: <CheckCircle2 className="w-4 h-4 text-success" />,
  REJECTED: <AlertTriangle className="w-4 h-4 text-destructive" />,
  NEEDS_MORE_CLARIFICATION: <HelpCircle className="w-4 h-4 text-warning" />,
}

export function MatrixRowDetailDrawer({
  runId,
  analysisId,
  open,
  onOpenChange,
}: MatrixRowDetailDrawerProps) {
  const { data, isLoading, error } = useMatrixRowDetail(runId, analysisId)

  // Drawer should ideally be 60-70% width on desktop. In Tailwind, we can override max-w.
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl md:max-w-3xl lg:max-w-4xl p-0 flex flex-col h-full bg-background border-l">
        {isLoading && (
          <div className="flex flex-col h-full p-6 space-y-6">
            <div className="space-y-2">
              <Skeleton className="h-6 w-1/3" />
              <Skeleton className="h-4 w-1/4" />
            </div>
            <div className="space-y-4 pt-4">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          </div>
        )}

        {error && !isLoading && (
          <div className="flex flex-col items-center justify-center h-full p-6 text-center">
            <AlertCircle className="w-8 h-8 text-destructive mb-4" />
            {(error as any)?.status === 404 ? (
              <p className="text-[14px] font-medium text-foreground">
                This analysis is not available for the selected run.
              </p>
            ) : (error as any)?.status === 403 ? (
              <p className="text-[14px] font-medium text-foreground">
                You do not have permission to view this analysis.
              </p>
            ) : (
              <p className="text-[14px] font-medium text-foreground">
                Unable to load matrix row details.
              </p>
            )}
          </div>
        )}

        {data && !isLoading && !error && (
          <div className="flex flex-col h-full">
            <SheetHeader className="px-6 py-4 border-b shrink-0 bg-surface">
              <div className="flex items-start justify-between">
                <div className="flex flex-col gap-1.5">
                  <SheetTitle className="flex items-center gap-2 text-lg">
                    {data.repository}
                    {data.reviewState.latestDecision && (
                      <span className="flex items-center ml-2" title={data.reviewState.latestDecision}>
                        {STATUS_ICONS[data.reviewState.latestDecision]}
                      </span>
                    )}
                  </SheetTitle>
                  <SheetDescription className="flex items-center gap-2">
                    {data.domain && <Badge variant="outline" className="text-[10px] font-mono">{data.domain}</Badge>}
                  </SheetDescription>
                </div>
              </div>

              <div className="flex items-center gap-4 mt-4 text-[12px]">
                <div className="flex flex-col">
                  <span className="text-muted-foreground uppercase tracking-wide text-[10px]">Coverage</span>
                  <span className="font-medium text-foreground">
                    {data.evidenceSummary.coveredArtifacts} / {data.impactedArtifacts.length} artifacts
                  </span>
                </div>
                <Separator orientation="vertical" className="h-8" />
                <div className="flex flex-col">
                  <span className="text-muted-foreground uppercase tracking-wide text-[10px]">Total Evidence</span>
                  <span className="font-medium text-foreground">{data.evidenceSummary.totalEvidenceItems}</span>
                </div>
                <Separator orientation="vertical" className="h-8" />
                <div className="flex flex-col">
                  <span className="text-muted-foreground uppercase tracking-wide text-[10px]">Uncovered</span>
                  <span className={`font-medium ${data.evidenceSummary.uncoveredArtifacts > 0 ? 'text-destructive' : 'text-foreground'}`}>
                    {data.evidenceSummary.uncoveredArtifacts}
                  </span>
                </div>
              </div>
            </SheetHeader>

            <Tabs defaultValue="artifacts" className="flex flex-col flex-1 min-h-0">
              <div className="px-6 border-b shrink-0 bg-surface">
                <TabsList className="bg-transparent space-x-2 -mb-px">
                  <TabsTrigger
                    value="artifacts"
                    className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:shadow-none bg-transparent"
                  >
                    Artifacts ({data.impactedArtifacts.length})
                  </TabsTrigger>
                  <TabsTrigger
                    value="risks"
                    className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:shadow-none bg-transparent"
                  >
                    Risks ({data.risks.length})
                  </TabsTrigger>
                  <TabsTrigger
                    value="qa"
                    className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:shadow-none bg-transparent"
                  >
                    QA Scenarios ({data.qaScenarios.length})
                  </TabsTrigger>
                  <TabsTrigger
                    value="diagnostics"
                    className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:shadow-none bg-transparent"
                  >
                    Diagnostics
                  </TabsTrigger>
                </TabsList>
              </div>

              <ScrollArea className="flex-1 bg-background/50">
                <div className="p-6">
                  <TabsContent value="artifacts" className="mt-0">
                    {data.impactedArtifacts.length === 0 ? (
                      <div className="text-center py-10 text-muted-foreground text-sm">
                        No impacted artifacts were found for this matrix row.
                      </div>
                    ) : (
                      <div className="flex flex-col space-y-1">
                        {data.impactedArtifacts.map((artifact) => (
                          <MatrixArtifactDetailCard
                            key={artifact.artifactId}
                            artifact={artifact}
                            risks={data.risks}
                            qaScenarios={data.qaScenarios}
                          />
                        ))}
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="risks" className="mt-0 space-y-3">
                    {data.risks.length === 0 ? (
                      <div className="text-center py-10 text-muted-foreground text-sm">
                        No risks found for this repository.
                      </div>
                    ) : (
                      data.risks.map((risk) => (
                        <div key={risk.insightId} className="rounded border border-destructive/20 bg-destructive/5 p-4">
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <h4 className="text-[13px] font-medium text-foreground">{risk.title}</h4>
                            {risk.certainty && (
                              <Badge variant="outline" className={`text-[10px] uppercase ${CERTAINTY_COLORS[risk.certainty] || ""}`}>
                                {risk.certainty}
                              </Badge>
                            )}
                          </div>
                          {risk.description && (
                            <p className="text-[13px] text-muted-foreground leading-relaxed mb-3">
                              {risk.description}
                            </p>
                          )}
                          <div className="text-[11px] text-muted-foreground">
                            {risk.relatedEvidenceIds.length} evidence references
                          </div>
                        </div>
                      ))
                    )}
                  </TabsContent>

                  <TabsContent value="qa" className="mt-0 space-y-3">
                    {data.qaScenarios.length === 0 ? (
                      <div className="text-center py-10 text-muted-foreground text-sm">
                        No QA scenarios found for this repository.
                      </div>
                    ) : (
                      data.qaScenarios.map((qa) => (
                        <div key={qa.insightId} className="rounded border border-success/20 bg-success/5 p-4">
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <h4 className="text-[13px] font-medium text-foreground">{qa.title}</h4>
                            {qa.certainty && (
                              <Badge variant="outline" className={`text-[10px] uppercase ${CERTAINTY_COLORS[qa.certainty] || ""}`}>
                                {qa.certainty}
                              </Badge>
                            )}
                          </div>
                          {qa.description && (
                            <p className="text-[13px] text-muted-foreground leading-relaxed mb-3">
                              {qa.description}
                            </p>
                          )}
                          <div className="text-[11px] text-muted-foreground">
                            {qa.relatedEvidenceIds.length} evidence references
                          </div>
                        </div>
                      ))
                    )}
                  </TabsContent>

                  <TabsContent value="diagnostics" className="mt-0 space-y-4">
                    {data.impactedArtifacts.length === 0 ? (
                      <div className="text-center py-10 text-muted-foreground text-sm">
                        No diagnostics available.
                      </div>
                    ) : (
                      data.impactedArtifacts.map((artifact) => {
                        const diag = artifact.retrievalDiagnostics as Record<string, any> | undefined
                        if (!diag) return null

                        return (
                          <div key={artifact.artifactId} className="rounded-lg border bg-surface p-4">
                            <h4 className="text-[13px] font-medium mb-3 flex items-center gap-2">
                              <FileText className="w-3.5 h-3.5 text-muted-foreground" />
                              {artifact.displayName}
                            </h4>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                              {Object.entries(diag)
                                .filter(([k, v]) => typeof v === "number" || typeof v === "string")
                                .map(([k, v]) => (
                                  <div key={k} className="flex flex-col">
                                    <span className="text-[10px] uppercase tracking-wide text-muted-foreground mb-0.5">
                                      {k}
                                    </span>
                                    <span className="text-[12px] font-mono font-medium">
                                      {typeof v === "number" ? v.toFixed(3) : String(v)}
                                    </span>
                                  </div>
                                ))}
                            </div>
                          </div>
                        )
                      })
                    )}
                  </TabsContent>
                </div>
              </ScrollArea>
            </Tabs>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
