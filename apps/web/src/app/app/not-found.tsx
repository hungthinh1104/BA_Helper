import Link from "next/link"

export default function AppNotFound() {
  return (
    <div className="app-page-scroll flex items-center justify-center min-h-[50vh]">
      <div className="flex flex-col items-center text-center gap-4 max-w-sm">
        <div className="w-10 h-10 rounded-lg bg-surface border border-border/50 flex items-center justify-center">
          <span className="text-lg font-bold text-muted-foreground">404</span>
        </div>
        <div>
          <p className="text-[14px] font-semibold text-foreground mb-1">Page not found</p>
          <p className="text-[12px] text-muted-foreground">
            The page you&apos;re looking for doesn&apos;t exist or has been moved.
          </p>
        </div>
        <Link
          href="/app/analyses"
          className="inline-flex items-center h-8 px-3 text-[13px] font-medium rounded-md border border-border bg-transparent text-foreground hover:bg-surface-muted transition-colors"
        >
          Go to Analyses
        </Link>
      </div>
    </div>
  )
}
