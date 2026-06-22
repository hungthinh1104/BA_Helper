import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { FinalReviewedReportViewer } from '../final-reviewed-report-viewer';
import { server } from '@/test/msw/server';
import { rest } from 'msw';

// Note: To render Dialog content in tests without issues, we don't necessarily need special setup if the open prop is true, but we should wrap it.
const createTestQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
  },
});

describe('FinalReviewedReportViewer', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    jest.clearAllMocks();
  });

  const renderComponent = (analysisId = 'test-id', open = true) => {
    return render(
      <QueryClientProvider client={queryClient}>
        <FinalReviewedReportViewer analysisId={analysisId} open={open} onOpenChange={jest.fn()} />
      </QueryClientProvider>
    );
  };

  it('does not fetch or render anything when open is false', () => {
    let endpointCalled = false;
    server.use(
      rest.get('http://localhost:3000/api/v1/impact-analyses/:analysisId/final-reviewed-report', (req, res, ctx) => {
        endpointCalled = true;
        return res(ctx.json({}));
      })
    );

    renderComponent('test-id', false);
    
    // Dialog content should not be in the document
    expect(screen.queryByText('Final Reviewed Report — Read Only')).not.toBeInTheDocument();
    
    // The endpoint should not have been called because enabled: open is false
    expect(endpointCalled).toBe(false);
  });

  it('renders loading state initially when open', () => {
    renderComponent('test-id', true);
    expect(screen.getByText('Loading final audited report...')).toBeInTheDocument();
  });

  it('fetches and renders report when opened', async () => {
    server.use(
      rest.get('http://localhost:3000/api/v1/impact-analyses/:analysisId/final-reviewed-report', (req, res, ctx) => {
        return res(
          ctx.json({
            analysisId: 'test-id',
            snapshotId: '12345678-abcd',
            markdown: '# My Frozen Markdown\n\nThis is a test.',
            createdAt: new Date('2026-06-21T00:00:00Z').toISOString(),
            reviewCompletion: {
              analysisId: 'test-id',
              isComplete: true,
              totalLinks: 1,
              accepted: 1,
              rejected: 0,
              needsReview: 0,
              needsMoreEvidence: 0,
              unreviewed: 0,
              hasReviewedSnapshot: true,
              blockingReasons: [],
            },
            reviewDecisionsSnapshot: [
              {
                linkId: 'link-1',
                artifact: 'test-artifact.ts',
                quality: 'EVIDENCED',
                reasons: ['Persisted code evidence'],
                reviewDecision: {
                  id: '00000000-0000-4000-8000-000000000001',
                  analysisId: '00000000-0000-4000-8000-000000000002',
                  traceabilityLinkId: '00000000-0000-4000-8000-000000000003',
                  decision: 'ACCEPTED',
                  note: 'Looks good',
                  reviewedAt: new Date('2026-06-21T01:00:00Z').toISOString()
                }
              }
            ],
            evidenceQualitySummarySnapshot: {},
            evaluationContextSnapshot: null,
            createdByUserId: null,
          })
        );
      })
    );

    renderComponent('test-id', true);

    // Wait for the text to appear
    await waitFor(() => {
      expect(screen.getByText(/My Frozen Markdown/)).toBeInTheDocument();
    });

    expect(screen.getByText(/This is a test\./)).toBeInTheDocument();

    // Check decisions table rendered
    expect(screen.getByText('Final Review Decisions')).toBeInTheDocument();
    expect(screen.getByText('test-artifact.ts')).toBeInTheDocument();
    expect(screen.getByText('ACCEPTED')).toBeInTheDocument();
    expect(screen.getByText('Looks good')).toBeInTheDocument();
    
    // Check snapshot badge
    expect(screen.getByText('12345678')).toBeInTheDocument();
  });
});
