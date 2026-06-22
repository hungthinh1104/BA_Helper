"use client"

import { isValidElement } from "react"
import ReactMarkdown, { type Components } from "react-markdown"
import remarkGfm from "remark-gfm"

import { MermaidRenderer } from "@/components/workspace/shared/mermaid-renderer"
import { cn } from "@/lib/utils"

const markdownComponents: Components = {
  pre({ children, ...props }) {
    const child = Array.isArray(children) ? children[0] : children
    if (
      isValidElement<{ className?: string }>(child) &&
      child.props.className?.includes("language-mermaid")
    ) {
      return <>{children}</>
    }
    return (
      <pre className="report-pre" {...props}>
        {children}
      </pre>
    )
  },
  code({ className: codeClassName, children, ...props }) {
    const language = /language-(\w+)/.exec(codeClassName || "")?.[1]
    if (language === "mermaid") {
      return <MermaidRenderer chart={String(children).replace(/\n$/, "")} />
    }
    return (
      <code className={codeClassName} {...props}>
        {children}
      </code>
    )
  },
  table({ children }) {
    return (
      <div className="report-table-wrap">
        <table>{children}</table>
      </div>
    )
  },
}

export function ReportMarkdown({
  markdown,
  className,
}: {
  markdown: string
  className?: string
}) {
  return (
    <article className={cn("report mx-auto w-full max-w-[80ch]", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={markdownComponents}
      >
        {markdown}
      </ReactMarkdown>
    </article>
  )
}
