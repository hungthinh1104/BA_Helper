import { Search, X } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { TRACE_GROUPS } from "./use-traceability-matrix"

interface MatrixToolbarProps {
  summaryCounts: { evidenceBacked: number; unknownRisk: number; qa: number; reviewRemaining: number }
  searchTerm: string
  traceTypeFilter: string
  certaintyFilter: string
  reviewStatusFilter: string
  hasActiveFilters: boolean
  
  onSearchChange: (val: string) => void
  onTraceTypeChange: (val: string) => void
  onCertaintyChange: (val: string) => void
  onReviewStatusChange: (val: string) => void
  onClearFilters: () => void
}

export function MatrixToolbar({
  summaryCounts,
  searchTerm,
  traceTypeFilter,
  certaintyFilter,
  reviewStatusFilter,
  hasActiveFilters,
  onSearchChange,
  onTraceTypeChange,
  onCertaintyChange,
  onReviewStatusChange,
  onClearFilters,
}: MatrixToolbarProps) {
  return (
    <div className="shrink-0 border-b border-border/40 p-3 flex flex-col gap-3">
      {/* Compact Status Bar & Search Row */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center justify-between">
        <div className="flex items-center gap-3 text-[11px] font-medium text-muted-foreground bg-surface-muted px-3 py-1.5 rounded-md border border-border/60">
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-success/60"></span> Evidence {summaryCounts.evidenceBacked}</span>
          <span className="text-border">·</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-danger/60"></span> Risk/Unknown {summaryCounts.unknownRisk}</span>
          <span className="text-border">·</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-info/60"></span> QA {summaryCounts.qa}</span>
          <span className="text-border">·</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-warning/60"></span> Needs Review {summaryCounts.reviewRemaining}</span>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 max-md:-mx-3 max-md:px-3 md:flex-wrap md:overflow-visible md:pb-0 scrollbar-hide">
          <div className="relative w-full sm:w-[220px]">
            <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search traceability..."
              value={searchTerm}
              onChange={e => onSearchChange(e.target.value)}
              className="h-8 pl-8 text-xs shadow-none"
            />
          </div>
          
          <Button size="sm" variant={traceTypeFilter === "ALL" ? "default" : "outline"} className="h-8 text-xs shadow-none" onClick={() => onTraceTypeChange("ALL")}>
            All types
          </Button>
          {TRACE_GROUPS.map(group => (
            <Button
              key={group.type}
              size="sm"
              variant={traceTypeFilter === group.type ? "default" : "outline"}
              className="h-8 text-xs shadow-none"
              onClick={() => onTraceTypeChange(group.type)}
            >
              {group.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Filters Row */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 max-md:-mx-3 max-md:px-3 md:flex-wrap md:overflow-visible md:pb-0 scrollbar-hide">
        {["ALL", "EVIDENCED", "INFERRED", "UNKNOWN", "CONFLICTING"].map(value => (
          <Button
            key={value}
            size="sm"
            variant={certaintyFilter === value ? "default" : "outline"}
            className="h-7 px-2.5 text-[11px] shadow-none"
            onClick={() => onCertaintyChange(value)}
          >
            {value === "ALL" ? "All certainty" : value.replace(/_/g, " ")}
          </Button>
        ))}
        <div className="w-px h-4 bg-border/60 mx-1"></div>
        {["ALL", "NEEDS_REVIEW", "CONFIRMED", "REJECTED"].map(value => (
          <Button
            key={value}
            size="sm"
            variant={reviewStatusFilter === value ? "default" : "outline"}
            className="h-7 px-2.5 text-[11px] shadow-none"
            onClick={() => onReviewStatusChange(value)}
          >
            {value === "ALL" ? "All reviews" : value.replace(/_/g, " ")}
          </Button>
        ))}
        {hasActiveFilters ? (
          <Button size="sm" variant="ghost" className="h-7 px-2 text-[11px] shadow-none ml-auto" onClick={onClearFilters}>
            <X className="mr-1.5 h-3 w-3" />
            Clear filters
          </Button>
        ) : null}
      </div>
    </div>
  )
}
