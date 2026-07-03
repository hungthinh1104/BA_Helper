
import { useTranslations } from "next-intl"

export type InsightFilterValue = "ALL" | "EVIDENCED" | "INFERRED" | "UNKNOWN" | "CONFLICTING" | "NEEDS_REVIEW"

interface InsightFilterBarProps {
  currentFilter: InsightFilterValue
  onFilterChange: (filter: InsightFilterValue) => void
  counts: Record<InsightFilterValue, number>
  totalVisible?: number
}

export function InsightFilterBar({ currentFilter, onFilterChange, counts, totalVisible }: InsightFilterBarProps) {
  const t = useTranslations("workspace")
  const filters: { value: InsightFilterValue; label: string; activeClass: string }[] = [
    { value: "ALL", label: t("all"), activeClass: "bg-foreground text-background border-foreground" },
    { value: "NEEDS_REVIEW", label: t("needsReview"), activeClass: "bg-warning/15 text-warning border-warning/40" },
    { value: "EVIDENCED", label: t("evidenced"), activeClass: "bg-info/15 text-info border-info/40" },
    { value: "INFERRED", label: t("inferred"), activeClass: "bg-primary/15 text-primary border-primary/40" },
    { value: "UNKNOWN", label: t("unknown"), activeClass: "bg-surface-muted text-muted-foreground border-border" },
    { value: "CONFLICTING", label: t("conflicting"), activeClass: "bg-danger/15 text-danger border-danger/40" }
  ]

  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
      {filters.map(f => (
        <button
          key={f.value}
          onClick={() => onFilterChange(f.value)}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-[11px] font-medium whitespace-nowrap transition-all ${
            currentFilter === f.value
              ? f.activeClass
              : "bg-transparent hover:bg-surface-soft border-border/60 text-muted-foreground hover:text-foreground"
          }`}
        >
          {f.label}
          <span className={`px-1.5 rounded text-[10px] font-semibold ${
            currentFilter === f.value ? "opacity-70" : "bg-surface-muted text-muted-foreground"
          }`}>
            {counts[f.value] ?? 0}
          </span>
        </button>
      ))}
      {currentFilter !== "ALL" && totalVisible !== undefined && (
        <span className="text-[11px] text-muted-foreground ml-2 whitespace-nowrap">
          {t("resultsCount", { count: totalVisible })}
        </span>
      )}
    </div>
  )
}
