"use client"

import { ReactNode } from "react"
import { useTranslations } from "next-intl"
import { FileText } from "lucide-react"

interface EvidenceInspectorProps {
  title: string
  subtitle?: string
  category?: string
  certaintyBadge?: ReactNode
  children: ReactNode
  footer?: ReactNode
}

export function EvidenceInspector({
  title,
  subtitle,
  category,
  certaintyBadge,
  children,
  footer,
}: EvidenceInspectorProps) {
  const t = useTranslations("workspace")
  return (
    <aside
      className="app-inspector flex flex-col h-full overflow-hidden"
      aria-labelledby="evidence-inspector-title"
    >
      {/* ── Sticky Header ── */}
      <div className="shrink-0 border-b border-border/60 px-[18px] pt-[18px] pb-4 sticky top-0 z-10 bg-[var(--inspector-bg)] backdrop-blur-sm">
        {/* Top meta row */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <span className="inline-flex items-center gap-1.5 rounded-md border border-info/25 bg-info/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-info">
            <FileText className="w-3 h-3" />
            {t("evidence")}
          </span>
          <div className="flex items-center gap-1.5">
            {category && (
              <span className="text-[10px] font-medium text-muted-foreground/60 uppercase tracking-wider">
                {category.replace("_", " ")}
              </span>
            )}
            {certaintyBadge}
          </div>
        </div>

        {/* Insight title */}
        <h3
          id="evidence-inspector-title"
          className="text-[13px] font-semibold leading-snug text-foreground mb-0"
        >
          {title}
        </h3>

        {/* Subtitle / statement as quote */}
        {subtitle && (
          <div className="mt-2.5 border-l-2 border-border pl-3 max-h-20 overflow-y-auto">
            <p className="text-[11px] leading-relaxed text-muted-foreground font-mono">
              {subtitle}
            </p>
          </div>
        )}
      </div>

      {/* ── Scrollable content ── */}
      <div className="flex-1 overflow-y-auto py-4 px-[18px]">
        {children}
      </div>

      {/* ── Footer (always visible, never scrolls) ── */}
      {footer && (
        <div className="shrink-0 border-t border-border/60">
          {footer}
        </div>
      )}
    </aside>
  )
}
