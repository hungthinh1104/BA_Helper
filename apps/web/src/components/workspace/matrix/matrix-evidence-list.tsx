import { MatrixRowArtifactDetail } from "@ba-helper/contracts"
import { CodeEvidenceBlock } from "@/components/workspace/analysis/retrieval/code-evidence-block"

interface MatrixEvidenceListProps {
  artifact: MatrixRowArtifactDetail
}

export function MatrixEvidenceList({ artifact }: MatrixEvidenceListProps) {
  if (artifact.evidenceItems.length === 0) return null

  return (
    <details className="group border-b px-3 py-1 open:pb-3" open>
      <summary className="text-[12px] font-medium py-2 text-muted-foreground hover:text-foreground cursor-pointer list-none flex items-center justify-between">
        Evidence ({artifact.evidenceItems.length})
        <span className="text-muted-foreground/50 text-[10px] group-open:rotate-180 transition-transform">▼</span>
      </summary>
      <div className="pt-1 space-y-3">
        {artifact.evidenceItems.map((evidence) => (
          <div key={evidence.evidenceId} className="flex flex-col gap-1.5">
            <div className="text-[11px] text-muted-foreground font-mono">
              {evidence.sourceFile || artifact.filePath}
              {evidence.startLine !== null && evidence.endLine !== null
                ? `:${evidence.startLine}-${evidence.endLine}`
                : ""}
            </div>
            <CodeEvidenceBlock
              evidence={{
                id: evidence.evidenceId,
                sourceType: "CODE",
                filePath: evidence.sourceFile || artifact.filePath,
                startLine: evidence.startLine,
                endLine: evidence.endLine,
                excerpt: evidence.quoteOrSnippet,
              }}
            />
          </div>
        ))}
      </div>
    </details>
  )
}
