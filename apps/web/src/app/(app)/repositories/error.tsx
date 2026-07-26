"use client"

import { useEffect } from "react"
import Link from "next/link"
import { useTranslations } from "next-intl"
import { AlertTriangle, ChevronLeft } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function RepositoriesError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const t = useTranslations("settings")
  useEffect(() => {
    console.error("[RepositoriesError]", error)
  }, [error])

  return (
    <div className="app-content flex items-center justify-center">
      <div className="flex flex-col items-center text-center gap-4 max-w-md">
        <div className="w-10 h-10 rounded-lg bg-danger/10 border border-danger/25 flex items-center justify-center">
          <AlertTriangle className="w-5 h-5 text-danger" />
        </div>
        <div>
          <p className="text-[14px] font-semibold text-foreground mb-1">{t("failedLoadRepositories")}</p>
          <p className="text-[12px] text-muted-foreground">
            {t("failedLoadRepositoriesDescription")}
          </p>
          {error.message && (
            <p className="text-[11px] font-mono text-muted-foreground/70 bg-surface-muted px-2 py-1 rounded border border-border/50 mt-2 break-all">
              {error.message}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/"
            className="inline-flex items-center gap-1 h-8 px-3 text-[13px] font-medium rounded-md border border-border bg-transparent text-foreground hover:bg-surface-muted transition-colors shadow-none"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            {t("workspace")}
          </Link>
          <Button size="sm" className="h-8 shadow-none" onClick={reset}>
            {t("retry")}
          </Button>
        </div>
      </div>
    </div>
  )
}
