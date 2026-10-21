import { renderTestTraceSection } from './test-trace-section.renderer';
import { freezeReportTestTrace, readReportTestTrace } from '../../../domain/report-test-trace.snapshot';
import { staticTestTraceFixture, traceIds } from '../../../../../../../tests/fixtures/static-test-trace.fixture';

describe('saved test trace report section', () => {
  it('freezes and renders the parameterized declaration caveat independently of live metadata', () => {
    const coverage = staticTestTraceFixture();
    coverage.items[0].testArtifacts[0].testCase!.parameterized = true;
    const saved = freezeReportTestTrace(coverage, new Set([traceIds.code]));
    coverage.items[0].testArtifacts[0].testCase!.parameterized = false;
    expect(saved.coverage.items[0].testArtifacts[0].testCase?.parameterized).toBe(true);
    expect(renderTestTraceSection(saved, 'en').join('\n')).toContain('Parameterized source declaration; data rows are not expanded.');
    expect(renderTestTraceSection(saved, 'vi-VN').join('\n')).toContain('Khai báo test theo bảng; chưa bung các dòng dữ liệu.');
  });

  it('renders frozen provenance, source paths and limitations', () => {
    const coverage = staticTestTraceFixture(); coverage.traceContext!.limitations = ['TRACE_SAMPLE_LIMIT'];
    coverage.items[0].testArtifacts[0].trace!.edges[0].provenance.omittedLocationCount = 2;
    const saved = freezeReportTestTrace(coverage, new Set([traceIds.code]));
    const rendered = renderTestTraceSection(saved, 'en').join('\n');
    expect(rendered).toContain('Static test references');
    expect(rendered).toContain('No execution or assertion coverage');
    expect(rendered).toContain('src/payment.spec.ts:5');
    expect(rendered).toContain(traceIds.evidence);
    expect(rendered).toContain('TRACE_SAMPLE_LIMIT');
    expect(rendered).toContain('Additional source locations omitted: 2');
    coverage.items[0].artifactLabel = 'changed live label';
    expect(renderTestTraceSection(saved, 'en').join('\n')).not.toContain('changed live label');
  });

  it('leaves historical snapshots without saved trace data unchanged', () => {
    expect(renderTestTraceSection(null, 'en')).toEqual([]);
    expect(readReportTestTrace(undefined, { analysisId: 'legacy' })).toBeNull();
  });

  it('rejects a saved trace from a different immutable snapshot', () => {
    const saved = freezeReportTestTrace(staticTestTraceFixture(), new Set([traceIds.code]));
    expect(() => readReportTestTrace(saved, { analysisId: traceIds.analysis, snapshotId: 'other' })).toThrow();
    expect(() => readReportTestTrace(saved, { analysisId: traceIds.analysis, commitSha: 'other' })).toThrow();
  });

  it('escapes repository labels and paths in exported Markdown', () => {
    const coverage = staticTestTraceFixture(); coverage.items[0].artifactLabel = '[execute](javascript:evil) | <script>';
    const saved = freezeReportTestTrace(coverage, new Set([traceIds.code]));
    const rendered = renderTestTraceSection(saved, 'vi-VN').join('\n');
    expect(rendered).toContain('Tham chiếu test tĩnh');
    expect(rendered).not.toContain('[execute](javascript:evil)');
    expect(rendered).not.toContain('<script>');
  });
});
