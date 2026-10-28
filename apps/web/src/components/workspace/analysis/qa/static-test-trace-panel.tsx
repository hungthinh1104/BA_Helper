"use client"

import { useMemo, useState } from 'react';
import type { QaTraceEdge } from '@ba-helper/contracts';
import { Button } from '@/components/ui/button';
import { useQaCoverage } from '@/hooks/api/use-qa-coverage';
import { testTraceLabels } from '@/lib/i18n/test-trace-labels';
import type { SupportedLocale } from '@/lib/i18n/status-labels';
import { TestTraceView } from './test-trace-view';
import { TestTraceEvidenceSheet } from './test-trace-evidence-sheet';

export function StaticTestTracePanel({ analysisId, snapshotId, commitSha, analyzerVersion, artifactKeys, requirementTitle, requirementSummary, locale }: {
  analysisId: string; snapshotId: string; commitSha: string; analyzerVersion: string; artifactKeys: string[];
  requirementTitle?: string; requirementSummary?: string; locale: SupportedLocale;
}) {
  const query = useQaCoverage(analysisId, { enabled: artifactKeys.length > 0 });
  const [selected, setSelected] = useState<QaTraceEdge | null>(null);
  const labels = testTraceLabels[locale];
  const data = query.data;
  const selectedItems = useMemo(() => data?.items.filter(item => item.artifactKey && artifactKeys.includes(item.artifactKey)) ?? [], [artifactKeys, data?.items]);
  // The API response covers all impacted artifacts; this panel is scoped to the selected one.
  // Keep global limitation codes, but never present another artifact's exclusion as this item's.
  const selectedExclusions = useMemo(() => data?.traceContext?.excludedImpactedArtifacts?.filter(
    item => item.artifactKey !== undefined && artifactKeys.includes(item.artifactKey),
  ) ?? [], [artifactKeys, data?.traceContext?.excludedImpactedArtifacts]);
  if (query.isLoading) return <p role="status" className="text-xs text-muted-foreground">{labels.loading}</p>;
  if (query.error || !data) return <div role="alert" className="grid gap-2 rounded border border-border/50 p-3 text-xs">
    <p>{labels.error}</p><Button type="button" variant="outline" onClick={() => { void query.refetch(); }}>{labels.retry}</Button>
  </div>;
  const context = data.traceContext;
  if (data.analysisId !== analysisId || data.snapshotId !== snapshotId || context &&
    (context.commitSha !== commitSha || context.analyzerVersion !== analyzerVersion)) return <p role="alert" className="text-xs text-warning">{labels.mismatch}</p>;
  return <>
    <TestTraceView coverage={{ ...data, items: selectedItems,
      traceContext: context ? { ...context, excludedImpactedArtifacts: selectedExclusions } : undefined,
    }} locale={locale} requirementTitle={requirementTitle}
      requirementSummary={requirementSummary} onInspectEvidence={setSelected} />
    <TestTraceEvidenceSheet analysisId={analysisId} snapshotId={snapshotId} commitSha={commitSha} edge={selected} onClose={() => setSelected(null)} locale={locale} />
  </>;
}
