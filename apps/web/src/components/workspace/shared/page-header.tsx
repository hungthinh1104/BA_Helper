import { ReactNode } from "react"
import { cn } from "@/lib/utils"

interface PageHeaderProps {
  title: string
  description?: ReactNode
  children?: ReactNode
  className?: string
}

export function WorkspacePageHeader({ title, description, children, className }: PageHeaderProps) {
  return (
    <div className={cn("flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8", className)}>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
        {description && (
          <div className="mt-1.5 text-sm leading-6 text-muted-foreground">{description}</div>
        )}
      </div>
      {children && (
        <div className="flex flex-wrap items-center gap-3 max-sm:w-full">
          {children}
        </div>
      )}
    </div>
  )
}
