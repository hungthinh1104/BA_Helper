"use client"

import { useState } from 'react';
import { ArrowDown } from 'lucide-react';
import type { QaCoverageResponse, QaTraceEdge } from '@ba-helper/contracts';
import { Button } from '@/components/ui/button';
import { testTraceLabels } from '@/lib/i18n/test-trace-labels';
import type { SupportedLocale } from '@/lib/i18n/status-labels';

export function TestTraceView({ coverage, locale, saved = false, onInspectEvidence }: {
  coverage: QaCoverageResponse; locale: SupportedLocale; saved?: boolean;
  onInspectEvidence?: (edge: QaTraceEdge) => void;
}) {
  const labels = testTraceLabels[locale];
  const [visible, setVisible] = useState(20);
  const context = coverage.traceContext;
  const statuses = { COVERED: labels.direct, INDIRECT_ONLY: labels.indirect, NO_TEST_FOUND: labels.missing };
  return (
    <section className="grid min-w-0 gap-3 rounded-lg border border-border/50 bg-surface p-3" aria-label={saved ? labels.savedTitle : labels.title}>
      <h3 className="text-sm font-semibold">{saved ? labels.savedTitle : labels.title}</h3>
      <p className="text-xs leading-relaxed text-muted-foreground">{labels.notice}</p>
      {!context ? <p className="text-xs text-muted-foreground">{labels.unavailable}</p> : <>
        <p className="break-all font-mono text-[11px] text-muted-foreground">{context.commitSha} · {context.analyzerVersion}</p>
        <ul className="grid gap-1 text-xs text-warning" aria-label={labels.limits}>
          {context.limitations.map(code => <li key={code}>{labels.limitations[code]}</li>)}
        </ul>
        <p className="text-[11px] text-muted-foreground">{labels.limits}: {context.limits.maxCallDepth} {labels.calls} · {context.limits.maxImpactedArtifacts} {labels.artifacts} · {context.limits.maxEdges} {labels.edges} · {context.limits.maxTracesPerArtifact} {labels.cases}</p>
        {coverage.items.length === 0 ? <p className="text-xs text-muted-foreground">{labels.notInspected}</p> : null}
        {coverage.items.slice(0, visible).map(item => <article key={item.artifactId} className="grid min-w-0 gap-3 border-t border-border/50 pt-3">
          <div><h4 className="break-words font-mono text-xs font-semibold">{item.artifactLabel}</h4>
            <p className="mt-1 text-xs text-muted-foreground">{statuses[item.status]}</p></div>
          {item.testArtifacts.map(test => <div key={test.id} className="grid min-w-0 gap-2 rounded-md border border-border/50 bg-background p-3">
            <div><p className="text-[11px] text-muted-foreground">{test.testCase?.suitePath.join(' › ')}</p>
              <h5 className="break-words text-xs font-semibold">{test.testCase?.title ?? test.label}</h5>
              {test.testCase ? <span className="font-mono text-[10px] text-muted-foreground">Jest · {test.testCase.modifier}</span> : null}</div>
            {test.trace ? <ol className="grid min-w-0 gap-2" aria-label={statuses[item.status]}>
              {test.trace.artifacts.map((artifact, index) => {
                const edge = test.trace!.edges[index];
                return <li key={artifact.id} className="min-w-0">
                  <p className="break-words rounded border border-border/40 bg-surface px-2 py-1.5 font-mono text-[11px]">{artifact.label}</p>
                  {edge ? <div className="grid gap-1 py-1 pl-2 text-[11px] text-muted-foreground">
                    <span className="inline-flex items-center gap-1"><ArrowDown className="size-3" aria-hidden="true" />{edge.type === 'TESTS' ? labels.testReference : labels.calls}</span>
                    {edge.provenance.locations.map((loc, i) => <code key={i} className="break-all">{loc.sourcePath}:{loc.startLine}{loc.endLine !== loc.startLine ? `–${loc.endLine}` : ''}</code>)}
                    {edge.provenance.omittedLocationCount ? <span>{labels.omittedLocations.replace('{count}', String(edge.provenance.omittedLocationCount))}</span> : null}
                    {onInspectEvidence ? <Button type="button" variant="outline" size="sm" className="w-fit max-w-full whitespace-normal" onClick={() => onInspectEvidence(edge)}>{labels.inspect}</Button>
                      : <code className="break-all">{labels.evidence}: {edge.evidenceId}</code>}
                  </div> : null}
                </li>;
              })}
            </ol> : <p className="text-xs text-muted-foreground">{labels.unavailable}</p>}
          </div>)}
          {item.tracesTruncated ? <p className="text-xs text-warning">{labels.omitted}</p> : null}
        </article>)}
        {visible < coverage.items.length ? <Button type="button" variant="outline" onClick={() => setVisible(value => value + 20)}>{labels.more}</Button> : null}
      </>}
    </section>
  );
}
