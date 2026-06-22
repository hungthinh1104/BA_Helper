import { ReactNode } from "react"
import { cn } from "@/lib/utils"
import Link from "next/link"

export function DataList({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col border border-border/60 rounded-xl bg-surface shadow-sm relative", className)}>
      {children}
    </div>
  )
}

export function DataListHeader({ 
  children, 
  className, 
  gridCols 
}: { 
  children: ReactNode; 
  className?: string;
  gridCols: string;
}) {
  return (
    <div 
      className={cn("grid items-center gap-4 px-6 py-3 bg-surface-muted/30 text-xs font-medium uppercase text-muted-foreground border-b border-border max-sm:hidden", className)}
      style={{ gridTemplateColumns: gridCols }}
    >
      {children}
    </div>
  )
}

export function DataListRow({ 
  children, 
  className, 
  gridCols,
  href
}: { 
  children: ReactNode; 
  className?: string;
  gridCols: string;
  href?: string;
}) {
  if (href) {
    return (
      <Link 
        href={href}
        className={cn(
          "grid items-center gap-4 px-6 py-3 transition-colors group relative border-b border-border last:border-0 hover:bg-surface-soft/80 cursor-pointer max-sm:flex max-sm:flex-col max-sm:items-start max-sm:gap-2 max-sm:px-4 max-sm:py-4",
          className
        )}
        style={{ gridTemplateColumns: gridCols }}
      >
        {children}
      </Link>
    )
  }

  return (
    <div 
      className={cn(
        "grid items-center gap-4 px-6 py-3 transition-colors group relative border-b border-border last:border-0 hover:bg-surface-soft/40 max-sm:flex max-sm:flex-col max-sm:items-start max-sm:gap-2 max-sm:px-4 max-sm:py-4",
        className
      )}
      style={{ gridTemplateColumns: gridCols }}
    >
      {children}
    </div>
  )
}

export function DataListCell({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("min-w-0", className)}>{children}</div>
}
