import { fireEvent, render, screen } from '@testing-library/react';
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

function panel() {
  return render(<StaticTestTracePanel analysisId={traceIds.analysis} snapshotId={traceIds.snapshot}
    commitSha={'a'.repeat(40)} analyzerVersion="analyzer@0.5.0" artifactKeys={['service:refund']} locale="en" />);
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
