"use client"

import { useEffect } from "react"
import { Button } from "@/components/ui/button"
import { AlertTriangle, ServerCrash } from "lucide-react"

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // TODO: forward to error monitoring (e.g. Sentry) when infra is ready
    console.error("[AppError]", error)
  }, [error])

  const isContractError = error.name === 'ApiContractError' || error.message?.includes('Zod') || error.message?.includes('Validation error')

  return (
    <div className="app-page-scroll flex items-center justify-center min-h-[50vh]">
      <div className="flex flex-col items-center text-center gap-4 max-w-sm">
        <div className={`w-10 h-10 rounded-lg border flex items-center justify-center ${isContractError ? 'bg-warning/10 border-warning/25' : 'bg-danger/10 border-danger/25'}`}>
          {isContractError ? (
            <ServerCrash className="w-5 h-5 text-warning" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-danger" />
          )}
        </div>
        <div>
          <p className="text-[14px] font-semibold text-foreground mb-1">
            {isContractError ? "Data Contract Mismatch" : "Something went wrong"}
          </p>
          <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
            {isContractError 
              ? "The backend returned data that violates the expected schema. This is usually caused by an outdated frontend or a backend contract change."
              : "An unexpected error occurred while rendering this page."}
          </p>
          {error.message && (
            <p className="text-[12px] font-mono text-muted-foreground/70 bg-surface-muted px-2 py-1.5 rounded border border-border/50 text-left break-words overflow-auto max-h-[150px]">
              {error.message}
            </p>
          )}
          {error.digest && (
            <p className="text-[11px] text-muted-foreground/40 mt-2">digest: {error.digest}</p>
          )}
        </div>
        <Button size="sm" variant="outline" className="h-8 shadow-none mt-2" onClick={reset}>
          Try again
        </Button>
      </div>
    </div>
  )
}
