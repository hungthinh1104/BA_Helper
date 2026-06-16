"use client"

import React, { useEffect, useRef, useState } from 'react'
import mermaid from 'mermaid'

interface MermaidRendererProps {
  chart: string
}

mermaid.initialize({
  startOnLoad: false,
  theme: 'default',
  securityLevel: 'loose',
})

export function MermaidRenderer({ chart }: MermaidRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [hasError, setHasError] = useState(false)
  const [svgContent, setSvgContent] = useState<string>('')

  useEffect(() => {
    let isMounted = true
    const renderChart = async () => {
      try {
        setHasError(false)
        const id = `mermaid-${Math.random().toString(36).substr(2, 9)}`
        const { svg } = await mermaid.render(id, chart)
        if (isMounted) {
          setSvgContent(svg)
        }
      } catch (error) {
        console.error('Mermaid rendering failed:', error)
        if (isMounted) {
          setHasError(true)
        }
      }
    }

    if (chart) {
      renderChart()
    }

    return () => {
      isMounted = false
    }
  }, [chart])

  if (hasError) {
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
        ref={containerRef}
        className="report-mermaid-preview flex justify-center rounded-lg border border-border/50 bg-background px-4 py-4 shadow-sm"
        dangerouslySetInnerHTML={{ __html: svgContent }}
      />
      <pre className="report-pre report-mermaid-fallback mt-3">
        <code className="language-mermaid">{chart}</code>
      </pre>
    </div>
  )
}
