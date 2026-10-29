import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { rest } from 'msw';
import type { ReactNode } from 'react';
import { server } from '@/test/msw/server';
import { useFinalReviewedReport as usePageReport } from './use-approved-report';
import { useFinalReviewedReport as useDialogReport } from './use-documents';

jest.mock('next-auth/react', () => ({ getSession: jest.fn().mockResolvedValue(null) }));

describe('final-reviewed report data consistency across UI surfaces', () => {
  it('uses one validated API response and query cache for the page and dialog', async () => {
    let calls = 0;
    server.use(rest.get('http://localhost:3000/api/v1/impact-analyses/:analysisId/final-reviewed-report',
      (_req, res, ctx) => {
        calls += 1;
        return res(ctx.json({
          analysisId: 'analysis-1', snapshotId: 'reviewed-1', locale: 'en',
          markdown: '# Frozen report', createdAt: '2026-10-28T00:00:00Z',
          reviewCompletion: { analysisId: 'analysis-1', totalLinks: 1, accepted: 1, rejected: 0,
            needsReview: 0, needsMoreEvidence: 0, unreviewed: 0, isComplete: true,
            hasReviewedSnapshot: true, blockingReasons: [] },
          reviewDecisionsSnapshot: [], evidenceQualitySummarySnapshot: {},
          evaluationContextSnapshot: null,
        }));
      }));
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: { children: ReactNode }) =>
      <QueryClientProvider client={client}>{children}</QueryClientProvider>;
    const { result } = renderHook(() => ({
      page: usePageReport('analysis-1', 'en'),
      dialog: useDialogReport('analysis-1', { enabled: true, locale: 'en' }),
    }), { wrapper });
    await waitFor(() => {
      expect(result.current.page.data?.markdown).toBe('# Frozen report');
      expect(result.current.dialog.data?.markdown).toBe('# Frozen report');
    });
    expect(calls).toBe(1);
    client.clear();
  });

  it('polls a running document job until the reviewed report becomes available', async () => {
    let calls = 0;
    server.use(rest.get('http://localhost:3000/api/v1/impact-analyses/:analysisId/final-reviewed-report',
      (_req, res, ctx) => {
        calls += 1;
        if (calls === 1) {
          return res(ctx.status(409), ctx.json({
            code: 'DOCUMENT_JOB_NOT_READY',
            message: 'Final report is still being generated.',
            details: { documentJobId: 'document-job-1', status: 'RUNNING' },
          }));
        }
        return res(ctx.json({
          analysisId: 'analysis-1', snapshotId: 'reviewed-1', locale: 'en',
          markdown: '# Frozen report', createdAt: '2026-10-28T00:00:00Z',
          reviewCompletion: { analysisId: 'analysis-1', totalLinks: 1, accepted: 1, rejected: 0,
            needsReview: 0, needsMoreEvidence: 0, unreviewed: 0, isComplete: true,
            hasReviewedSnapshot: true, blockingReasons: [] },
          reviewDecisionsSnapshot: [], evidenceQualitySummarySnapshot: {},
          evaluationContextSnapshot: null,
        }));
      }));
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: { children: ReactNode }) =>
      <QueryClientProvider client={client}>{children}</QueryClientProvider>;
    const { result } = renderHook(() => usePageReport('analysis-1', 'en'), { wrapper });

    await waitFor(() => expect(result.current.data?.markdown).toBe('# Frozen report'), { timeout: 3000 });
    expect(calls).toBe(2);
    client.clear();
  }, 10000);
});
