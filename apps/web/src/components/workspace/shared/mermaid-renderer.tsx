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
      <pre className="p-4 rounded-md bg-muted text-muted-foreground overflow-x-auto text-sm my-4">
        <code className="language-mermaid">{chart}</code>
      </pre>
    )
  }

  return (
    <div 
      ref={containerRef}
      className="flex justify-center my-6 py-4 bg-background border border-border/50 rounded-lg shadow-sm"
      dangerouslySetInnerHTML={{ __html: svgContent }}
    />
  )
}
