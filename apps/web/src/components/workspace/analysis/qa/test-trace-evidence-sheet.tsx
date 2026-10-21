"use client"

import type { QaTraceEdge } from '@ba-helper/contracts';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { useTestTraceEvidence } from '@/hooks/api/use-test-trace-evidence';
import { testTraceLabels } from '@/lib/i18n/test-trace-labels';
import type { SupportedLocale } from '@/lib/i18n/status-labels';

export function TestTraceEvidenceSheet({ analysisId, snapshotId, commitSha, edge, onClose, locale }: {
  analysisId: string; snapshotId: string; commitSha: string; edge: QaTraceEdge | null; onClose: () => void; locale: SupportedLocale;
}) {
  const query = useTestTraceEvidence(analysisId, edge?.evidenceId);
  const labels = testTraceLabels[locale];
  const data = query.data;
  const matches = data?.snapshotId === snapshotId && data.commitSha === commitSha && data.evidence.id === edge?.evidenceId;
  return <Sheet open={Boolean(edge)} onOpenChange={open => { if (!open) onClose(); }}>
    <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
      <SheetHeader><SheetTitle>{labels.evidence}</SheetTitle><SheetDescription>{labels.notice}</SheetDescription></SheetHeader>
      <div className="grid gap-3 p-4">
        {query.isLoading ? <p role="status">{labels.loading}</p> : query.error || !matches ? <div role="alert">
          <p>{labels.noEvidence}</p><Button type="button" variant="outline" onClick={() => { void query.refetch(); }}>{labels.retry}</Button>
        </div> : <>
          <p className="break-all font-mono text-xs">{data!.evidence.filePath}:{data!.evidence.startLine}–{data!.evidence.endLine}</p>
          <p className="break-all font-mono text-[11px] text-muted-foreground">{commitSha}</p>
          <pre className="overflow-x-auto rounded-md border border-border/50 bg-surface-muted py-2 text-xs"><code className="block">
            {data!.evidence.excerpt.replace(/\r\n/g, '\n').replace(/\n$/, '').split('\n').map((line, index) => {
              const lineNumber = (data!.evidence.startLine ?? 1) + index;
              const referenced = edge?.provenance.locations.some(loc => lineNumber >= loc.startLine && lineNumber <= loc.endLine);
              return <span key={index} className={`flex ${referenced ? 'bg-warning/10' : ''}`} data-reference-line={referenced ? lineNumber : undefined}>
                <span aria-hidden="true" className="w-10 shrink-0 select-none border-r border-border/40 px-2 text-right text-muted-foreground">{lineNumber}</span>
                <span className="whitespace-pre px-2">{line || ' '}</span>
              </span>;
            })}
          </code></pre>
          <code className="break-all text-[11px] text-muted-foreground">{edge?.provenance.evidenceProvenanceKey}</code>
        </>}
      </div>
    </SheetContent>
  </Sheet>;
}
