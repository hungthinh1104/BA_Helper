"use client"

import { Copy } from "lucide-react"
import { toast } from "sonner"
import type { AnalysisWorkspaceResponse } from "@ba-helper/contracts"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import type { AnalysisWorkspaceLabels } from "@/lib/i18n/analysis-labels"

type Evidence = AnalysisWorkspaceResponse["evidenceCards"][number]

export function EvidenceCard({ evidence, labels }: { evidence: Evidence; labels: AnalysisWorkspaceLabels["reviewWorkbench"] }) {
  const lineRange = formatLineRange(evidence)
  return (
    <article className="rounded-lg border border-border/50 bg-background p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-mono text-xs text-foreground">{evidence.filePath ?? evidence.artifactKey ?? evidence.sourceType}</p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            <Badge variant="outline">{evidence.sourceType}</Badge>
            <Badge variant="outline">{lineRange}</Badge>
            <Badge variant="outline">{labels.linkedItems}: {evidence.linkedInsightIds.length + evidence.linkedTraceabilityLinkIds.length}</Badge>
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label={labels.copyExcerpt}
          title={labels.copyExcerpt}
          onClick={() => {
            void navigator.clipboard.writeText(evidence.excerpt)
            toast.success(labels.copied)
          }}
        >
          <Copy aria-hidden="true" />
        </Button>
      </div>
      <pre className="mt-3 overflow-x-auto rounded-md border border-border/40 bg-surface-muted/40 p-2 text-xs leading-relaxed text-foreground"><code>{evidence.excerpt}</code></pre>
      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{evidence.relevanceReason}</p>
    </article>
  )
}

function formatLineRange(evidence: Evidence) {
  const { startLine, endLine } = evidence.lineRange
  if (!startLine && !endLine) return "—"
  if (startLine && endLine) return `L${startLine}–${endLine}`
  return `L${startLine ?? endLine}`
}
