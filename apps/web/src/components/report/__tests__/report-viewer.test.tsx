import { render, screen } from '@testing-library/react';
import { useApprovedReport, useFinalReviewedReport } from '@/hooks/api/use-approved-report';
import { ReportViewer } from '../report-viewer';
import { staticTestTraceFixture } from '../../../../../../tests/fixtures/static-test-trace.fixture';
import { testTraceLabels } from '@/lib/i18n/test-trace-labels';

jest.mock('next-intl', () => ({ useTranslations: () => (key: string) => key, useLocale: () => 'en' }));
jest.mock('@/hooks/api/use-approved-report', () => ({ useApprovedReport: jest.fn(), useFinalReviewedReport: jest.fn() }));
jest.mock('@/hooks/api/use-analyses', () => ({ useAnalysisDetail: () => ({ isLoading: false, data: {
  status: 'COMPLETED', requirement: { revisionTitle: 'Reviewed change' }, snapshot: { commitSha: 'abc' },
} }) }));
jest.mock('../reviewed-snapshot-panel', () => ({ ReviewedSnapshotPanel: () => null }));
jest.mock('../final-review-gate-panel', () => ({ FinalReviewGatePanel: () => null }));

beforeEach(() => {
  jest.mocked(useApprovedReport).mockReturnValue({ isLoading: false, data: { markdown: '# Approved markdown',
    provenance: { commitSha: 'abc', generatedAt: '2026-10-20T00:00:00Z' }, isStale: false } } as ReturnType<typeof useApprovedReport>);
});

it('renders frozen test references in the English report route without live source controls', () => {
  jest.mocked(useFinalReviewedReport).mockReturnValue({ isLoading: false, data: {
    snapshotId: 'reviewed-snapshot-current',
    markdown: '# Frozen snapshot markdown',
    testTraceSnapshot: { version: 1, coverage: staticTestTraceFixture() },
  } } as ReturnType<typeof useFinalReviewedReport>);
  render(<ReportViewer analysisId="analysis-1" />);
  expect(screen.getByText('# Frozen snapshot markdown')).toBeInTheDocument();
  expect(screen.queryByText('# Approved markdown')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'exportMarkdown' })).toBeDisabled();
  expect(screen.getByRole('status')).toHaveTextContent('reportSnapshotMismatch');
  expect(screen.getByRole('heading', { name: 'refunds once' })).toBeInTheDocument();
  expect(screen.getByText('Saved test references')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Inspect source reference' })).not.toBeInTheDocument();
});

it('keeps legacy reports readable and explains absent frozen metadata', () => {
  jest.mocked(useFinalReviewedReport).mockReturnValue({ isLoading: false, data: {
    markdown: '# Approved markdown',
    testTraceSnapshot: null,
  } } as ReturnType<typeof useFinalReviewedReport>);
  render(<ReportViewer analysisId="analysis-1" />);
  expect(screen.getByText('# Approved markdown')).toBeInTheDocument();
  expect(screen.getByText(testTraceLabels.en.unavailable)).toBeInTheDocument();
});

it('distinguishes failed snapshot loading from absent legacy metadata', () => {
  jest.mocked(useFinalReviewedReport).mockReturnValue({ isLoading: false, error: new Error('request failed'),
  } as ReturnType<typeof useFinalReviewedReport>);
  render(<ReportViewer analysisId="analysis-1" />);
  expect(screen.getByRole('alert')).toHaveTextContent('failedToLoadApprovedReport');
  expect(screen.queryByText('# Approved markdown')).not.toBeInTheDocument();
  expect(screen.queryByText(testTraceLabels.en.unavailable)).not.toBeInTheDocument();
});
