"use client"

import { useEffect } from "react"
import { Button } from "@/components/ui/button"
import { AlertTriangle } from "lucide-react"

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

  return (
    <div className="app-page-scroll flex items-center justify-center min-h-[50vh]">
      <div className="flex flex-col items-center text-center gap-4 max-w-sm">
        <div className="w-10 h-10 rounded-lg bg-danger/10 border border-danger/25 flex items-center justify-center">
          <AlertTriangle className="w-5 h-5 text-danger" />
        </div>
        <div>
          <p className="text-[14px] font-semibold text-foreground mb-1">Something went wrong</p>
          {error.message && (
            <p className="text-[12px] font-mono text-muted-foreground/70 bg-surface-muted px-2 py-1 rounded border border-border/50">
              {error.message}
            </p>
          )}
          {error.digest && (
            <p className="text-[11px] text-muted-foreground/40 mt-1">digest: {error.digest}</p>
          )}
        </div>
        <Button size="sm" variant="outline" className="h-8 shadow-none" onClick={reset}>
          Try again
        </Button>
      </div>
    </div>
  )
}
