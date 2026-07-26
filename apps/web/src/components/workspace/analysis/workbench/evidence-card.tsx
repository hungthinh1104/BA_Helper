"use client"

import { Copy, ExternalLink, Link2 } from "lucide-react"
import { toast } from "sonner"
import type { AnalysisWorkspaceResponse } from "@ba-helper/contracts"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import type { AnalysisWorkspaceLabels } from "@/lib/i18n/analysis-labels"

type Evidence = AnalysisWorkspaceResponse["evidenceCards"][number]

export function EvidenceCard({
  evidence,
  labels,
  commitSha,
  repositoryUrl,
}: {
  evidence: Evidence
  labels: AnalysisWorkspaceLabels["reviewWorkbench"]
  commitSha?: string
  repositoryUrl?: string | null
}) {
  const lineRange = formatLineRange(evidence)
  const shortSha = commitSha ? commitSha.substring(0, 7) : null
  const location = buildLocation(evidence, shortSha)
  const sourceUrl = buildSourceUrl(repositoryUrl, commitSha, evidence.filePath, evidence.lineRange)
  // With a source URL the copy action yields a shareable permalink; otherwise it
  // falls back to the copyable path:line @ commit reference.
  const copyTarget = sourceUrl ?? location

  return (
    <article className="rounded-lg border border-border/50 bg-background p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-mono text-xs text-foreground">{evidence.filePath ?? evidence.artifactKey ?? evidence.sourceType}</p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            <Badge variant="outline">{evidence.sourceType}</Badge>
            <Badge variant="outline">{lineRange}</Badge>
            {shortSha ? (
              <Badge variant="outline" className="font-mono" title={labels.pinnedTo.replace("{commit}", shortSha)}>
                {labels.pinnedTo.replace("{commit}", shortSha)}
              </Badge>
            ) : null}
            <Badge variant="outline">{labels.linkedItems}: {evidence.linkedInsightIds.length + evidence.linkedTraceabilityLinkIds.length}</Badge>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {sourceUrl ? (
            <a
              href={sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={labels.openSource}
              title={labels.openSource}
              className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-surface-muted hover:text-foreground"
              data-open-source
            >
              <ExternalLink aria-hidden="true" className="size-3.5" />
            </a>
          ) : null}
          {copyTarget ? (
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label={sourceUrl ? labels.copyPermalink : labels.copyLocation}
              title={sourceUrl ? labels.copyPermalink : labels.copyLocation}
              onClick={() => {
                void navigator.clipboard.writeText(copyTarget)
                toast.success(sourceUrl ? labels.copiedPermalink : labels.copiedLocation)
              }}
            >
              <Link2 aria-hidden="true" />
            </Button>
          ) : null}
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
      </div>
      <LineNumberedExcerpt excerpt={evidence.excerpt} startLine={evidence.lineRange.startLine} />
      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{evidence.relevanceReason}</p>
    </article>
  )
}

/** Renders the excerpt with a line-number gutter, highlighting the cited range. */
function LineNumberedExcerpt({ excerpt, startLine }: { excerpt: string; startLine: number | null }) {
  const lines = excerpt.replace(/\n$/, "").split("\n")
  const base = startLine ?? 1
  return (
    <pre className="mt-3 overflow-x-auto rounded-md border border-border/40 bg-surface-muted/40 p-0 text-xs leading-relaxed">
      <code className="block">
        {lines.map((line, index) => (
          <span key={index} className="flex bg-warning/5">
            <span className="w-10 shrink-0 select-none border-r border-border/40 px-2 text-right font-mono text-muted-foreground">
              {base + index}
            </span>
            <span className="whitespace-pre px-2 text-foreground">{line || " "}</span>
          </span>
        ))}
      </code>
    </pre>
  )
}

function buildLocation(evidence: Evidence, shortSha: string | null) {
  const path = evidence.filePath ?? evidence.artifactKey
  if (!path) return ""
  const { startLine, endLine } = evidence.lineRange
  const lines = startLine && endLine ? `:L${startLine}-${endLine}` : startLine ? `:L${startLine}` : ""
  const at = shortSha ? ` @ ${shortSha}` : ""
  return `${path}${lines}${at}`
}

function formatLineRange(evidence: Evidence) {
  const { startLine, endLine } = evidence.lineRange
  if (!startLine && !endLine) return "—"
  if (startLine && endLine) return `L${startLine}–${endLine}`
  return `L${startLine ?? endLine}`
}

/**
 * Builds a pinned source permalink (public GitHub) to the evidence's exact lines
 * at the analyzed commit. Returns null for a missing or unsupported source so
 * the card falls back to the copyable path:line reference.
 */
export function buildSourceUrl(
  repositoryUrl: string | null | undefined,
  commitSha: string | null | undefined,
  filePath: string | null | undefined,
  lineRange: { startLine: number | null; endLine: number | null },
): string | null {
  if (!repositoryUrl || !commitSha || !filePath) return null
  const base = repositoryUrl.trim().replace(/\/+$/, "").replace(/\.git$/i, "")
  // Controlled beta supports public GitHub repositories only.
  if (!/^https?:\/\/github\.com\/[^/]+\/[^/]+/i.test(base)) return null
  const path = filePath.replace(/^\/+/, "")
  return `${base}/blob/${commitSha}/${path}${lineAnchor(lineRange)}`
}

function lineAnchor(lineRange: { startLine: number | null; endLine: number | null }): string {
  const { startLine, endLine } = lineRange
  if (startLine && endLine && endLine !== startLine) return `#L${startLine}-L${endLine}`
  if (startLine) return `#L${startLine}`
  return ""
}
