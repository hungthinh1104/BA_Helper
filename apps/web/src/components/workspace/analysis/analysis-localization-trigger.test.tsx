import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { rest } from 'msw'
import mockMessages from '../../../../messages/en.json'
import { server } from '@/test/msw/server'
import { AnalysisLocalizationTrigger } from './analysis-localization-trigger'

jest.mock('next-intl', () => ({
  useTranslations: (namespace?: string) => {
    const source = namespace
      ? namespace.split('.').reduce((acc: Record<string, unknown> | undefined, part) => {
          const next = acc?.[part]
          return next && typeof next === 'object' ? next as Record<string, unknown> : undefined
        }, mockMessages as Record<string, unknown>)
      : mockMessages as Record<string, unknown>

    return (key: string) => {
      const message = source?.[key]
      return typeof message === 'string' ? message : key
    }
  },
}))

describe('AnalysisLocalizationTrigger status recovery', () => {
  it('lets the user retry a failed status request and restores the translate action', async () => {
    const analysisId = '11111111-1111-4111-8111-111111111111'
    let statusRequests = 0
    server.use(
      rest.get(
        `http://localhost:3000/api/v1/analyses/${analysisId}/localization/:locale/status`,
        (_request, response, context) => {
          statusRequests += 1
          if (statusRequests === 1) {
            return response(
              context.status(503),
              context.json({ code: 'SERVICE_UNAVAILABLE', message: 'Temporary failure' }),
            )
          }

          return response(context.json({
            status: 'NOT_TRANSLATED',
            locale: 'vi-VN',
            sourceDocumentId: null,
            errorCode: null,
            updatedAt: null,
          }))
        },
      ),
    )

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    const user = userEvent.setup()
    render(
      <QueryClientProvider client={queryClient}>
        <AnalysisLocalizationTrigger analysisId={analysisId} canExport />
      </QueryClientProvider>,
    )

    expect(await screen.findByText(mockMessages.workspace.localizationStatusUnavailable))
      .toBeInTheDocument()
    expect(screen.getByLabelText(mockMessages.workspace.localizationLanguage))
      .toHaveValue('vi-VN')
    await user.click(screen.getByRole('button', {
      name: mockMessages.workspace.retryLocalizationStatus,
    }))

    await waitFor(() => {
      expect(screen.getByText(mockMessages.workspace.localizationNotTranslated))
        .toBeInTheDocument()
      expect(screen.getByRole('button', {
        name: mockMessages.workspace.localizationTranslate,
      }))
        .toBeEnabled()
    })
    expect(statusRequests).toBe(2)
    queryClient.clear()
  })
})
