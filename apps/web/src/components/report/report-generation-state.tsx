"use client"

import { AlertCircle, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useTranslations } from "next-intl"

export function ReportGenerationState({
  state,
  retryEnabled = false,
  retryPending = false,
  retryFailed = false,
  onRetry,
}: {
  state: "pending" | "failed"
  retryEnabled?: boolean
  retryPending?: boolean
  retryFailed?: boolean
  onRetry?: () => void
}) {
  const t = useTranslations("reports")

  if (state === "pending") {
    return (
      <div role="status" className="m-8 flex flex-col items-center justify-center rounded-xl border border-border/60 bg-surface px-8 py-12 text-muted-foreground">
        <Loader2 aria-hidden="true" className="mb-3 h-8 w-8 animate-spin text-primary" />
        <p className="font-medium text-foreground">{t("reportGenerationPending")}</p>
      </div>
    )
  }

  return (
    <div role="alert" className="m-8 flex flex-col items-center justify-center rounded-xl border border-border/60 bg-surface px-8 py-12 text-muted-foreground">
      <AlertCircle aria-hidden="true" className="mb-3 h-8 w-8 text-destructive" />
      <p className="font-medium text-foreground">{t("reportGenerationFailed")}</p>
      <p className="max-w-md text-center text-[13px]">{t("reportGenerationFailedDescription")}</p>
      {retryEnabled ? (
        <div className="mt-4 flex flex-col items-center gap-2">
          {retryFailed ? <p role="status">{t("reportRetryFailed")}</p> : null}
          <Button onClick={onRetry} disabled={retryPending}>
            {retryPending ? <Loader2 aria-hidden="true" className="mr-2 h-4 w-4 animate-spin" /> : null}
            {t(retryPending ? "retryingReportGeneration" : "retryReportGeneration")}
          </Button>
        </div>
      ) : null}
    </div>
  )
}
