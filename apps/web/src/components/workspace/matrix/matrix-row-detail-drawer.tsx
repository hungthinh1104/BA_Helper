import React from "react"
import { useTranslations } from "next-intl"
import { AlertCircle, CheckCircle2, AlertTriangle, HelpCircle } from "lucide-react"
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
import { MatrixInsightList } from "./matrix-insight-list"
import { MatrixDiagnosticsPanel } from "./matrix-diagnostics-panel"

interface MatrixRowDetailDrawerProps {
  runId: string
  analysisId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
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
  const t = useTranslations("workspace")
  const { data, isLoading, error } = useMatrixRowDetail(runId, analysisId)

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
            {(error as { status?: number })?.status === 404 ? (
              <p className="text-[14px] font-medium text-foreground">
                {t("analysisUnavailableForRun")}
              </p>
            ) : (error as { status?: number })?.status === 403 ? (
              <p className="text-[14px] font-medium text-foreground">
                {t("noPermissionViewAnalysis")}
              </p>
            ) : (
              <p className="text-[14px] font-medium text-foreground">
                {t("unableLoadMatrixRowDetails")}
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
                  <span className="text-muted-foreground uppercase tracking-wide text-[10px]">{t("coverage")}</span>
                  <span className="font-medium text-foreground">
                    {t("artifactsCoverage", {
                      covered: data.evidenceSummary.coveredArtifacts,
                      total: data.impactedArtifacts.length,
                    })}
                  </span>
                </div>
                <Separator orientation="vertical" className="h-8" />
                <div className="flex flex-col">
                  <span className="text-muted-foreground uppercase tracking-wide text-[10px]">{t("totalEvidence")}</span>
                  <span className="font-medium text-foreground">{data.evidenceSummary.totalEvidenceItems}</span>
                </div>
                <Separator orientation="vertical" className="h-8" />
                <div className="flex flex-col">
                  <span className="text-muted-foreground uppercase tracking-wide text-[10px]">{t("uncovered")}</span>
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
                    {t("artifactsWithCount", { count: data.impactedArtifacts.length })}
                  </TabsTrigger>
                  <TabsTrigger
                    value="risks"
                    className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:shadow-none bg-transparent"
                  >
                    {t("risksWithCount", { count: data.risks.length })}
                  </TabsTrigger>
                  <TabsTrigger
                    value="qa"
                    className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:shadow-none bg-transparent"
                  >
                    {t("qaScenariosWithCount", { count: data.qaScenarios.length })}
                  </TabsTrigger>
                  <TabsTrigger
                    value="diagnostics"
                    className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:shadow-none bg-transparent"
                  >
                    {t("diagnostics")}
                  </TabsTrigger>
                </TabsList>
              </div>

              <ScrollArea className="flex-1 bg-background/50">
                <div className="p-6">
                  <TabsContent value="artifacts" className="mt-0">
                    {data.impactedArtifacts.length === 0 ? (
                      <div className="text-center py-10 text-muted-foreground text-sm">
                        {t("noImpactedArtifactsForMatrixRow")}
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
                    <MatrixInsightList 
                      insights={data.risks} 
                      type="risk" 
                      emptyMessage={t("noRisksForRepository")} 
                    />
                  </TabsContent>

                  <TabsContent value="qa" className="mt-0 space-y-3">
                    <MatrixInsightList 
                      insights={data.qaScenarios} 
                      type="qa" 
                      emptyMessage={t("noQaScenariosForRepository")} 
                    />
                  </TabsContent>

                  <TabsContent value="diagnostics" className="mt-0 space-y-4">
                    <MatrixDiagnosticsPanel artifacts={data.impactedArtifacts} />
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
