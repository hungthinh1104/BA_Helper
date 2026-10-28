import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { rest } from 'msw';
import { server } from '@/test/msw/server';
import { ReviewedSnapshotPanel } from '../reviewed-snapshot-panel';

jest.mock('next-auth/react', () => ({ getSession: jest.fn().mockResolvedValue(null) }));
jest.mock('next-intl', () => ({
  useLocale: () => 'en',
  useTranslations: () => (key: string) => key,
}));
jest.mock('../locked-snapshot-viewer', () => ({
  LockedSnapshotViewer: () => <div data-testid="locked-snapshot-viewer" />,
}));

const id = '00000000-0000-4000-8000-000000000001';
const otherId = '00000000-0000-4000-8000-000000000002';
const snapshot = {
  id: '00000000-0000-4000-8000-000000000003',
  analysisId: id,
  markdown: '# Frozen',
  reviewDecisionsSnapshot: [],
  evidenceQualitySummarySnapshot: {},
  createdAt: '2026-10-28T00:00:00Z',
};
const route = 'http://localhost:3000/api/v1/impact-analyses/:analysisId/reviewed-report-snapshot/latest';

function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = render(<QueryClientProvider client={client}>
    <ReviewedSnapshotPanel analysisId={id} />
  </QueryClientProvider>);
  return { ...view, client };
}

describe('ReviewedSnapshotPanel API-to-UI integrity', () => {
  it('renders a genuine 404 as an absent snapshot, not a transport failure', async () => {
    server.use(rest.get(route, (_req, res, ctx) =>
      res(ctx.status(404), ctx.json({ code: 'NOT_FOUND', message: 'No reviewed snapshot' }))));
    const { client } = mount();
    expect(await screen.findByText('noReviewedSnapshot')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    client.clear();
  });

  it('rejects a successful HTTP response whose JSON violates the snapshot contract', async () => {
    server.use(rest.get(route, (_req, res, ctx) =>
      res(ctx.json({ analysisId: id, createdAt: '2026-10-28T00:00:00Z' }))));
    const { client } = mount();
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('failedLoadFinalReport');
    expect(screen.queryByText('noReviewedSnapshot')).not.toBeInTheDocument();
    expect(screen.queryByText('reviewedSnapshotLocked')).not.toBeInTheDocument();
    client.clear();
  });

  it('rejects a well-formed snapshot belonging to another analysis', async () => {
    server.use(rest.get(route, (_req, res, ctx) =>
      res(ctx.json({ ...snapshot, analysisId: otherId }))));
    const { client } = mount();
    expect(await screen.findByRole('alert')).toHaveTextContent('failedLoadFinalReport');
    expect(screen.queryByTestId('locked-snapshot-viewer')).not.toBeInTheDocument();
    client.clear();
  });

  it('distinguishes a server failure from absence and recovers after retry', async () => {
    let calls = 0;
    server.use(rest.get(route, (_req, res, ctx) => {
      calls++;
      return calls === 1
        ? res(ctx.status(503), ctx.json({ code: 'UNAVAILABLE', message: 'Try later' }))
        : res(ctx.json(snapshot));
    }));
    const { client } = mount();
    expect(await screen.findByRole('alert')).toHaveTextContent('failedLoadFinalReport');
    fireEvent.click(screen.getByRole('button', { name: 'retrySnapshot' }));
    await waitFor(() => expect(screen.getByText('reviewedSnapshotLocked')).toBeInTheDocument());
    expect(screen.getByTestId('locked-snapshot-viewer')).toBeInTheDocument();
    expect(calls).toBe(2);
    client.clear();
  });
});
