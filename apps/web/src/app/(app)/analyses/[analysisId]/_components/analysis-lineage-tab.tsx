import { useState } from "react"
import { useTranslations } from "next-intl"
import { useAnalysisLineage } from "@/hooks/api/use-analyses"
import { Skeleton } from "@/components/ui/skeleton"
import {
  FileText,
  PlayCircle,
  CheckCircle2,
  GitCompare,
  ThumbsUp,
  ThumbsDown,
  HelpCircle,
  MessageSquare,
  CornerDownRight,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  GitMerge
} from "lucide-react"
import type { LineageTimelineEvent } from "@ba-helper/contracts"

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  }).replace(',', ' at')
}

function EventIcon({ type, status }: { type: LineageTimelineEvent['type'], status?: string }) {
  switch (type) {
    case 'REQUIREMENT_CREATED':
    case 'REQUIREMENT_REVISED':
      return <FileText className="w-4 h-4 text-primary" />
    case 'ANALYSIS_CREATED':
    case 'DERIVED_ANALYSIS_CREATED':
      return <PlayCircle className="w-4 h-4 text-info" />
    case 'ANALYSIS_COMPLETED':
      return <CheckCircle2 className="w-4 h-4 text-success" />
    case 'IMPACT_DIFF_AVAILABLE':
      return <GitCompare className="w-4 h-4 text-secondary" />
    case 'REVIEW_DECISION':
      if (status === 'ACCEPTED') return <ThumbsUp className="w-4 h-4 text-success" />
      if (status === 'REJECTED') return <ThumbsDown className="w-4 h-4 text-danger" />
      if (status === 'NEEDS_MORE_CLARIFICATION') return <HelpCircle className="w-4 h-4 text-warning" />
      return <HelpCircle className="w-4 h-4 text-muted-foreground" />
    case 'CLARIFICATION_REQUESTED':
      return <MessageSquare className="w-4 h-4 text-warning" />
    case 'CLARIFICATION_ANSWERED':
      return <CornerDownRight className="w-4 h-4 text-primary" />
    default:
      return <div className="w-2 h-2 rounded-full bg-muted-foreground" />
  }
}

function CollapsibleText({ text, maxChars = 300 }: { text: string, maxChars?: number }) {
  const t = useTranslations("workspace")
  const [expanded, setExpanded] = useState(false)
  
  if (!text) return null
  if (text.length <= maxChars) {
    return <div className="text-[13px] text-foreground mt-2 whitespace-pre-wrap">{text}</div>
  }

  return (
    <div className="mt-2">
      <div className="text-[13px] text-foreground whitespace-pre-wrap">
        {expanded ? text : text.slice(0, maxChars) + '...'}
      </div>
      <button 
        onClick={() => setExpanded(!expanded)}
        className="mt-1.5 flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline"
      >
        {expanded ? (
          <><ChevronUp className="w-3 h-3" /> {t("showLess")}</>
        ) : (
          <><ChevronDown className="w-3 h-3" /> {t("showMore")}</>
        )}
      </button>
    </div>
  )
}

function LineageEventCard({ event, isCurrentAnalysis }: { event: LineageTimelineEvent, isCurrentAnalysis: boolean }) {
  const t = useTranslations("workspace")
  const isAnalysisRootEvent = event.type === 'ANALYSIS_CREATED' || event.type === 'DERIVED_ANALYSIS_CREATED'
  const isCurrentAnalysisScope = isCurrentAnalysis
  const isHighlighted = isAnalysisRootEvent || event.type === 'REVIEW_DECISION'

  let content = null

  if (event.type === 'REQUIREMENT_CREATED' || event.type === 'REQUIREMENT_REVISED') {
    content = <CollapsibleText text={String(event.metadata?.title || "")} maxChars={150} />
  } else if (event.type === 'REVIEW_DECISION') {
    content = event.metadata?.note ? <CollapsibleText text={String(event.metadata.note)} /> : null
  } else if (event.type === 'CLARIFICATION_REQUESTED') {
    content = event.metadata?.question ? <CollapsibleText text={String(event.metadata.question)} /> : null
  } else if (event.type === 'CLARIFICATION_ANSWERED') {
    content = event.metadata?.answer ? <div className="pl-3 border-l-2 border-primary/20"><CollapsibleText text={String(event.metadata.answer)} /></div> : null
  }

  return (
    <div className="relative flex gap-4 w-full">
      {/* Timeline Line */}
      <div className="absolute top-8 left-[15px] bottom-[-24px] w-[2px] bg-border/50 last:hidden" />
      
      {/* Icon */}
      <div className={`relative z-10 flex items-center justify-center w-8 h-8 rounded-full border ${isHighlighted ? 'bg-surface border-border shadow-sm' : 'bg-surface-muted border-border/50'}`}>
        <EventIcon type={event.type} status={event.status} />
      </div>

      {/* Card */}
      <div className={`flex-1 pb-6 ${isCurrentAnalysisScope ? '' : 'opacity-80'}`}>
        <div className={`flex flex-col gap-1 p-3.5 rounded-xl border ${isHighlighted ? 'bg-surface border-border/80 shadow-sm' : 'bg-surface/50 border-border/40'}`}>
          <div className="flex items-start justify-between gap-4">
            <div className="flex flex-col gap-0.5">
              <span className="text-[13px] font-semibold text-foreground flex items-center gap-2">
                {event.title}
                {event.type === 'DERIVED_ANALYSIS_CREATED' && (
                  <span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[9px] uppercase tracking-wider">{t("derived")}</span>
                )}
                {event.type === 'IMPACT_DIFF_AVAILABLE' && (
                  <span className="px-1.5 py-0.5 rounded bg-secondary/10 text-secondary text-[9px] uppercase tracking-wider">{t("diffReady")}</span>
                )}
              </span>
              <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                <span>{formatDate(event.createdAt)}</span>
                {event.actor && (
                  <>
                    <span className="w-1 h-1 rounded-full bg-border" />
                    <span>{t("byActor", { actor: event.actor })}</span>
                  </>
                )}
              </div>
            </div>

            {/* Links to entities if appropriate */}
            {event.analysisId && isAnalysisRootEvent && !isCurrentAnalysisScope && (
              <a 
                href={`/analyses/${event.analysisId}`}
                className="shrink-0 flex items-center justify-center w-7 h-7 rounded-md bg-surface-muted hover:bg-muted border border-border/50 text-muted-foreground hover:text-foreground transition-colors"
                title={t("viewAnalysis")}
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>

          {content}
        </div>
      </div>
    </div>
  )
}

export function AnalysisLineageTab({ analysisId }: { analysisId: string }) {
  const t = useTranslations("workspace")
  const { data: lineageData, isLoading } = useAnalysisLineage(analysisId)

  if (isLoading) {
    return (
      <div className="mt-4 max-w-3xl flex flex-col gap-8 pb-12">
        {[1, 2, 3].map(i => (
          <div key={i} className="flex gap-4">
            <Skeleton className="w-8 h-8 rounded-full shrink-0" />
            <Skeleton className="h-24 w-full rounded-xl" />
          </div>
        ))}
      </div>
    )
  }

  if (!lineageData || lineageData.events.length === 0) {
    return (
      <div className="mt-8 flex flex-col items-center justify-center p-12 text-center rounded-xl border border-dashed border-border">
        <GitMerge className="w-8 h-8 text-muted-foreground/50 mb-3" />
        <h3 className="text-sm font-semibold text-foreground">{t("noLineageFound")}</h3>
        <p className="text-xs text-muted-foreground mt-1">{t("noLineageDescription")}</p>
      </div>
    )
  }

  const { rootAnalysisId, currentAnalysisId, depth, events } = lineageData

  return (
    <div className="mt-4 flex flex-col gap-6 max-w-3xl pb-16">
      <div className="flex items-center justify-between p-4 rounded-xl border border-border/40 bg-surface/30">
        <div className="flex flex-col gap-1">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("auditTrail")}</h3>
          <p className="text-[13px] text-foreground">
            {depth === 0 ? t("baselineAnalysis") : t("derivedAnalysisDepth", { depth })}
          </p>
        </div>
        <div className="flex items-center gap-x-2 text-[11px] text-muted-foreground">
          <span>{t("rootBaseline")}:</span>
          <code className="text-foreground bg-surface border border-border px-1.5 py-0.5 rounded text-[10px]">{rootAnalysisId.slice(0, 8)}</code>
        </div>
      </div>

      <div className="flex flex-col pl-2">
        {events.map((event, i) => (
          <LineageEventCard 
            key={`${event.id}-${i}`} 
            event={event} 
            isCurrentAnalysis={event.analysisId === currentAnalysisId}
          />
        ))}
      </div>
    </div>
  )
}
