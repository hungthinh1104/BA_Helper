"use client"

import { useState, useCallback } from "react"
import { Code2, Copy, Check } from "lucide-react"

interface CodeEvidenceBlockProps {
  evidence: {
    id: string
    sourceType: string
    filePath: string | null
    startLine: number | null
    endLine: number | null
    excerpt: string
  }
  index?: number
  total?: number
}

export function CodeEvidenceBlock({ evidence, index, total }: CodeEvidenceBlockProps) {
  const [copied, setCopied] = useState(false)
  const lines = evidence.excerpt.split('\n')
  const startLine = evidence.startLine ?? 1

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(evidence.excerpt)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {}
  }, [evidence.excerpt])

  // Build display path: show last 2 segments for readability
  const fullPath = evidence.filePath ?? "Unknown Source"
  const pathParts = fullPath.split('/')
  const displayPath = pathParts.length > 2
    ? pathParts.slice(-2).join('/')
    : fullPath

  return (
    <div className="evidence-card mb-4 group/block">
      {/* ── File Header ── */}
      <div className="flex items-center justify-between px-3 py-2.5 bg-surface border-b border-border">
        <div className="flex items-center gap-2 min-w-0">
          {/* Language badge */}
          <span className="inline-flex items-center gap-1 shrink-0 px-1.5 py-0.5 rounded bg-info/10 border border-info/20 text-[10px] font-semibold font-mono text-info">
            <Code2 className="w-2.5 h-2.5" />
            TS
          </span>
          {/* Full path */}
          <span className="text-[11px] font-mono text-muted-foreground truncate" title={fullPath}>
            <span className="text-muted-foreground/50">{pathParts.slice(0, -2).join('/') + (pathParts.length > 2 ? '/' : '')}</span>
            <span className="text-foreground/80 font-medium">{displayPath}</span>
          </span>
        </div>

        {/* Right side: line range + counter + copy */}
        <div className="flex items-center gap-3 shrink-0">
          {evidence.startLine && evidence.endLine && (
            <span className="text-[10px] font-mono text-muted-foreground/50">
              L{evidence.startLine}–{evidence.endLine}
            </span>
          )}
          {index !== undefined && total !== undefined && (
            <span className="text-[10px] font-mono text-muted-foreground/50 border-l border-border/60 pl-3">
              {index + 1} / {total}
            </span>
          )}
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 h-6 px-2 rounded-md border border-border/60 bg-surface-muted text-[10px] font-medium text-muted-foreground hover:text-foreground hover:border-border transition-all opacity-0 group-hover/block:opacity-100"
            title="Copy code"
          >
            {copied
              ? <><Check className="w-3 h-3 text-success" /><span className="text-success">Copied</span></>
              : <><Copy className="w-3 h-3" />Copy</>
            }
          </button>
        </div>
      </div>

      {/* ── Source type badge ── */}
      {evidence.sourceType && (
        <div className="px-3 py-1.5 border-b border-border/40 bg-surface-muted/40">
          <span className="badge badge-neutral text-[9px] uppercase tracking-wider px-1.5 opacity-60">
            {evidence.sourceType}
          </span>
        </div>
      )}

      {/* ── Code block ── */}
      <pre className="code-block">
        {lines.map((line, i) => (
          <div key={i} className="code-line">
            <div className="code-line-number opacity-30 select-none text-right w-8">{startLine + i}</div>
            <div className="whitespace-pre">{line}</div>
          </div>
        ))}
      </pre>
    </div>
  )
}
