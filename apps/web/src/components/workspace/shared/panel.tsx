import { ReactNode } from "react"
import { cn } from "@/lib/utils"

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
