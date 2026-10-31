"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import { localizationKeys, useGenerateLocalizedReport, useLocalizationStatus } from "@/hooks/api/use-localization"
import type { LocalizationStatusResponse, SupportedReportLocale } from "@ba-helper/contracts"
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
  const t = useTranslations("workspace")
  const [selectedLocale, setSelectedLocale] = useState<SupportedReportLocale>("vi-VN")
  const generateLocalization = useGenerateLocalizedReport(analysisId)
  const {
    data: statusData,
    isError: hasStatusError,
    isFetching: isFetchingStatus,
    isLoading: isLoadingStatus,
    refetch: refetchStatus,
  } = useLocalizationStatus(analysisId, selectedLocale)
  const queryClient = useQueryClient()

  const handleGenerate = async () => {
    try {
      await generateLocalization.mutateAsync({ locale: selectedLocale })
      toast.success(t("localizationRequested", { locale: selectedLocale }))
      await queryClient.invalidateQueries({
        queryKey: localizationKeys.status(analysisId, selectedLocale),
      })
    } catch (error) {
      toast.error(t("localizationRequestFailed"), {
        description: error instanceof Error ? error.message : t("localizationUnknownError"),
      })
    }
  }

  if (!canExport) return null

  const status = statusData?.status
  const statusLabel: Record<LocalizationStatusResponse["status"], string> = {
    READY: t("localizationReady"),
    NOT_TRANSLATED: t("localizationNotTranslated"),
    QUEUED: t("localizationQueued"),
    FAILED: t("localizationFailed"),
    OUT_OF_SYNC: t("localizationOutOfSync"),
    SOURCE_NOT_READY: t("localizationSourceNotReady"),
  }
  const isUnavailable = hasStatusError && !statusData

  return (
    <div className="mt-4 rounded-md border border-border/50 bg-background/40 p-3">
      <div className="flex items-center justify-between mb-3">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {t("localizationTitle")}
        </div>
        <div
          role="status"
          aria-live="polite"
          className={`flex items-center text-[10px] font-medium uppercase ${status === "READY" ? "text-success" : status === "FAILED" ? "text-destructive" : status === "QUEUED" || status === "OUT_OF_SYNC" ? "text-warning" : "text-muted-foreground"}`}
        >
          {isLoadingStatus && !statusData ? (
            <Loader2 aria-hidden="true" className="h-3 w-3 animate-spin" />
          ) : status === "READY" ? (
            <CheckCircle2 aria-hidden="true" className="h-3 w-3 mr-1" />
          ) : status === "QUEUED" ? (
            <Loader2 aria-hidden="true" className="h-3 w-3 mr-1 animate-spin" />
          ) : status === "FAILED" ? (
            <XCircle aria-hidden="true" className="h-3 w-3 mr-1" />
          ) : status === "OUT_OF_SYNC" ? (
            <AlertCircle aria-hidden="true" className="h-3 w-3 mr-1" />
          ) : null}
          {status ? statusLabel[status] : isLoadingStatus ? t("loadingLocalizationStatus") : null}
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <label
          htmlFor={`localization-locale-${analysisId}`}
          className="text-xs text-muted-foreground"
        >
          {t("localizationLanguage")}
        </label>
        <select
          id={`localization-locale-${analysisId}`}
          value={selectedLocale}
          onChange={(e) => setSelectedLocale(e.target.value as SupportedReportLocale)}
          className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
        >
          <option value="vi-VN">{t("localizationVietnamese")} (vi-VN)</option>
          <option value="ja-JP">{t("localizationJapanese")} (ja-JP)</option>
        </select>

        {hasStatusError ? (
          <div className="flex flex-wrap items-center justify-between gap-2" role="alert">
            <p className="text-xs text-destructive">
              {statusData ? t("localizationStatusRefreshFailed") : t("localizationStatusUnavailable")}
            </p>
            <Button
              variant="outline"
              disabled={isFetchingStatus}
              onClick={() => void refetchStatus()}
            >
              {isFetchingStatus ? t("retryingLocalizationStatus") : t("retryLocalizationStatus")}
            </Button>
          </div>
        ) : null}

        <div className="flex gap-2 w-full">
          {status === "READY" ? (
            <>
              <Button
                variant="outline"
                className="flex-1"
                render={<Link href={`/reports?analysisId=${analysisId}&locale=${selectedLocale}`} />}
                nativeButton={false}
              >
                {t("localizationViewReport")}
              </Button>
              <Button 
                variant="secondary" 
                disabled={generateLocalization.isPending}
                onClick={handleGenerate}
                title={t("localizationRegenerate")}
                aria-label={t("localizationRegenerate")}
              >
                {generateLocalization.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
              </Button>
            </>
          ) : isUnavailable ? null : !statusData ? (
            <Button variant="secondary" className="w-full" disabled>
              <Loader2 aria-hidden="true" className="mr-2 h-4 w-4 animate-spin" />
              {t("loadingLocalizationStatus")}
            </Button>
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
              {status === "FAILED" ? t("localizationRetry") : status === "OUT_OF_SYNC" ? t("localizationRegenerate") : t("localizationTranslate")}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
