"use client"

import { ReportLayout } from "@/components/layout/report-layout"
import { TraceabilityMatrix } from "@/components/report/traceability-matrix"
import { EvidenceAppendix } from "@/components/report/evidence-appendix"
import { ReportSection } from "@/components/report/report-section"
import { 
  MOCK_IMPACT_ANALYSIS, 
  MOCK_INSIGHTS, 
  MOCK_TRACEABILITY_LINKS 
} from "@/lib/mock-data/impact-analysis"

export default function GeneratedReportPage() {
  const analysis = MOCK_IMPACT_ANALYSIS
  const insights = MOCK_INSIGHTS.items
  const links = MOCK_TRACEABILITY_LINKS.items

  const claims = insights.filter(i => i.category === "CLAIM")
  const qaScenarios = insights.filter(i => i.category === "QA_SCENARIO")
  const unknowns = insights.filter(i => i.category === "UNKNOWN" || i.category === "QUESTION")

  return (
    <ReportLayout title="Impact Analysis Report">
      <div className="p-8 md:p-12">
        {/* Report Header */}
        <div className="mb-12">
          <h1 className="text-3xl font-bold mb-4">{analysis.requirement.revisionTitle}</h1>
          <div className="text-sm text-muted-foreground space-y-1">
            <p><strong>Requirement ID:</strong> {analysis.requirement.id}</p>
            <p><strong>Target Repository:</strong> {analysis.snapshot.repositoryId}</p>
            <p><strong>Target Commit:</strong> <span className="font-mono">{analysis.snapshot.commitSha}</span></p>
            <p><strong>Generated At:</strong> {new Date().toLocaleDateString()}</p>
          </div>
          <div className="mt-6 p-4 bg-surface-muted rounded-md border border-border text-sm italic">
            "{analysis.requirement.rawText}"
          </div>
        </div>

        {/* Executive Summary */}
        <ReportSection title="Executive Summary (Claims)">
          <ul className="list-disc pl-5 space-y-2 text-sm">
            {claims.map(claim => (
              <li key={claim.id}>
                <span className={claim.certainty === "EVIDENCED" ? "text-success font-medium" : "text-warning"}>
                  [{claim.certainty}]
                </span>{" "}
                {claim.statement}
              </li>
            ))}
          </ul>
        </ReportSection>

        {/* Affected Systems / Traceability */}
        <ReportSection title="Affected Systems Traceability">
          <TraceabilityMatrix links={links} />
        </ReportSection>

        {/* Unknowns & Questions */}
        <ReportSection title="Unknowns & Questions">
          {unknowns.length > 0 ? (
            <ul className="list-disc pl-5 space-y-2 text-sm">
              {unknowns.map(u => (
                <li key={u.id} className="text-danger font-medium">
                  {u.statement}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm italic text-muted-foreground">No unknowns detected.</p>
          )}
        </ReportSection>

        {/* QA Scenarios */}
        <ReportSection title="QA Scenarios">
          <ul className="list-disc pl-5 space-y-2 text-sm">
            {qaScenarios.map(qa => (
              <li key={qa.id}>{qa.statement}</li>
            ))}
          </ul>
        </ReportSection>

        {/* Appendix */}
        <div className="mt-16 pt-8 border-t-2 border-border border-dashed">
          <h2 className="text-xl font-bold mb-6 text-foreground">Appendix: Code Evidence</h2>
          <EvidenceAppendix insights={insights} />
        </div>
      </div>
    </ReportLayout>
  )
}
