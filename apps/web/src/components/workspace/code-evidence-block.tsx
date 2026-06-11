interface CodeEvidenceBlockProps {
  evidence: {
    id: string
    sourceType: string
    filePath: string | null
    startLine: number | null
    endLine: number | null
    excerpt: string
  }
}

export function CodeEvidenceBlock({ evidence }: CodeEvidenceBlockProps) {
  const lines = evidence.excerpt.split('\n')
  const startLine = evidence.startLine ?? 1

  return (
    <div className="evidence-card mb-4">
      <div className="evidence-meta">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-foreground">{evidence.filePath ?? 'Unknown Source'}</span>
          <span className="badge badge-neutral text-[10px] uppercase px-1.5">{evidence.sourceType}</span>
        </div>
        {evidence.startLine && evidence.endLine && (
          <span>L{evidence.startLine}-{evidence.endLine}</span>
        )}
      </div>
      <pre className="code-block">
        {lines.map((line, index) => (
          <div key={index} className="code-line">
            <div className="code-line-number">{startLine + index}</div>
            <div className="whitespace-pre">{line}</div>
          </div>
        ))}
      </pre>
    </div>
  )
}
