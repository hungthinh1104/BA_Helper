"use client"

import { InsightList } from "@/components/workspace/shared/insight/insight-list"
import { AffectedArtifactCard } from "@/components/workspace/analysis/affected-artifact-card"
import { InsightFilterBar, type InsightFilterValue } from "@/components/workspace/shared/insight/insight-filter-bar"
import { Button } from "@/components/ui/button"
import type { InsightListResponse, TraceabilityLinkListResponse } from "@ba-helper/contracts"

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
            Start Review ({blockingRemaining})
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-10 max-w-4xl pb-12">
        {claims.length > 0 && (
          <InsightList
            title="Impact Claims"
            insights={claims}
            selectedInsightId={selectedInsight?.id}
            onSelect={onSelectInsight}
          />
        )}
        {ac.length > 0 && (
          <InsightList
            title="Acceptance Criteria"
            insights={ac}
            selectedInsightId={selectedInsight?.id}
            onSelect={onSelectInsight}
          />
        )}
        {unknowns.length > 0 && (
          <InsightList
            title="Unknowns & Missing Implementations"
            insights={unknowns}
            selectedInsightId={selectedInsight?.id}
            onSelect={onSelectInsight}
          />
        )}
        {questions.length > 0 && (
          <InsightList
            title="BA Clarification Questions"
            insights={questions}
            selectedInsightId={selectedInsight?.id}
            onSelect={onSelectInsight}
          />
        )}
        {qaScenarios.length > 0 && (
          <InsightList
            title="QA Scenarios"
            insights={qaScenarios}
            selectedInsightId={selectedInsight?.id}
            onSelect={onSelectInsight}
          />
        )}

        {links.length > 0 && filter === "ALL" && (
          <div className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold mb-1 px-1">Affected Artifacts</h3>
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

        {filteredInsights.length === 0 && filter !== "ALL" && (
          <div className="flex flex-col items-center text-center py-12 px-8 border border-dashed border-border/50 rounded-xl bg-surface-muted/20">
            <div className="w-10 h-10 rounded-lg bg-surface border border-border/50 flex items-center justify-center mb-3">
              <span className="text-lg">🔎</span>
            </div>
            <p className="text-[13px] font-medium text-foreground mb-1">No results</p>
            <p className="text-[12px] text-muted-foreground">
              No insights match the selected filter. Try switching to <strong>All</strong>.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
