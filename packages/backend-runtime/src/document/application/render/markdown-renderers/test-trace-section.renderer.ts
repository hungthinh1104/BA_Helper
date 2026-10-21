import type { ReportTestTraceSnapshot } from '@ba-helper/contracts';
import type { ReportLocale } from '../report-localization';

const escape = (value: string) => value.replace(/[&<>]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[char]!))
  .replace(/([\\`*_[\]{}()|#!])/g, '\\$1').replace(/[\r\n]+/g, ' ');

export function renderTestTraceSection(snapshot: ReportTestTraceSnapshot | null | undefined, locale: ReportLocale): string[] {
  if (!snapshot) return [];
  const { coverage } = snapshot, context = coverage.traceContext;
  const vi = locale === 'vi-VN';
  const statuses = vi ? { COVERED: 'Tham chiếu trực tiếp', INDIRECT_ONLY: 'Đường gọi tĩnh', NO_TEST_FOUND: 'Chưa tìm thấy trong phạm vi đã xét' }
    : { COVERED: 'Direct reference', INDIRECT_ONLY: 'Static call path', NO_TEST_FOUND: 'No reference found in inspected paths' };
  const lines = [`## ${vi ? 'Tham chiếu test tĩnh' : 'Static test references'}`, '',
    vi ? 'Tham chiếu mã nguồn tĩnh. Chưa đo thực thi test hoặc độ bao phủ assertion; dependency có thể được mock.'
      : 'Static source references. No execution or assertion coverage was measured; dependencies may be mocked.', '',
    `- Snapshot: ${escape(coverage.snapshotId)}`,
    `- Commit: ${escape(context.commitSha)}`,
    `- Analyzer: ${escape(context.analyzerVersion)}`,
    `- ${vi ? 'Giới hạn' : 'Limits'}: ${context.limits.maxCallDepth} CALLS; ${context.limits.maxImpactedArtifacts} artifacts; ${context.limits.maxEdges} edges; ${context.limits.maxTracesPerArtifact} cases/artifact.`,
    `- ${vi ? 'Hạn chế đã lưu' : 'Saved limitations'}: ${context.limitations.length ? context.limitations.map(code => `\`${code}\``).join(', ') : '—'}`, ''];
  for (const item of coverage.items) {
    lines.push(`### ${escape(item.artifactLabel)}`, '', statuses[item.status], '');
    for (const test of item.testArtifacts) {
      lines.push(`- ${escape(test.label)} (${escape(test.testCase?.modifier ?? '')})`);
      if (!test.trace) continue;
      lines.push(`  - ${test.trace.artifacts.map(a => escape(a.label)).join(' → ')}`);
      for (const edge of test.trace.edges) {
        const locations = edge.provenance.locations.map(loc => `${loc.sourcePath}:${loc.startLine}-${loc.endLine}`).join(', ');
        lines.push(`  - ${edge.type}: ${escape(locations)}; evidence: ${escape(edge.evidenceId)}; provenance: ${escape(edge.provenance.evidenceProvenanceKey)}`);
        if (edge.provenance.omittedLocationCount) lines.push(`    - ${vi ? 'Vị trí nguồn bổ sung đã lược bớt' : 'Additional source locations omitted'}: ${edge.provenance.omittedLocationCount}`);
      }
    }
    if (item.tracesTruncated) lines.push(vi ? '- Các case bổ sung đã được lược bớt.' : '- Additional case paths were omitted.');
    lines.push('');
  }
  return lines;
}
