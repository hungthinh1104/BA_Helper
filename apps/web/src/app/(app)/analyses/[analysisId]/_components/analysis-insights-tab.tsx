"use client"

import { useTranslations } from "next-intl"
import { InsightList } from "@/components/workspace/analysis/insight/insight-list"
import { AffectedArtifactCard } from "@/components/workspace/analysis/affected-artifact-card"
import { InsightFilterBar, type InsightFilterValue } from "@/components/workspace/analysis/insight/insight-filter-bar"
import { Button } from "@/components/ui/button"
import type { InsightListResponse, TraceabilityLinkListResponse } from "@ba-helper/contracts"
import { DenseCard } from "@/components/workspace/shared/dense-card"

type Insight = InsightListResponse["items"][number]
type TraceabilityLink = TraceabilityLinkListResponse["items"][number]

interface FilterCounts {
  ALL: number
  EVIDENCED: number
  INFERRED: number
  UNKNOWN: number
  CONFLICTING: number
  NEEDS_REVIEW: number
}

interface AnalysisInsightsTabProps {
  claims: Insight[]
  ac: Insight[]
  unknowns: Insight[]
  questions: Insight[]
  qaScenarios: Insight[]
  links: TraceabilityLink[]
  selectedInsight: Insight | null
  selectedLink: TraceabilityLink | null
  filter: InsightFilterValue
  filterCounts: FilterCounts
  totalVisible: number
  filteredInsights: Insight[]
  showStartReview: boolean
  blockingRemaining: number
  onSelectInsight: (insight: Insight) => void
  onSelectLink: (link: TraceabilityLink) => void
  onFilterChange: (filter: InsightFilterValue) => void
  onGoToReviewQueue: () => void
}

export function AnalysisInsightsTab({
  claims,
  ac,
  unknowns,
  questions,
  qaScenarios,
  links,
  selectedInsight,
  selectedLink,
  filter,
  filterCounts,
  totalVisible,
  filteredInsights,
  showStartReview,
  blockingRemaining,
  onSelectInsight,
  onSelectLink,
  onFilterChange,
  onGoToReviewQueue,
}: AnalysisInsightsTabProps) {
  const t = useTranslations("workspace")

  return (
    <div className="mt-4">
      <div className="flex items-center gap-3 mb-6">
        <InsightFilterBar
          currentFilter={filter}
          onFilterChange={onFilterChange}
          counts={filterCounts}
          totalVisible={totalVisible}
        />
        <div className="flex-1" />
        {showStartReview && (
          <Button
            onClick={onGoToReviewQueue}
            disabled={blockingRemaining === 0}
            size="sm"
            className="h-8 shadow-none shrink-0"
          >
            {blockingRemaining > 0 ? t("startReviewWithCount", { count: blockingRemaining }) : t("reviewComplete")}
          </Button>
        )}
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <InsightMetric label={t("evidenceBackedClaims")} value={claims.length} />
        <InsightMetric label={t("unknownsRisks")} value={unknowns.length} />
        <InsightMetric label={t("qaScenarios")} value={qaScenarios.length} />
        <InsightMetric label={t("reviewRemaining")} value={blockingRemaining} />
      </div>

      <div className="flex flex-col gap-7 max-w-4xl pb-12">
        {links.length > 0 && filter === "ALL" && (
          <div className="flex flex-col gap-3">
            <div className="px-1">
              <h3 className="text-sm font-semibold mb-1">{t("impactedArtifacts")}</h3>
              <p className="text-[12px] text-muted-foreground">
                {t("impactedArtifactsDescription")}
              </p>
            </div>
            {links.map((link) => (
              <AffectedArtifactCard
                key={link.id}
                link={link}
                isSelected={selectedLink?.id === link.id}
                onClick={onSelectLink}
              />
            ))}
          </div>
        )}

        {claims.length > 0 && (
          <InsightList
            title={t("impactClaims")}
            insights={claims}
            selectedInsightId={selectedInsight?.id}
            onSelect={onSelectInsight}
          />
        )}
        {ac.length > 0 && (
          <InsightList
            title={t("acceptanceCriteria")}
            insights={ac}
            selectedInsightId={selectedInsight?.id}
            onSelect={onSelectInsight}
          />
        )}
        {unknowns.length > 0 && (
          <InsightList
            title={t("unknownsAndRiskSignals")}
            insights={unknowns}
            selectedInsightId={selectedInsight?.id}
            onSelect={onSelectInsight}
          />
        )}
        {questions.length > 0 && (
          <InsightList
            title={t("baClarificationQuestions")}
            insights={questions}
            selectedInsightId={selectedInsight?.id}
            onSelect={onSelectInsight}
          />
        )}
        {qaScenarios.length > 0 && (
          <InsightList
            title={t("qaScenarios")}
            insights={qaScenarios}
            selectedInsightId={selectedInsight?.id}
            onSelect={onSelectInsight}
          />
        )}

        {filteredInsights.length === 0 && filter !== "ALL" && (
          <DenseCard variant="dashed" className="items-center px-8 py-12 text-center">
            <div className="w-10 h-10 rounded-lg bg-surface border border-border/50 flex items-center justify-center mb-3">
              <span className="text-sm text-muted-foreground">{t("noMatch")}</span>
            </div>
            <p className="text-[13px] font-medium text-foreground mb-1">{t("noResults")}</p>
            <p className="text-[12px] text-muted-foreground">
              {t.rich("noInsightsMatchFilter", {
                strong: (chunks) => <strong>{chunks}</strong>,
              })}
            </p>
          </DenseCard>
        )}
      </div>
    </div>
  )
}

function InsightMetric({ label, value }: { label: string; value: number }) {
  return (
    <DenseCard variant="muted" className="px-3 py-2">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-semibold text-foreground tabular-nums">{value}</p>
    </DenseCard>
  )
}
