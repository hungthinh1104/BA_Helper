import { InsightListResponse } from "@ba-helper/contracts"
import { CodeEvidenceBlock } from "@/components/workspace/code-evidence-block"

interface EvidenceAppendixProps {
  insights: InsightListResponse["items"]
}

export function EvidenceAppendix({ insights }: EvidenceAppendixProps) {
  // Collect all unique evidence blocks from insights
  const allEvidence = insights.flatMap(insight => 
    insight.evidence.map(ev => ({ ...ev, insightStatement: insight.statement }))
  )

  if (allEvidence.length === 0) {
    return <div className="text-sm text-muted-foreground italic">No evidence collected.</div>
  }

  return (
    <div className="flex flex-col gap-6">
      {allEvidence.map((ev, index) => (
        <div key={ev.id} className="border border-border rounded-lg p-4 bg-surface-soft">
          <div className="text-sm font-semibold mb-2">
            Evidence #{index + 1}: <span className="font-normal text-muted-foreground">{ev.insightStatement}</span>
          </div>
          <CodeEvidenceBlock evidence={ev} />
        </div>
      ))}
    </div>
  )
}
