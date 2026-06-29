"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { useGenerateLocalizedReport, useLocalizationStatus } from "@/hooks/api/use-localization"
import { SupportedReportLocale } from "@ba-helper/contracts"
import { toast } from "sonner"
import { Loader2, CheckCircle2, XCircle, RefreshCw, AlertCircle } from "lucide-react"
import Link from "next/link"
import { useQueryClient } from "@tanstack/react-query"

export function AnalysisLocalizationTrigger({
  analysisId,
  canExport,
}: {
  analysisId: string
  canExport: boolean
}) {
  const [selectedLocale, setSelectedLocale] = useState<SupportedReportLocale>("vi-VN")
  const generateLocalization = useGenerateLocalizedReport(analysisId)
  const { data: statusData, isLoading: isLoadingStatus } = useLocalizationStatus(analysisId, selectedLocale)
  const queryClient = useQueryClient()

  const handleGenerate = async () => {
    try {
      await generateLocalization.mutateAsync({ locale: selectedLocale })
      toast.success(`Localization requested for ${selectedLocale}`)
      queryClient.invalidateQueries({ queryKey: ["localization", analysisId, "status", selectedLocale] })
    } catch (error) {
      toast.error("Failed to request localization", {
        description: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  if (!canExport) return null

  const status = statusData?.status ?? "SOURCE_NOT_READY"

  return (
    <div className="mt-4 rounded-md border border-border/50 bg-background/40 p-3">
      <div className="flex items-center justify-between mb-3">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Localization
        </div>
        {isLoadingStatus ? (
          <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
        ) : status === "READY" ? (
          <div className="flex items-center text-[10px] text-success font-medium uppercase">
            <CheckCircle2 className="h-3 w-3 mr-1" /> Ready
          </div>
        ) : status === "QUEUED" ? (
          <div className="flex items-center text-[10px] text-warning font-medium uppercase">
            <Loader2 className="h-3 w-3 mr-1 animate-spin" /> Queued
          </div>
        ) : status === "FAILED" ? (
          <div className="flex items-center text-[10px] text-destructive font-medium uppercase">
            <XCircle className="h-3 w-3 mr-1" /> Failed
          </div>
        ) : status === "OUT_OF_SYNC" ? (
          <div className="flex items-center text-[10px] text-warning font-medium uppercase">
            <AlertCircle className="h-3 w-3 mr-1" /> Out of sync
          </div>
        ) : (
          <div className="flex items-center text-[10px] text-muted-foreground font-medium uppercase">
            Not translated
          </div>
        )}
      </div>
      <div className="flex flex-col gap-2">
        <select
          value={selectedLocale}
          onChange={(e) => setSelectedLocale(e.target.value as SupportedReportLocale)}
          className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
        >
          <option value="vi-VN">Vietnamese (vi-VN)</option>
          <option value="ja-JP">Japanese (ja-JP)</option>
        </select>
        
        <div className="flex gap-2 w-full">
          {status === "READY" ? (
            <>
              <Button 
                variant="outline" 
                className="flex-1"
                asChild
              >
                <Link href={`/reports?analysisId=${analysisId}&locale=${selectedLocale}`}>
                  View Report
                </Link>
              </Button>
              <Button 
                variant="secondary" 
                disabled={generateLocalization.isPending}
                onClick={handleGenerate}
                title="Regenerate"
              >
                {generateLocalization.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
              </Button>
            </>
          ) : (
            <Button 
              variant="secondary" 
              className="w-full"
              disabled={generateLocalization.isPending || status === "SOURCE_NOT_READY" || status === "QUEUED"}
              onClick={handleGenerate}
            >
              {generateLocalization.isPending || status === "QUEUED" ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              {status === "FAILED" ? "Retry" : status === "OUT_OF_SYNC" ? "Regenerate Translation" : "Translate"}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
