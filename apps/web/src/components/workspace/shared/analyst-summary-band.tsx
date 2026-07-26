import type { ReactNode } from "react"

interface AnalystSummaryItem {
  label: string
  value: string | number
  description?: string
  icon?: ReactNode
}

interface AnalystSummaryBandProps {
  title: string
  description: string
  items: AnalystSummaryItem[]
}

export function AnalystSummaryBand({
  title,
  description,
  items,
}: AnalystSummaryBandProps) {
  return (
    <section className="mb-5 rounded-xl border border-border/60 bg-surface shadow-sm">
      <div className="border-b border-border/60 px-5 py-4">
        <h2 className="text-[14px] font-semibold text-foreground">{title}</h2>
        <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
          {description}
        </p>
      </div>
      <div className="grid gap-px bg-border/50 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((item) => (
          <div key={item.label} className="bg-surface px-5 py-4">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {item.label}
              </span>
              {item.icon ? (
                <span className="text-muted-foreground">{item.icon}</span>
              ) : null}
            </div>
            <div className="mt-2 text-2xl font-semibold tabular-nums text-foreground">
              {item.value}
            </div>
            {item.description ? (
              <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                {item.description}
              </p>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  )
}
