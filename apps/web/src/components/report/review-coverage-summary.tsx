import type { ApprovedImpactReportResponse } from "@ba-helper/contracts"
import { useTranslations } from "next-intl"
import { DenseCard } from "@/components/workspace/shared/dense-card"

interface ReviewCoverageSummaryProps {
  summary: ApprovedImpactReportResponse["reviewCoverageSummary"]
}

export function ReviewCoverageSummary({ summary }: ReviewCoverageSummaryProps) {
  const t = useTranslations("reports")

  if (!summary) return null

  const weakOrMissing = summary.evidence.weak + summary.evidence.missing

  return (
    <div className="mt-8 space-y-4">
      <h3 className="text-base font-semibold text-foreground tracking-tight">{t("reviewCoverage")}</h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <CoverageMetric
          label={t("insightsReviewed")}
          value={`${summary.insights.reviewed} / ${summary.insights.total}`}
        />
        <CoverageMetric
          label={t("linksReviewed")}
          value={`${summary.traceabilityLinks.reviewed} / ${summary.traceabilityLinks.total}`}
        />
        <CoverageMetric label={t("accepted")} value={summary.decisions.accepted} />
        <CoverageMetric label={t("rejected")} value={summary.decisions.rejected} />
        <CoverageMetric label={t("needsClarification")} value={summary.decisions.needsClarification} />
        <CoverageMetric label={t("strongEvidence")} value={summary.evidence.strong} />
        <CoverageMetric label={t("weakMissingEvidence")} value={weakOrMissing} />
        <CoverageMetric label={t("conflictingEvidence")} value={summary.evidence.conflicting} />
        <CoverageMetric label={t("reviewRequired")} value={summary.evidence.reviewRequired} />
      </div>
    </div>
  )
}

function CoverageMetric({ label, value }: { label: string; value: string | number }) {
  return (
    <DenseCard className="px-4 py-3">
      <span className="text-[12px] font-medium text-muted-foreground uppercase tracking-wider mb-1">
        {label}
      </span>
      <span className="text-xl font-semibold text-foreground">{value}</span>
    </DenseCard>
  )
}
