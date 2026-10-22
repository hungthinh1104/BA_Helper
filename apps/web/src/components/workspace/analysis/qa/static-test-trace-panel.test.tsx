import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { StaticTestTracePanel } from './static-test-trace-panel';
import { TestTraceView } from './test-trace-view';
import { staticTestTraceFixture, traceIds } from '../../../../../../../tests/fixtures/static-test-trace.fixture';

let coverage: Record<string, unknown>;
const refetch = jest.fn();
jest.mock('@/hooks/api/use-qa-coverage', () => ({ useQaCoverage: () => coverage }));
jest.mock('@/hooks/api/use-test-trace-evidence', () => ({ useTestTraceEvidence: () => ({
  data: { snapshotId: traceIds.snapshot, commitSha: 'a'.repeat(40), evidence: {
    id: traceIds.evidence, filePath: 'src/payment.spec.ts', startLine: 3, endLine: 8, excerpt: 'case start\nsetup\nservice.refund();',
  } }, isLoading: false, error: null,
}) }));
jest.mock('./test-trace-flow', () => ({
  TestTraceFlow: ({ requirementTitle }: { requirementTitle?: string }) => <div data-testid="test-trace-flow">{requirementTitle}</div>,
}));

function panel() {
  return render(<StaticTestTracePanel analysisId={traceIds.analysis} snapshotId={traceIds.snapshot}
    commitSha={'a'.repeat(40)} analyzerVersion="analyzer@0.5.0" artifactKeys={['service:refund']}
    requirementTitle="Cancel paid booking" requirementSummary="Refund the paid booking after cancellation." locale="en" />);
}

function withBehaviorEvidence() {
  const data = staticTestTraceFixture();
  const testCase = data.items[0].testArtifacts[0].testCase!;
  const kinds = [
    ['SETUP_HOOK', "beforeEach(() => reset())"], ['TEARDOWN_HOOK', "afterEach(() => restore())"],
    ['INPUT', "const bookingId = 'paid-1'"], ['ACTION', 'service.refund(bookingId)'],
    ['ASSERTION', 'expect(refund.status).toBe(200)'], ['MOCK', 'jest.spyOn(gateway, "refund")'],
    ['EXPECTED_OUTCOME', "expect(response.body).toEqual({ refunded: true })"],
  ] as const;
  testCase.behaviorEvidence = kinds.map(([kind, sourceText], index) => ({
    kind, evidenceKind: 'STATIC_DECLARATION' as const, sourceText,
    sourceLocation: { relativePath: 'src/payment.spec.ts', startOffset: index * 10, endOffset: index * 10 + sourceText.length,
      startLine: index + 2, startColumn: 1, endLine: index + 2, endColumn: sourceText.length + 1 },
    commitSha: 'a'.repeat(40), evidenceProvenanceKey: `snapshot:${traceIds.snapshot}:claim:${index}`,
  }));
  testCase.behaviorEvidence.push({
    kind: 'ASSERTION', evidenceKind: 'STATIC_DECLARATION', sourceText: 'stale snapshot claim',
    sourceLocation: { relativePath: 'src/payment.spec.ts', startOffset: 200, endOffset: 220, startLine: 20, startColumn: 1, endLine: 20, endColumn: 21 },
    commitSha: 'b'.repeat(40), evidenceProvenanceKey: 'foreign-snapshot:claim',
  });
  return data;
}

describe('selected item static test trace', () => {
  beforeEach(() => { coverage = { data: staticTestTraceFixture(), isLoading: false, error: null, refetch }; });

  it('labels parameterized source declarations in live and saved traces', () => {
    const data = staticTestTraceFixture();
    data.items[0].testArtifacts[0].testCase!.parameterized = true;
    const view = render(<TestTraceView coverage={data} locale="en" />);
    expect(screen.getByText('Parameterized source declaration; data rows are not expanded.')).toBeInTheDocument();
    view.rerender(<TestTraceView coverage={data} locale="vi-VN" saved />);
    expect(screen.getByText('Khai báo test theo bảng; chưa bung các dòng dữ liệu.')).toBeInTheDocument();
    view.rerender(<TestTraceView coverage={data} locale="ja-JP" saved />);
    expect(screen.getByText('パラメータ化されたソース宣言です。データ行は展開していません。')).toBeInTheDocument();
  });

  it('shows case identity, ordered code path and source evidence without relying on the display graph', () => {
    (coverage.data as ReturnType<typeof staticTestTraceFixture>).items[0].testArtifacts[0].trace!.edges[0].provenance.omittedLocationCount = 2;
    panel();
    expect(screen.getByText('Direct reference')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'refunds once' })).toBeInTheDocument();
    expect(screen.getByText(/assertion coverage.*not been measured/i)).toBeInTheDocument();
    expect(screen.getByText('Additional source locations omitted: 2')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Inspect source reference/i }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('service.refund();')).toBeInTheDocument();
    expect(screen.getByText('service.refund();').closest('[data-reference-line]')).toHaveAttribute('data-reference-line', '5');
  });

  it('lazily opens the focused path with requirement context', async () => {
    panel();
    expect(screen.queryByTestId('test-trace-flow')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Show visual path' }));
    await waitFor(() => expect(screen.getByTestId('test-trace-flow')).toHaveTextContent('Cancel paid booking'));
    expect(screen.getByRole('button', { name: 'Hide visual path' })).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Hide visual path' }));
    expect(screen.queryByTestId('test-trace-flow')).not.toBeInTheDocument();
  });

  it('distinguishes each indirect path from the impact item direct-path summary', () => {
    const data = staticTestTraceFixture();
    const test = data.items[0].testArtifacts[0];
    const trace = test.trace!;
    const target = trace.artifacts[1];
    const middle = { ...target, id: 'refund-wrapper', artifactKey: 'service:refund-wrapper', label: 'PaymentService.refund wrapper' };
    trace.relation = 'CALL_PATH';
    trace.artifacts.splice(1, 0, middle);
    trace.edges[0] = { ...trace.edges[0], targetArtifactId: middle.id };
    trace.edges.push({ ...trace.edges[0], edgeId: 'edge-call', sourceArtifactId: middle.id, targetArtifactId: target.id, type: 'CALLS' });
    data.items[0].status = 'COVERED';

    render(<TestTraceView coverage={data} locale="en" />);
    expect(screen.getByText('At least one direct test path was found')).toBeInTheDocument();
    expect(screen.getByText('Static call path')).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Static call path' })).toBeInTheDocument();
  });

  it('shows unresolved relationships as uncertainty instead of a missing-test conclusion', () => {
    const data = staticTestTraceFixture();
    data.items[0].testArtifacts[0].trace = undefined;
    coverage = { data, isLoading: false, error: null, refetch };
    panel();
    expect(screen.getByText('The test-to-code source relationship could not be resolved.')).toBeInTheDocument();
    expect(screen.queryByText('No reference found in inspected paths')).not.toBeInTheDocument();
  });

  it('paginates large trace responses before mounting more item paths', () => {
    const data = staticTestTraceFixture();
    const item = data.items[0];
    data.items = Array.from({ length: 25 }, (_, index) => ({ ...item, artifactId: `impact-${index}`, artifactKey: `service:refund:${index}` }));
    render(<TestTraceView coverage={data} locale="en" />);
    expect(screen.getAllByRole('article')).toHaveLength(20);
    fireEvent.click(screen.getByRole('button', { name: 'Show more artifacts' }));
    expect(screen.getAllByRole('article')).toHaveLength(25);
  });

  it('expands static setup, input, action, assertion, mock, and outcome claims with exact source context', () => {
    coverage = { data: withBehaviorEvidence(), isLoading: false, error: null, refetch };
    panel();
    fireEvent.click(screen.getByRole('button', { name: 'Declared test behavior' }));
    expect(screen.getByText('No runtime observations recorded')).toBeInTheDocument();
    expect(screen.getByText('Some declarations do not match this snapshot and were hidden.')).toBeInTheDocument();
    expect(screen.queryByText('stale snapshot claim')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('Assertion declaration · Declared in source'));
    expect(screen.getByText('expect(refund.status).toBe(200)')).toBeInTheDocument();
    expect(screen.getByText(/src\/payment.spec.ts:6:1–6:32/)).toBeInTheDocument();
    expect(screen.getByText(`Source commit: ${'a'.repeat(40)}`)).toBeInTheDocument();
    expect(screen.getByText('Evidence provenance: snapshot:00000000-0000-4000-8000-000000000005:claim:4')).toBeInTheDocument();
    expect(screen.getByText('Setup hook · Declared in source')).toBeInTheDocument();
    expect(screen.getByText('Teardown hook · Declared in source')).toBeInTheDocument();
    expect(screen.getByText('Input declaration · Declared in source')).toBeInTheDocument();
    expect(screen.getByText('Action call · Declared in source')).toBeInTheDocument();
    expect(screen.getByText('Mock declaration · Declared in source')).toBeInTheDocument();
    expect(screen.getByText('Expected outcome declaration · Declared in source')).toBeInTheDocument();
  });

  it('keeps loading and failure separate from a missing test relationship', () => {
    coverage = { isLoading: true, refetch };
    const view = panel();
    expect(screen.getByRole('status')).toHaveTextContent(/Loading/i);
    expect(screen.queryByText('No reference found in inspected paths')).not.toBeInTheDocument();
    coverage = { error: new Error('offline'), isLoading: false, refetch };
    view.rerender(<StaticTestTracePanel analysisId={traceIds.analysis} snapshotId={traceIds.snapshot}
      commitSha={'a'.repeat(40)} analyzerVersion="analyzer@0.5.0" artifactKeys={['service:refund']} locale="en" />);
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(refetch).toHaveBeenCalled();
  });

  it('exposes truncation and treats an uninspected row as unavailable', () => {
    const data = staticTestTraceFixture(); data.items = []; data.traceContext!.limitations = ['IMPACTED_ARTIFACT_LIMIT'];
    coverage = { data, isLoading: false, refetch };
    panel();
    expect(screen.getByText(/impacted artifact limit/i)).toBeInTheDocument();
    expect(screen.getByText(/not included in the inspected results/i)).toBeInTheDocument();
  });

  it('does not display a trace from another snapshot', () => {
    const data = staticTestTraceFixture(); data.snapshotId = 'foreign'; coverage = { data, refetch };
    panel();
    expect(screen.getByRole('alert')).toHaveTextContent(/another snapshot/i);
    expect(screen.queryByText('refunds once')).not.toBeInTheDocument();
  });

  it('renders frozen report data with no live evidence action', () => {
    render(<TestTraceView coverage={staticTestTraceFixture()} locale="vi-VN" saved />);
    expect(screen.getByText('Tham chiếu test đã lưu')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Inspect/ })).not.toBeInTheDocument();
    expect(screen.getByText(/src\/payment.spec.ts:5/)).toBeInTheDocument();
  });
});
