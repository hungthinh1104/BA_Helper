"use client"

import React, { useEffect, useState } from 'react'
import mermaid from 'mermaid'
import DOMPurify from 'dompurify'

interface MermaidRendererProps {
  chart: string
}

mermaid.initialize({
  startOnLoad: false,
  theme: 'default',
  securityLevel: 'strict',
  htmlLabels: false,
  suppressErrorRendering: true,
})

export function MermaidRenderer({ chart }: MermaidRendererProps) {
  const [rendered, setRendered] = useState<{ chart: string; svg: string; failed: boolean } | null>(null)
  const current = rendered?.chart === chart ? rendered : null

  useEffect(() => {
    let isMounted = true
    const renderChart = async () => {
      try {
        const id = `mermaid-${Math.random().toString(36).slice(2, 11)}`
        const { svg } = await mermaid.render(id, chart)
        if (isMounted) {
          setRendered({ chart, svg: DOMPurify.sanitize(svg, { USE_PROFILES: { svg: true, svgFilters: true } }), failed: false })
        }
      } catch {
        console.error('Mermaid rendering failed')
        if (isMounted) {
          setRendered({ chart, svg: '', failed: true })
        }
      }
    }

    if (chart) {
      void renderChart()
    }

    return () => {
      isMounted = false
    }
  }, [chart])

  if (current?.failed) {
    // Fallback to raw code block if mermaid fails to render
    return (
      <pre className="report-pre my-4">
        <code className="language-mermaid">{chart}</code>
      </pre>
    )
  }

  return (
    <div className="report-mermaid my-6">
      <div
        className="report-mermaid-preview flex justify-center rounded-lg border border-border/50 bg-background px-4 py-4 shadow-sm"
        dangerouslySetInnerHTML={{ __html: current?.svg ?? '' }}
      />
      <pre className="report-pre report-mermaid-fallback mt-3">
        <code className="language-mermaid">{chart}</code>
      </pre>
    </div>
  )
}
