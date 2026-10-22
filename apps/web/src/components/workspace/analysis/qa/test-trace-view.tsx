"use client"

import { lazy, memo, Suspense, useMemo, useState } from 'react';
import { ArrowDown } from 'lucide-react';
import type { QaCoverageItem, QaCoverageResponse, QaTestTrace, QaTraceArtifact, QaTraceEdge, TestCaseMetadata } from '@ba-helper/contracts';
import { Button } from '@/components/ui/button';
import { testTraceLabels } from '@/lib/i18n/test-trace-labels';
import type { TestTraceLabels } from '@/lib/i18n/test-trace-labels';
import type { SupportedLocale } from '@/lib/i18n/status-labels';

const TestTraceFlow = lazy(() => import('./test-trace-flow').then(module => ({ default: module.TestTraceFlow })));
type BehaviorClaim = NonNullable<TestCaseMetadata['behaviorEvidence']>[number];

export function TestTraceView({ coverage, locale, saved = false, requirementTitle, requirementSummary, onInspectEvidence }: {
  coverage: QaCoverageResponse; locale: SupportedLocale; saved?: boolean;
  requirementTitle?: string; requirementSummary?: string;
  onInspectEvidence?: (edge: QaTraceEdge) => void;
}) {
  const labels = testTraceLabels[locale];
  const [visible, setVisible] = useState(20);
  const [visualPathId, setVisualPath] = useState<string | null>(null);
  const context = coverage.traceContext;
  const visibleItems = useMemo(() => coverage.items.slice(0, visible), [coverage.items, visible]);

  return <section className="grid min-w-0 gap-3 rounded-lg border border-border/50 bg-surface p-3" aria-label={saved ? labels.savedTitle : labels.title}>
    <h3 className="text-sm font-semibold">{saved ? labels.savedTitle : labels.title}</h3>
    <p className="text-xs leading-relaxed text-muted-foreground">{labels.notice}</p>
    {!context ? <p className="text-xs text-muted-foreground">{labels.unavailable}</p> : <>
      <TraceContext coverage={coverage} labels={labels} />
      {coverage.items.length === 0 ? <p className="text-xs text-muted-foreground">{labels.notInspected}</p> : null}
      {visibleItems.map(item => <TestTraceItem key={item.artifactId} item={item} commitSha={context.commitSha} labels={labels} locale={locale}
        visualPathId={visualPathId} onToggleVisualPath={setVisualPath} requirementTitle={requirementTitle}
        requirementSummary={requirementSummary} onInspectEvidence={onInspectEvidence} />)}
      {visible < coverage.items.length ? <Button type="button" variant="outline" onClick={() => setVisible(value => value + 20)}>{labels.more}</Button> : null}
    </>}
  </section>;
}

function TraceContext({ coverage, labels }: { coverage: QaCoverageResponse; labels: TestTraceLabels }) {
  const context = coverage.traceContext!;
  return <>
    <p className="break-all font-mono text-[11px] text-muted-foreground">{context.commitSha} · {context.analyzerVersion}</p>
    <ul className="grid gap-1 text-xs text-warning" aria-label={labels.limits}>
      {context.limitations.map(code => <li key={code}>{labels.limitations[code]}</li>)}
    </ul>
    <p className="text-[11px] text-muted-foreground">{labels.limits}: {context.limits.maxCallDepth} {labels.calls} · {context.limits.maxImpactedArtifacts} {labels.artifacts} · {context.limits.maxEdges} {labels.edges} · {context.limits.maxTracesPerArtifact} {labels.cases}</p>
  </>;
}

const TestTraceItem = memo(function TestTraceItem({ item, commitSha, labels, visualPathId, onToggleVisualPath,
  requirementTitle, requirementSummary, onInspectEvidence, locale }: {
  item: QaCoverageItem; commitSha: string; labels: TestTraceLabels; locale: SupportedLocale; visualPathId: string | null;
  onToggleVisualPath: (testId: string | null) => void; requirementTitle?: string; requirementSummary?: string;
  onInspectEvidence?: (edge: QaTraceEdge) => void;
}) {
  const itemStatus = item.status === 'COVERED' ? labels.itemDirectSummary
    : item.status === 'INDIRECT_ONLY' ? labels.itemIndirectSummary : labels.missing;
  return <article className="grid min-w-0 gap-3 border-t border-border/50 pt-3">
    <header>
      <h4 className="break-words font-mono text-xs font-semibold">{item.artifactLabel}</h4>
      <p className="mt-1 text-xs text-muted-foreground">{itemStatus}</p>
    </header>
    {item.testArtifacts.length === 0 ? <p className="text-xs text-muted-foreground">{labels.missing}</p> : null}
    {item.testArtifacts.map(test => <TestCaseTrace key={test.id} itemLabel={item.artifactLabel} test={test}
      commitSha={commitSha} labels={labels} locale={locale} visualPathId={visualPathId} onToggleVisualPath={onToggleVisualPath}
      requirementTitle={requirementTitle} requirementSummary={requirementSummary} onInspectEvidence={onInspectEvidence} />)}
    {item.tracesTruncated ? <p className="text-xs text-warning">{labels.omitted}</p> : null}
  </article>;
});

const TestCaseTrace = memo(function TestCaseTrace({ itemLabel, test, commitSha, labels, visualPathId, onToggleVisualPath,
  requirementTitle, requirementSummary, onInspectEvidence, locale }: {
  itemLabel: string; test: QaCoverageItem['testArtifacts'][number]; commitSha: string;
  labels: TestTraceLabels; locale: SupportedLocale; visualPathId: string | null; onToggleVisualPath: (testId: string | null) => void;
  requirementTitle?: string; requirementSummary?: string; onInspectEvidence?: (edge: QaTraceEdge) => void;
}) {
  const relationLabel = test.trace?.relation === 'DIRECT_REFERENCE' ? labels.direct : labels.indirect;
  return <div className="grid min-w-0 gap-2 rounded-md border border-border/50 bg-background p-3">
    <header>
      <p className="text-[11px] text-muted-foreground">{test.testCase?.suitePath.join(' › ')}</p>
      <h5 className="break-words text-xs font-semibold">{test.testCase?.title ?? test.label}</h5>
      {test.trace ? <p className="mt-1 text-[11px] text-muted-foreground">{relationLabel}</p> : null}
      {test.testCase ? <span className="font-mono text-[10px] text-muted-foreground">Jest · {test.testCase.modifier}</span> : null}
      {test.testCase?.parameterized ? <p className="mt-1 text-xs text-muted-foreground">{labels.parameterized}</p> : null}
    </header>
    {test.trace ? <TracePath trace={test.trace} itemLabel={itemLabel} labels={labels}
      expanded={visualPathId === test.id} onToggle={() => onToggleVisualPath(visualPathId === test.id ? null : test.id)}
      requirementTitle={requirementTitle} requirementSummary={requirementSummary} onInspectEvidence={onInspectEvidence} />
      : <p className="text-xs text-warning">{labels.unresolvedTrace}</p>}
    {test.testCase ? <BehaviorDeclarations behaviorEvidence={test.testCase.behaviorEvidence} commitSha={commitSha} locale={locale} /> : null}
  </div>;
});

function TracePath({ trace, itemLabel, labels, expanded, onToggle, requirementTitle, requirementSummary,
  onInspectEvidence }: {
  trace: QaTestTrace; itemLabel: string; labels: TestTraceLabels; expanded: boolean;
  onToggle: () => void; requirementTitle?: string; requirementSummary?: string; onInspectEvidence?: (edge: QaTraceEdge) => void;
}) {
  const relationLabel = trace.relation === 'DIRECT_REFERENCE' ? labels.direct : labels.indirect;
  return <>
    <ol className="grid min-w-0 gap-2" aria-label={relationLabel}>
      {trace.artifacts.map((artifact, index) => <TraceArtifactStep key={artifact.id} artifact={artifact}
        edge={trace.edges[index]} labels={labels} onInspectEvidence={onInspectEvidence} />)}
    </ol>
    <Button type="button" variant="outline" size="sm" className="w-fit" aria-expanded={expanded} onClick={onToggle}>
      {expanded ? labels.hideVisualPath : labels.showVisualPath}
    </Button>
    {expanded ? <Suspense fallback={<p role="status" className="text-xs text-muted-foreground">{labels.flowLoading}</p>}>
      <TestTraceFlow trace={trace} requirementTitle={requirementTitle} requirementSummary={requirementSummary}
        impactLabel={itemLabel} labels={labels} />
    </Suspense> : null}
  </>;
}

function TraceArtifactStep({ artifact, edge, labels, onInspectEvidence }: {
  artifact: QaTraceArtifact; edge: QaTraceEdge | undefined; labels: TestTraceLabels;
  onInspectEvidence?: (edge: QaTraceEdge) => void;
}) {
  return <li className="min-w-0">
    <p className="break-words rounded border border-border/40 bg-surface px-2 py-1.5 font-mono text-[11px]">{artifact.label}</p>
    {edge ? <TraceEdgeEvidence edge={edge} labels={labels} onInspectEvidence={onInspectEvidence} /> : null}
  </li>;
}

function TraceEdgeEvidence({ edge, labels, onInspectEvidence }: {
  edge: QaTraceEdge; labels: TestTraceLabels; onInspectEvidence?: (edge: QaTraceEdge) => void;
}) {
  return <div className="grid gap-1 py-1 pl-2 text-[11px] text-muted-foreground">
    <span className="inline-flex items-center gap-1"><ArrowDown className="size-3" aria-hidden="true" />{edge.type === 'TESTS' ? labels.testReference : labels.calls}</span>
    {edge.provenance.locations.map((loc, index) => <code key={index} className="break-all">{loc.sourcePath}:{loc.startLine}{loc.endLine !== loc.startLine ? `–${loc.endLine}` : ''}</code>)}
    {edge.provenance.omittedLocationCount ? <span>{labels.omittedLocations.replace('{count}', String(edge.provenance.omittedLocationCount))}</span> : null}
    {onInspectEvidence ? <Button type="button" variant="outline" size="sm" className="w-fit max-w-full whitespace-normal" onClick={() => onInspectEvidence(edge)}>{labels.inspect}</Button>
      : <code className="break-all">{labels.evidence}: {edge.evidenceId}</code>}
  </div>;
}

function BehaviorDeclarations({ behaviorEvidence, commitSha, locale }: {
  behaviorEvidence: BehaviorClaim[] | undefined; commitSha: string; locale: SupportedLocale;
}) {
  const labels = testTraceLabels[locale];
  const [expanded, setExpanded] = useState(false);
  const [visible, setVisible] = useState(8);
  const claims = behaviorEvidence ?? [];
  const verifiedClaims = useMemo(() => claims.filter(claim => claim.commitSha === commitSha), [claims, commitSha]);
  const visibleClaims = useMemo(() => verifiedClaims.slice(0, visible), [verifiedClaims, visible]);
  const hiddenCount = claims.length - verifiedClaims.length;

  return <section className="grid gap-2 border-t border-border/40 pt-2">
    <Button type="button" variant="ghost" size="sm" className="w-fit" aria-expanded={expanded}
      onClick={() => setExpanded(value => !value)}>{expanded ? labels.hideBehavior : labels.behavior}</Button>
    {expanded ? <div className="grid gap-2">
      <p className="text-[11px] text-muted-foreground">{labels.runtimeUnavailable}</p>
      {claims.length === 0 ? <p className="text-xs text-muted-foreground">{labels.behaviorUnavailable}</p> : null}
      {hiddenCount > 0 ? <p className="text-xs text-warning">{labels.unverifiedBehavior}</p> : null}
      {visibleClaims.map((claim, index) => <BehaviorClaimView key={`${claim.evidenceProvenanceKey}:${claim.sourceLocation.startOffset}:${index}`} claim={claim} labels={labels} />)}
      {visible < verifiedClaims.length ? <Button type="button" variant="outline" size="sm" className="w-fit" onClick={() => setVisible(value => value + 8)}>{labels.showMoreBehavior}</Button> : null}
    </div> : null}
  </section>;
}

function BehaviorClaimView({ claim, labels }: { claim: BehaviorClaim; labels: TestTraceLabels }) {
  return <details className="min-w-0 rounded border border-border/40 p-2">
    <summary className="cursor-pointer break-words text-xs font-medium">{labels.behaviorKinds[claim.kind]} · {labels.declared}</summary>
    <div className="mt-2 grid min-w-0 gap-2">
      <p className="break-all font-mono text-[10px] text-muted-foreground">{labels.sourceLocation}: {claim.sourceLocation.relativePath}:{claim.sourceLocation.startLine}:{claim.sourceLocation.startColumn}–{claim.sourceLocation.endLine}:{claim.sourceLocation.endColumn}</p>
      <pre className="overflow-x-auto rounded bg-surface-muted p-2 text-xs"><code><mark className="rounded bg-warning/20 px-0.5 text-foreground">{claim.sourceText}</mark></code></pre>
      <p className="break-all font-mono text-[10px] text-muted-foreground">{labels.sourceCommit}: {claim.commitSha}</p>
      <p className="break-all font-mono text-[10px] text-muted-foreground">{labels.provenance}: {claim.evidenceProvenanceKey}</p>
    </div>
  </details>;
}
