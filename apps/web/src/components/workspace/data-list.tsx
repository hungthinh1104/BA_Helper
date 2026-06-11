import { ReactNode } from "react"
import { cn } from "@/lib/utils"
import Link from "next/link"

export function DataList({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col border border-border/40 rounded-xl overflow-hidden bg-surface/50 backdrop-blur-xl shadow-lg ring-1 ring-black/5 dark:ring-white/5", className)}>
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
      className={cn("grid items-center gap-4 px-6 py-3 bg-surface-muted/30 text-[11px] font-medium tracking-wider uppercase text-muted-foreground border-b border-border/60", className)}
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
          "grid items-center gap-4 px-6 py-4 transition-colors group relative border-b border-border/40 last:border-0 hover:bg-surface-soft/80 cursor-pointer", 
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
        "grid items-center gap-4 px-6 py-4 transition-colors group relative border-b border-border/40 last:border-0 hover:bg-surface-soft/40", 
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
