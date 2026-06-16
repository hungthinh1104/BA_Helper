import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

export function PageShell({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div className="app-page-scroll">
      <div className={cn("mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-4 pb-16", className)}>
        {children}
      </div>
    </div>
  )
}

export function SectionHeader({
  title,
  description,
  action,
  className,
}: {
  title: string
  description?: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={cn("flex items-start justify-between gap-4", className)}>
      <div className="min-w-0 space-y-1">
        <h2 className="text-base font-semibold tracking-tight text-foreground">{title}</h2>
        {description ? (
          <div className="text-sm leading-6 text-muted-foreground">{description}</div>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  )
}

export function DataCard({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn("overflow-hidden rounded-xl border border-border/60 bg-surface shadow-sm", className)}>
      {children}
    </div>
  )
}

export function EmptyState({
  title,
  description,
  icon,
  action,
  className,
}: {
  title: string
  description: ReactNode
  icon?: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center px-6 py-12 text-center",
        className,
      )}
    >
      {icon ? (
        <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl border border-border/60 bg-surface-muted text-muted-foreground">
          {icon}
        </div>
      ) : null}
      <div className="space-y-1.5">
        <p className="text-sm font-medium text-foreground">{title}</p>
        <div className="max-w-md text-sm leading-6 text-muted-foreground">{description}</div>
      </div>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  )
}

export function MetricCard({
  label,
  value,
  detail,
  accent,
  icon,
  className,
}: {
  label: string
  value: ReactNode
  detail?: ReactNode
  accent?: "default" | "success" | "warning" | "danger" | "info"
  icon?: ReactNode
  className?: string
}) {
  const accentClass =
    accent === "success"
      ? "border-success/30 bg-success/5"
      : accent === "warning"
        ? "border-warning/30 bg-warning/5"
        : accent === "danger"
          ? "border-danger/30 bg-danger/5"
          : accent === "info"
            ? "border-info/30 bg-info/5"
            : "border-border/60 bg-surface"

  return (
    <div className={cn("rounded-xl border p-4 shadow-sm", accentClass, className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
          <div className="text-xl font-semibold tracking-tight text-foreground">{value}</div>
        </div>
        {icon ? (
          <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-border/60 bg-surface-muted text-muted-foreground">
            {icon}
          </div>
        ) : null}
      </div>
      {detail ? <div className="mt-3 text-sm leading-6 text-muted-foreground">{detail}</div> : null}
    </div>
  )
}

export function ActionPanel({
  title,
  description,
  action,
  className,
}: {
  title: string
  description: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={cn("rounded-xl border border-primary/20 bg-primary/5 p-5", className)}>
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1.5">
          <p className="text-base font-semibold tracking-tight text-foreground">{title}</p>
          <div className="max-w-2xl text-sm leading-6 text-muted-foreground">{description}</div>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
    </div>
  )
}
