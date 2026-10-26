import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { rest } from 'msw';
import { server } from '@/test/msw/server';
import { CodeEvidenceNavigator } from './code-evidence-navigator';

jest.mock('@/i18n/navigation', () => ({ useLocalizedHref: () => (path: string) => path }));

function artifact(index: number) {
  return {
    id: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
    artifactKey: `service:src/method-${index}.ts:Method${index}`,
    name: `Method${index}`,
    artifactType: 'SERVICE_METHOD',
    universalKind: 'DOMAIN_SERVICE',
    filePath: `src/method-${index}.ts`,
    startLine: 10,
    endLine: 20,
    language: 'typescript',
  };
}

function renderNavigator(snapshotId = 'snapshot-1') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>
    <CodeEvidenceNavigator repositoryId="repo-1" snapshotId={snapshotId} />
  </QueryClientProvider>);
}

it('does not request artifacts without a usable snapshot', () => {
  let requested = false;
  server.use(rest.get('http://localhost:3000/api/v1/snapshots/:snapshotId/artifacts', (_req, res, ctx) => {
    requested = true;
    return res(ctx.json({ items: [], hasMore: false, limit: 50, offset: 0 }));
  }));
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}>
    <CodeEvidenceNavigator repositoryId="repo-1" />
  </QueryClientProvider>);
  fireEvent.click(screen.getByRole('button', { name: 'Code evidence' }));
  expect(screen.getByText(/usable snapshot is required/i)).toBeInTheDocument();
  expect(requested).toBe(false);
});

it('hides Jest test artifacts from the production code navigator', async () => {
  server.use(rest.get('http://localhost:3000/api/v1/snapshots/:snapshotId/artifacts', (_req, res, ctx) => res(ctx.json({
    items: [{ ...artifact(7), artifactType: 'JEST_TEST_CASE', universalKind: 'TEST_CASE' }],
    hasMore: false, limit: 50, offset: 0,
  }))));

  renderNavigator();
  fireEvent.click(screen.getByRole('button', { name: 'Code evidence' }));
  expect(await screen.findByText('No supported production artifacts were indexed.')).toBeInTheDocument();
  expect(screen.queryByRole('link', { name: /Method7/ })).not.toBeInTheDocument();
});

it('loads a method beyond the first 50 without downloading the whole snapshot', async () => {
  const offsets: number[] = [];
  server.use(rest.get('http://localhost:3000/api/v1/snapshots/:snapshotId/artifacts', (req, res, ctx) => {
    const offset = Number(req.url.searchParams.get('offset'));
    offsets.push(offset);
    expect(req.url.searchParams.get('scope')).toBe('production');
    expect(req.url.searchParams.get('limit')).toBe('50');
    return res(ctx.json({
      items: Array.from({ length: offset === 0 ? 50 : 1 }, (_, index) => artifact(offset + index + 1)),
      hasMore: offset === 0,
      limit: 50,
      offset,
    }));
  }));

  renderNavigator();
  expect(offsets).toEqual([]);
  fireEvent.click(screen.getByRole('button', { name: 'Code evidence' }));
  expect(await screen.findByText('Method50')).toBeInTheDocument();
  expect(screen.queryByText('Method51')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Load more' }));
  expect(await screen.findByText('Method51')).toBeInTheDocument();
  await waitFor(() => expect(offsets).toEqual([0, 50]));
  expect(screen.getByRole('link', { name: /Method51/ })).toHaveAttribute(
    'href', '/repositories/repo-1/snapshots/snapshot-1/artifacts/00000000-0000-4000-8000-000000000051',
  );
  expect(screen.queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument();
});

it('preserves the loaded page and retries a failed next-page request', async () => {
  const offsets: number[] = [];
  let secondPageAttempts = 0;
  server.use(rest.get('http://localhost:3000/api/v1/snapshots/:snapshotId/artifacts', (req, res, ctx) => {
    const offset = Number(req.url.searchParams.get('offset'));
    offsets.push(offset);
    if (offset === 50 && secondPageAttempts++ === 0) {
      return res(ctx.status(503), ctx.json({ code: 'UNAVAILABLE', message: 'Unavailable' }));
    }
    return res(ctx.json({
      items: offset === 0 ? Array.from({ length: 50 }, (_, index) => artifact(index + 1)) : [artifact(51)],
      hasMore: offset === 0,
      limit: 50,
      offset,
    }));
  }));

  renderNavigator();
  fireEvent.click(screen.getByRole('button', { name: 'Code evidence' }));
  expect(await screen.findByText('Method50')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Load more' }));

  expect(await screen.findByRole('button', { name: 'Retry loading more' })).toBeInTheDocument();
  expect(screen.getByText('Method50')).toBeInTheDocument();
  expect(screen.queryByText('Method51')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Retry loading more' }));

  expect(await screen.findByText('Method51')).toBeInTheDocument();
  expect(screen.getByText('Method50')).toBeInTheDocument();
  expect(offsets).toEqual([0, 50, 50]);
});

it('debounces search and finds a method outside the first page by server-side name', async () => {
  const searches: string[] = [];
  server.use(rest.get('http://localhost:3000/api/v1/snapshots/:snapshotId/artifacts', (req, res, ctx) => {
    const search = req.url.searchParams.get('search') ?? '';
    searches.push(search);
    const items = search ? [artifact(89)] : Array.from({ length: 50 }, (_, index) => artifact(index + 1));
    return res(ctx.json({ items, hasMore: !search, limit: 50, offset: 0 }));
  }));

  renderNavigator();
  fireEvent.click(screen.getByRole('button', { name: 'Code evidence' }));
  expect(await screen.findByText('Method50')).toBeInTheDocument();
  const input = screen.getByRole('textbox', { name: 'Search method, artifact key, or file path' });
  fireEvent.change(input, { target: { value: 'Meth' } });
  fireEvent.change(input, { target: { value: 'Method8' } });
  fireEvent.change(input, { target: { value: 'Method89' } });
  expect(await screen.findByText('Method89')).toBeInTheDocument();
  expect(searches).toEqual(['', 'Method89']);
  expect(screen.queryByText('Method50')).not.toBeInTheDocument();
});

it.each([
  ['artifact key', artifact(89).artifactKey],
  ['file path', artifact(89).filePath],
])('finds a method outside the first page by server-side %s search', async (_kind, searchTerm) => {
  const searches: string[] = [];
  server.use(rest.get('http://localhost:3000/api/v1/snapshots/:snapshotId/artifacts', (req, res, ctx) => {
    const search = req.url.searchParams.get('search') ?? '';
    searches.push(search);
    const items = search === searchTerm ? [artifact(89)]
      : search ? [] : Array.from({ length: 50 }, (_, index) => artifact(index + 1));
    return res(ctx.json({ items, hasMore: !search, limit: 50, offset: 0 }));
  }));

  renderNavigator();
  fireEvent.click(screen.getByRole('button', { name: 'Code evidence' }));
  expect(await screen.findByText('Method50')).toBeInTheDocument();
  fireEvent.change(screen.getByRole('textbox', { name: 'Search method, artifact key, or file path' }), {
    target: { value: searchTerm },
  });
  expect(await screen.findByText('Method89')).toBeInTheDocument();
  expect(searches).toEqual(['', searchTerm]);
});

it('keeps duplicate names distinct by source path and artifact identity', async () => {
  server.use(rest.get('http://localhost:3000/api/v1/snapshots/:snapshotId/artifacts', (_req, res, ctx) => res(ctx.json({
    items: [
      { ...artifact(1), name: 'run', filePath: 'src/alpha.service.ts' },
      { ...artifact(2), name: 'run', filePath: 'src/beta.service.ts' },
    ],
    hasMore: false, limit: 50, offset: 0,
  }))));

  renderNavigator();
  fireEvent.click(screen.getByRole('button', { name: 'Code evidence' }));
  expect(await screen.findByText('src/alpha.service.ts:10 · SERVICE_METHOD')).toBeInTheDocument();
  expect(screen.getByText('src/beta.service.ts:10 · SERVICE_METHOD')).toBeInTheDocument();
  const links = screen.getAllByRole('link', { name: /run/ });
  expect(links).toHaveLength(2);
  expect(links[0]).toHaveAttribute('href', '/repositories/repo-1/snapshots/snapshot-1/artifacts/00000000-0000-4000-8000-000000000001');
  expect(links[1]).toHaveAttribute('href', '/repositories/repo-1/snapshots/snapshot-1/artifacts/00000000-0000-4000-8000-000000000002');
});

it('shows empty search results and retries a failed artifact request', async () => {
  let requests = 0;
  server.use(rest.get('http://localhost:3000/api/v1/snapshots/:snapshotId/artifacts', (req, res, ctx) => {
    requests += 1;
    if (requests === 1) return res(ctx.status(503), ctx.json({ code: 'UNAVAILABLE', message: 'Unavailable' }));
    const items = req.url.searchParams.has('search') ? [] : [artifact(1)];
    return res(ctx.json({ items, hasMore: false, limit: 50, offset: 0 }));
  }));

  renderNavigator();
  fireEvent.click(screen.getByRole('button', { name: 'Code evidence' }));
  expect(await screen.findByText(/artifact index could not be loaded/i)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
  expect(await screen.findByText('Method1')).toBeInTheDocument();
  fireEvent.change(screen.getByRole('textbox', { name: 'Search method, artifact key, or file path' }), {
    target: { value: 'missing/file.ts' },
  });
  expect(await screen.findByText('No production artifacts match this search.')).toBeInTheDocument();
  expect(requests).toBe(3);
});

it('switches the artifact index and links when the selected snapshot changes', async () => {
  const snapshotIds: string[] = [];
  server.use(rest.get('http://localhost:3000/api/v1/snapshots/:snapshotId/artifacts', (req, res, ctx) => {
    const snapshotId = String(req.params.snapshotId);
    snapshotIds.push(snapshotId);
    return res(ctx.json({
      items: [artifact(snapshotId === 'snapshot-1' ? 1 : 2)], hasMore: false, limit: 50, offset: 0,
    }));
  }));

  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = render(<QueryClientProvider client={client}>
    <CodeEvidenceNavigator repositoryId="repo-1" snapshotId="snapshot-1" />
  </QueryClientProvider>);
  fireEvent.click(screen.getByRole('button', { name: 'Code evidence' }));
  expect(await screen.findByText('Method1')).toBeInTheDocument();
  view.rerender(<QueryClientProvider client={client}>
    <CodeEvidenceNavigator repositoryId="repo-1" snapshotId="snapshot-2" />
  </QueryClientProvider>);
  expect(await screen.findByText('Method2')).toBeInTheDocument();
  expect(screen.queryByText('Method1')).not.toBeInTheDocument();
  expect(screen.getByRole('link', { name: /Method2/ })).toHaveAttribute(
    'href', '/repositories/repo-1/snapshots/snapshot-2/artifacts/00000000-0000-4000-8000-000000000002',
  );
  expect(snapshotIds).toEqual(['snapshot-1', 'snapshot-2']);
});

it('stops at the documented offset limit and points to search for remaining artifacts', async () => {
  const offsets: number[] = [];
  server.use(rest.get('http://localhost:3000/api/v1/snapshots/:snapshotId/artifacts', (req, res, ctx) => {
    const offset = Number(req.url.searchParams.get('offset'));
    offsets.push(offset);
    return res(ctx.json({
      items: Array.from({ length: 50 }, (_, index) => artifact(offset + index + 1)),
      hasMore: offset < 500,
      ...(offset === 500 ? { limitReached: true } : {}),
      limit: 50,
      offset,
    }));
  }));

  renderNavigator();
  fireEvent.click(screen.getByRole('button', { name: 'Code evidence' }));
  expect(await screen.findByText('Method50')).toBeInTheDocument();
  for (let page = 1; page <= 10; page += 1) {
    const loadMore = await screen.findByRole('button', { name: 'Load more' });
    await waitFor(() => expect(loadMore).toBeEnabled());
    fireEvent.click(loadMore);
    expect(await screen.findByText(`Method${(page + 1) * 50}`)).toBeInTheDocument();
  }
  expect(offsets).toEqual([0, 50, 100, 150, 200, 250, 300, 350, 400, 450, 500]);
  expect(screen.queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument();
  expect(screen.getByText(/browsing limit was reached/i)).toBeInTheDocument();
}, 30_000);
