import Link from "next/link"
import { DataCard, SectionHeader } from "@/components/workspace/shared/primitives"
import { AnalysisStatusBadge } from "@/components/workspace/shared/status-badges"
import type { ImpactAnalysisListResponse } from "@ba-helper/contracts"

interface DashboardActiveIssuesProps {
  failedAnalyses: ImpactAnalysisListResponse["items"]
  runningAnalyses: ImpactAnalysisListResponse["items"]
}

export function DashboardActiveIssues({
  failedAnalyses,
  runningAnalyses,
}: DashboardActiveIssuesProps) {
  if (failedAnalyses.length === 0 && runningAnalyses.length === 0) return null

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {failedAnalyses.length > 0 ? (
        <DataCard className="p-4">
          <SectionHeader
            title="Recent failures"
            description="Short reasons only. Open the analysis page for exact provider, stale, or partial-snapshot remediation."
          />
          <div className="mt-4 space-y-3">
            {failedAnalyses.slice(0, 3).map(analysis => (
              <Link key={analysis.id} href={`/analyses/${analysis.id}`} className="block rounded-lg border border-danger/20 bg-danger/5 p-3 hover:bg-danger/10">
                <p className="text-sm font-medium text-foreground">{analysis.requirementRevisionTitle}</p>
                <p className="mt-1 text-sm text-danger">{analysis.error?.message ?? "Analysis failed."}</p>
              </Link>
            ))}
          </div>
        </DataCard>
      ) : null}

      {runningAnalyses.length > 0 ? (
        <DataCard className="p-4">
          <SectionHeader
            title="Currently running"
            description="These analyses are still processing persisted evidence. Results appear in the analysis detail page first."
          />
          <div className="mt-4 space-y-3">
            {runningAnalyses.slice(0, 3).map(analysis => (
              <Link key={analysis.id} href={`/analyses/${analysis.id}`} className="block rounded-lg border border-info/20 bg-info/5 p-3 hover:bg-info/10">
                <p className="text-sm font-medium text-foreground">{analysis.requirementRevisionTitle}</p>
                <div className="mt-2 flex items-center gap-2">
                  <AnalysisStatusBadge status={analysis.status} />
                </div>
              </Link>
            ))}
          </div>
        </DataCard>
      ) : null}
    </div>
  )
}
