import type { ApprovedImpactReportResponse } from "@ba-helper/contracts"

interface ReviewCoverageSummaryProps {
  summary: ApprovedImpactReportResponse["reviewCoverageSummary"]
}

export function ReviewCoverageSummary({ summary }: ReviewCoverageSummaryProps) {
  if (!summary) return null

  const weakOrMissing = summary.evidence.weak + summary.evidence.missing

  return (
    <div className="mt-8 space-y-4">
      <h3 className="text-base font-semibold text-foreground tracking-tight">Review Coverage</h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <CoverageMetric
          label="Insights reviewed"
          value={`${summary.insights.reviewed} / ${summary.insights.total}`}
        />
        <CoverageMetric
          label="Links reviewed"
          value={`${summary.traceabilityLinks.reviewed} / ${summary.traceabilityLinks.total}`}
        />
        <CoverageMetric label="Accepted" value={summary.decisions.accepted} />
        <CoverageMetric label="Rejected" value={summary.decisions.rejected} />
        <CoverageMetric label="Needs clarification" value={summary.decisions.needsClarification} />
        <CoverageMetric label="Strong evidence" value={summary.evidence.strong} />
        <CoverageMetric label="Weak/missing evidence" value={weakOrMissing} />
        <CoverageMetric label="Conflicting evidence" value={summary.evidence.conflicting} />
        <CoverageMetric label="Review required" value={summary.evidence.reviewRequired} />
      </div>
    </div>
  )
}

function CoverageMetric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex flex-col rounded-lg border border-border/50 bg-surface px-4 py-3">
      <span className="text-[12px] font-medium text-muted-foreground uppercase tracking-wider mb-1">
        {label}
      </span>
      <span className="text-xl font-semibold text-foreground">{value}</span>
    </div>
  )
}
