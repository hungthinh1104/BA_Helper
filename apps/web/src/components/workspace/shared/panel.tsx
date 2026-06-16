import { ReactNode } from "react"
import { cn } from "@/lib/utils"

export function WorkspacePanel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col border border-border/60 rounded-xl bg-surface shadow-sm overflow-hidden", className)}>
      {children}
    </div>
  )
}

export function WorkspacePanelSection({ 
  title, 
  description, 
  children, 
  className,
  isLast = false
}: { 
  title: string; 
  description?: string; 
  children: ReactNode; 
  className?: string;
  isLast?: boolean;
}) {
  return (
    <>
      <div className={cn("p-6 sm:p-8", className)}>
        <div className="mb-8">
          <h2 className="text-sm font-semibold text-foreground tracking-tight">{title}</h2>
          {description && <p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p>}
        </div>
        <div className="flex flex-col gap-6">
          {children}
        </div>
      </div>
      {!isLast && <div className="h-px bg-border/50 w-full" />}
    </>
  )
}

export function WorkspaceProperty({ 
  label, 
  description, 
  children, 
  className 
}: { 
  label: string; 
  description?: string; 
  children: ReactNode; 
  className?: string;
}) {
  return (
    <div className={cn("grid grid-cols-1 sm:grid-cols-[240px_1fr] items-start sm:items-center gap-4 sm:gap-8", className)}>
      <div>
        <label className="block text-sm font-medium text-foreground/90">{label}</label>
        {description && <span className="mt-1.5 block text-sm leading-6 text-muted-foreground">{description}</span>}
      </div>
      <div className="flex items-center min-w-0">
        {children}
      </div>
    </div>
  )
}
