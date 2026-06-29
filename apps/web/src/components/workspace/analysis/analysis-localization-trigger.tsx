"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { useGenerateLocalizedReport } from "@/hooks/api/use-localization"
import { SupportedReportLocale } from "@ba-helper/contracts"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"

export function AnalysisLocalizationTrigger({
  analysisId,
  canExport,
}: {
  analysisId: string
  canExport: boolean
}) {
  const [selectedLocale, setSelectedLocale] = useState<SupportedReportLocale>("vi-VN")
  const generateLocalization = useGenerateLocalizedReport(analysisId)

  const handleGenerate = async () => {
    try {
      await generateLocalization.mutateAsync({ locale: selectedLocale })
      toast.success(`Localized report generated for ${selectedLocale}`)
      // In MVP, we just notify success. Further UI could open a modal with the translated markdown.
    } catch (error) {
      toast.error("Failed to localize report", {
        description: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  if (!canExport) return null

  return (
    <div className="mt-4 rounded-md border border-border/50 bg-background/40 p-3">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-3">
        Localization
      </div>
      <div className="flex gap-2">
        <select
          value={selectedLocale}
          onChange={(e) => setSelectedLocale(e.target.value as SupportedReportLocale)}
          className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
        >
          <option value="vi-VN">Vietnamese (vi-VN)</option>
          <option value="ja-JP">Japanese (ja-JP)</option>
        </select>
        <Button 
          variant="secondary" 
          disabled={generateLocalization.isPending}
          onClick={handleGenerate}
        >
          {generateLocalization.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : null}
          Translate
        </Button>
      </div>
    </div>
  )
}
