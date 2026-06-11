"use client"

import { useState, useCallback } from "react"
import { Code2, Copy, Check } from "lucide-react"

import { RetrievalSignalBadge, RetrievalReason, RetrievalDebugPanel } from "./retrieval-signals"
import { RetrievalSuggestion } from "./retrieval-suggestion"
import { RetrievalMetadata } from "@ba-helper/contracts"

// Basic syntax highlighting for TS/JS
function highlightLine(line: string) {
  if (!line.trim()) return line;
  
  // Very basic regex-based highlighting
  let html = line
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Comments
  if (html.includes('//')) {
    const parts = html.split('//');
    html = `${parts[0]}<span class="text-muted-foreground italic">//${parts.slice(1).join('//')}</span>`;
    return html; // Return early so we don't highlight inside comments
  }

  // Strings (single and double quotes)
  html = html.replace(/("[^"]*")/g, '<span class="text-success-text">$1</span>');
  html = html.replace(/('[^']*')/g, '<span class="text-success-text">$1</span>');
  html = html.replace(/(`[^`]*`)/g, '<span class="text-success-text">$1</span>');

  // Keywords
  const keywords = ['import', 'from', 'export', 'class', 'interface', 'type', 'const', 'let', 'var', 'function', 'async', 'await', 'return', 'if', 'else', 'for', 'while', 'switch', 'case', 'break', 'try', 'catch', 'throw', 'new', 'this', 'super'];
  const keywordRegex = new RegExp(`\\b(${keywords.join('|')})\\b`, 'g');
  html = html.replace(keywordRegex, '<span class="text-primary font-medium">$1</span>');

  // Numbers
  html = html.replace(/\b(\d+)\b/g, '<span class="text-warning-text">$1</span>');

  // Types / PascalCase (heuristic for classes/interfaces)
  html = html.replace(/\b([A-Z][a-zA-Z0-9_]*)\b/g, '<span class="text-info-text">$1</span>');

  return html;
}

interface CodeEvidenceBlockProps {
  evidence: {
    id: string
    sourceType: string
    filePath: string | null
    startLine: number | null
    endLine: number | null
    excerpt: string
    retrieval?: RetrievalMetadata
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

      {/* ── Retrieval Signals & Source type badge ── */}
      <div className="px-3 py-2 border-b border-border bg-surface flex flex-col gap-2">
        <div className="flex items-center gap-2">
          {evidence.sourceType && (
            <span className="badge badge-neutral text-[9px] uppercase tracking-wider px-1.5 opacity-60">
              {evidence.sourceType}
            </span>
          )}
          {evidence.retrieval && (
            <RetrievalSignalBadge retrieval={evidence.retrieval} />
          )}
        </div>
        {evidence.retrieval && (
          <>
            <RetrievalReason retrieval={evidence.retrieval} />
            <RetrievalSuggestion retrieval={evidence.retrieval} />
            <RetrievalDebugPanel retrieval={evidence.retrieval} />
          </>
        )}
      </div>

      {/* ── Code block ── */}
      <pre className="code-block relative group/code bg-surface-muted/30">
        {lines.map((line, i) => (
          <div key={i} className="code-line hover:bg-foreground/[0.02] transition-colors rounded-sm">
            <div className="code-line-number opacity-40 select-none text-right w-8 text-[11px] font-mono">{startLine + i}</div>
            <div className="whitespace-pre text-[12px] font-mono" dangerouslySetInnerHTML={{ __html: highlightLine(line) }} />
          </div>
        ))}
      </pre>
    </div>
  )
}
