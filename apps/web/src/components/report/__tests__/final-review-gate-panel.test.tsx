import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { FinalReviewGatePanel } from '../final-review-gate-panel';
import { server } from '@/test/msw/server';
import { rest } from 'msw';
import { toast } from 'sonner';
import mockMessages from '../../../../messages/en.json';

jest.mock('next-intl', () => ({
  useLocale: () => 'en',
  useTranslations: (namespace?: string) => {
    const messages = mockMessages;
    const source = namespace
      ? namespace.split('.').reduce((acc: Record<string, unknown> | undefined, part) => {
          const next = acc?.[part];
          return next && typeof next === 'object' ? next as Record<string, unknown> : undefined;
        }, messages as Record<string, unknown>)
      : (messages as Record<string, unknown>);

    return (key: string, values?: Record<string, string | number>) => {
      const raw = source?.[key];
      const message = typeof raw === 'string' ? raw : key;
      if (!values) return message;
      return message.replace(/\{(\w+)\}/g, (_, valueKey: string) => String(values[valueKey] ?? `{${valueKey}}`));
    };
  },
}));

const createTestQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
  },
});

describe('FinalReviewGatePanel', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    jest.clearAllMocks();
  });

  const renderComponent = (analysisId = 'test-id') => {
    return render(
      <QueryClientProvider client={queryClient}>
        <FinalReviewGatePanel analysisId={analysisId} />
      </QueryClientProvider>
    );
  };

  it('renders loading state initially', () => {
    renderComponent();
    expect(screen.getByText('Checking Final Review Gate...')).toBeInTheDocument();
  });

  it('renders incomplete gate and disables buttons', async () => {
    server.use(
      rest.get('http://localhost:3000/api/v1/impact-analyses/:analysisId/review-completion', (req, res, ctx) => {
        return res(
          ctx.json({
            analysisId: 'test-id',
            isComplete: false,
            totalLinks: 2,
            accepted: 1,
            rejected: 0,
            needsReview: 0,
            needsMoreEvidence: 0,
            unreviewed: 1,
            hasReviewedSnapshot: false,
            blockingReasons: [
              'UNREVIEWED_TRACEABILITY_LINKS',
              'REVIEWED_SNAPSHOT_MISSING',
              'CRITICAL_MISSING_EVIDENCE',
            ],
          })
        );
      })
    );

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Final Review Gate')).toBeInTheDocument();
    });

    // Check stats
    expect(screen.getByText('Accepted')).toBeInTheDocument();
    expect(screen.getByText('Unreviewed')).toBeInTheDocument();

    // Check blocking reasons
    expect(screen.getByText('Blocked: unreviewed traceability links remain')).toBeInTheDocument();
    expect(screen.getByText('Blocked: reviewed snapshot is missing')).toBeInTheDocument();
    expect(screen.getByText('Blocked: critical item is missing source evidence')).toBeInTheDocument();

    // Check buttons are disabled
    const viewButton = screen.getByRole('button', { name: /view final reviewed report/i });
    expect(viewButton).toBeDisabled();

    const downloadButton = screen.getByRole('button', { name: /download \.md/i });
    expect(downloadButton).toBeDisabled();
  });

  it('renders complete gate and enables buttons', async () => {
    server.use(
      rest.get('http://localhost:3000/api/v1/impact-analyses/:analysisId/review-completion', (req, res, ctx) => {
        return res(
          ctx.json({
            analysisId: 'test-id',
            isComplete: true,
            totalLinks: 2,
            accepted: 2,
            rejected: 0,
            needsReview: 0,
            needsMoreEvidence: 0,
            unreviewed: 0,
            hasReviewedSnapshot: true,
            blockingReasons: [],
          })
        );
      })
    );

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Ready for audited export')).toBeInTheDocument();
    });

    const viewButton = screen.getByRole('button', { name: /view final reviewed report/i });
    expect(viewButton).toBeEnabled();

    const downloadButton = screen.getByRole('button', { name: /download \.md/i });
    expect(downloadButton).toBeEnabled();
  });

  it('downloads markdown when download button is clicked', async () => {
    let exportCalled = false;
    
    server.use(
      rest.get('http://localhost:3000/api/v1/impact-analyses/:analysisId/review-completion', (req, res, ctx) => {
        return res(
          ctx.json({
            analysisId: 'test-id',
            isComplete: true,
            totalLinks: 2,
            accepted: 2,
            rejected: 0,
            needsReview: 0,
            needsMoreEvidence: 0,
            unreviewed: 0,
            hasReviewedSnapshot: true,
            blockingReasons: [],
          })
        );
      }),
      rest.get('http://localhost:3000/api/v1/impact-analyses/:analysisId/approved-report/export.md', (req, res, ctx) => {
        exportCalled = true;
        return res(
          ctx.set('content-type', 'text/markdown;charset=utf-8'),
          ctx.set('content-disposition', 'attachment; filename="approved-impact-report-test-analysis-id.md"'),
          ctx.body('# My Exported Report'),
        );
      })
    );

    const user = userEvent.setup();
    renderComponent('test-analysis-id');

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /download \.md/i })).toBeEnabled();
    });

    // We mock appendChild and click for the 'a' element
    const mockClick = jest.fn();
    const mockAnchor = {
      href: '',
      download: '',
      click: mockClick,
    } as unknown as HTMLAnchorElement;
    
    jest.spyOn(document, 'createElement').mockImplementation((tagName) => {
      if (tagName === 'a') return mockAnchor;
      return document.createElement(tagName);
    });
    
    jest.spyOn(document.body, 'appendChild').mockImplementation(() => mockAnchor);
    jest.spyOn(document.body, 'removeChild').mockImplementation(() => mockAnchor);

    // Initial state: endpoint not called
    expect(exportCalled).toBe(false);

    const downloadButton = screen.getByRole('button', { name: /download \.md/i });
    await user.click(downloadButton);

    await waitFor(() => {
      expect(exportCalled).toBe(true);
    });

    expect(URL.createObjectURL).toHaveBeenCalled();
    expect(mockAnchor.download).toBe('approved-impact-report-test-analysis-id.md');
    expect(mockClick).toHaveBeenCalled();
    expect(URL.revokeObjectURL).toHaveBeenCalled();
    
    expect(toast.success).toHaveBeenCalledWith('Markdown downloaded successfully', expect.any(Object));
  });
});
