import * as React from 'react';
import { EventLogDto } from '@ba-helper/contracts';
import { format } from 'date-fns';
import { Bot, CheckCircle2, CircleDashed, XCircle, User, Activity } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

export interface AuditTimelineProps {
  title: string;
  events: EventLogDto[];
  isLoading?: boolean;
  emptyMessage?: string;
  className?: string;
}

const EVENT_LABELS: Record<string, string> = {
  SCAN_STARTED: 'Scan started',
  SCAN_ARTIFACTS_EXTRACTED: 'Artifacts extracted',
  SCAN_DEPENDENCY_EDGES_PERSISTED: 'Dependency edges persisted',
  SCAN_COMPLETED: 'Scan completed',
  SCAN_FAILED: 'Scan failed',
  ANALYSIS_STARTED: 'Analysis started',
  ANALYSIS_EVIDENCE_RETRIEVED: 'Evidence retrieved',
  ANALYSIS_AI_REASONING_COMPLETED: 'AI reasoning completed',
  ANALYSIS_WAITING_FOR_REVIEW: 'Waiting for review',
  ANALYSIS_FAILED: 'Analysis failed',
};

const getEventIcon = (eventType: string) => {
  if (eventType.includes('FAILED')) return <XCircle className="w-4 h-4 text-danger" />;
  if (eventType.includes('COMPLETED') || eventType.includes('WAITING_FOR_REVIEW')) return <CheckCircle2 className="w-4 h-4 text-success" />;
  if (eventType.includes('STARTED')) return <CircleDashed className="w-4 h-4 text-muted-foreground" />;
  return <Activity className="w-4 h-4 text-muted-foreground" />;
};

const formatMetadataKey = (key: string) => {
  return key.replace(/([A-Z])/g, ' $1').replace(/^./, (str) => str.toUpperCase());
};

export function AuditTimeline({
  title,
  events,
  isLoading,
  emptyMessage = 'No activity recorded.',
  className,
}: AuditTimelineProps) {
  if (isLoading) {
    return (
      <div className={cn("flex flex-col gap-4", className)}>
        <h3 className="text-[13px] font-semibold text-foreground uppercase tracking-wider">{title}</h3>
        <div className="flex flex-col gap-4">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      </div>
    );
  }

  if (!events || events.length === 0) {
    return (
      <div className={cn("flex flex-col gap-2", className)}>
        <h3 className="text-[13px] font-semibold text-foreground uppercase tracking-wider">{title}</h3>
        <p className="text-[13px] text-muted-foreground bg-surface/50 p-4 rounded-lg border border-border/40">
          {emptyMessage}
        </p>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <h3 className="text-[13px] font-semibold text-foreground uppercase tracking-wider">{title}</h3>
      <div className="flex flex-col border border-border/40 rounded-xl bg-surface/30 overflow-hidden">
        {events.map((event, index) => {
          const isFailed = event.eventType.includes('FAILED');
          const label = EVENT_LABELS[event.eventType] || event.eventType;
          const time = new Date(event.createdAt);
          const hasMetadata = Object.keys(event.metadata).length > 0;

          return (
            <div
              key={event.id}
              className={cn(
                "group relative flex gap-4 p-4 text-[13px]",
                index !== events.length - 1 && "border-b border-border/40",
                isFailed && "bg-danger/5"
              )}
            >
              {/* Timeline dot/icon */}
              <div className="relative mt-0.5 shrink-0">
                {getEventIcon(event.eventType)}
                {index !== events.length - 1 && (
                  <div className="absolute top-5 bottom-[-20px] left-1/2 w-px bg-border/60 -translate-x-1/2" />
                )}
              </div>

              {/* Content */}
              <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex flex-col">
                    <span className={cn(
                      "font-medium",
                      isFailed ? "text-danger" : "text-foreground"
                    )}>
                      {label}
                    </span>
                    <span className="flex items-center gap-1.5 text-[12px] text-muted-foreground mt-0.5">
                      {event.actorType === 'SYSTEM' ? (
                        <><Bot className="w-3 h-3" /> System Worker</>
                      ) : (
                        <><User className="w-3 h-3" /> {event.actorName || 'User'}</>
                      )}
                      {event.triggeredByUserId && (
                        <span>(Triggered by User)</span>
                      )}
                    </span>
                  </div>
                  <span className="text-[12px] text-muted-foreground shrink-0 tabular-nums">
                    {format(time, 'MMM d, HH:mm:ss')}
                  </span>
                </div>

                {/* Metadata Chips */}
                {hasMetadata && (
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {Object.entries(event.metadata).map(([key, value]) => {
                      if (value === null || value === undefined) return null;
                      if (key === 'errorMessage') {
                        return (
                          <div key={key} className="w-full mt-1 text-[12px] text-danger/80 break-words font-mono bg-danger/10 p-1.5 rounded">
                            {String(value)}
                          </div>
                        );
                      }
                      return (
                        <span
                          key={key}
                          className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-secondary text-secondary-foreground text-[11px] font-mono"
                        >
                          <span className="text-muted-foreground mr-1">{formatMetadataKey(key)}:</span>
                          {typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value)}
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
