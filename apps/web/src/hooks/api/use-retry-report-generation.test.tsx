import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { rest } from 'msw'
import type { ReactNode } from 'react'
import { server } from '@/test/msw/server'
import { queryKeys } from '@/lib/api/query-keys'
import { useRetryReportGeneration } from './use-approved-report'

jest.mock('next-auth/react', () => ({ getSession: jest.fn().mockResolvedValue(null) }))

describe('useRetryReportGeneration', () => {
  it('retries the failed approved document and invalidates report state', async () => {
    let requestBody: unknown
    server.use(rest.post('http://localhost:3000/api/v1/impact-analyses/:analysisId/document-jobs',
      async (req, res, ctx) => {
        requestBody = await req.json()
        return res(ctx.json({
          id: '10000000-0000-4000-8000-000000000001',
          analysisId: '20000000-0000-4000-8000-000000000002',
          snapshotId: '30000000-0000-4000-8000-000000000003',
          documentType: 'IMPACT_REPORT',
          status: 'QUEUED',
          progress: 0,
          attemptCount: 2,
          createdAt: '2026-10-29T00:00:00.000Z',
          updatedAt: '2026-10-29T00:00:00.000Z',
        }))
      }))

    const analysisId = '20000000-0000-4000-8000-000000000002'
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const reportKey = queryKeys.documents.finalReviewedReport(analysisId, 'en')
    const workspaceKey = queryKeys.analyses.workspace(analysisId)
    client.setQueryData(reportKey, { markdown: null })
    client.setQueryData(workspaceKey, { reportStatus: { status: 'failed', canRetryReportGeneration: true } })
    client.setQueryData(queryKeys.analyses.detail(analysisId), { status: 'COMPLETED' })
    const wrapper = ({ children }: { children: ReactNode }) =>
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    const { result } = renderHook(() => useRetryReportGeneration(analysisId), { wrapper })

    act(() => result.current.mutate())
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(requestBody).toMatchObject({ retry: true, requestKey: expect.any(String) })
    expect(client.getQueryState(reportKey)?.isInvalidated).toBe(true)
    expect(client.getQueryState(workspaceKey)?.isInvalidated).toBe(true)
    expect(client.getQueryState(queryKeys.analyses.detail(analysisId))?.isInvalidated).toBe(true)
    client.clear()
  })
})
