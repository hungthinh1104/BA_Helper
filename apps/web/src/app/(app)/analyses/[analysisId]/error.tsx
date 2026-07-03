"use client"

import { useEffect } from "react"
import { Button } from "@/components/ui/button"
import { useTranslations } from "next-intl"
import { AlertTriangle, ChevronLeft } from "lucide-react"
import Link from "next/link"

export default function AnalysisError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const t = useTranslations("settings")
  useEffect(() => {
    console.error("[AnalysisError]", error)
  }, [error])

  return (
    <div className="app-content flex items-center justify-center">
      <div className="flex flex-col items-center text-center gap-4 max-w-sm">
        <div className="w-10 h-10 rounded-lg bg-danger/10 border border-danger/25 flex items-center justify-center">
          <AlertTriangle className="w-5 h-5 text-danger" />
        </div>
        <div>
          <p className="text-[14px] font-semibold text-foreground mb-1">{t("failedLoadAnalysis")}</p>
          <p className="text-[12px] text-muted-foreground">
            {t("failedLoadAnalysisDescription")}
          </p>
          {error.digest && (
            <p className="text-[11px] text-muted-foreground/40 mt-1">digest: {error.digest}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
        <Link
          href="/analyses"
          className="inline-flex items-center gap-1 h-8 px-3 text-[13px] font-medium rounded-md border border-border bg-transparent text-foreground hover:bg-surface-muted transition-colors shadow-none"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          {t("allAnalyses")}
        </Link>
          <Button size="sm" className="h-8 shadow-none" onClick={reset}>
            {t("retry")}
          </Button>
        </div>
      </div>
    </div>
  )
}
