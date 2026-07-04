import { ReactNode } from "react"
import { cn } from "@/lib/utils"
import Link from "next/link"
import { DenseCard } from "./dense-card"

export function DataList({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <DenseCard className={cn("relative shadow-sm", className)}>
      {children}
    </DenseCard>
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
          "grid items-center gap-4 px-6 py-3 transition-colors group relative border-b border-border last:border-0 hover:bg-surface-soft cursor-pointer max-sm:flex max-sm:flex-col max-sm:items-start max-sm:gap-2 max-sm:px-4 max-sm:py-4",
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
        "grid items-center gap-4 px-6 py-3 transition-colors group relative border-b border-border last:border-0 hover:bg-surface-soft max-sm:flex max-sm:flex-col max-sm:items-start max-sm:gap-2 max-sm:px-4 max-sm:py-4",
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
