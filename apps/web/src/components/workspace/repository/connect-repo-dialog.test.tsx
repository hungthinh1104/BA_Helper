import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals'

const mockConnectRepository = jest.fn<(input: { url: string }) => Promise<{ repositoryId: string }>>()
const mockCreateScanJob = jest.fn<(input: {
  repositoryId: string
  requestKey: string
  ref?: string
}) => Promise<unknown>>()
const mockRouterPush = jest.fn<(href: string) => void>()
const mockToastWarning = jest.fn()
const mockToastSuccess = jest.fn()

jest.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }))
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: mockRouterPush }) }))
jest.mock('sonner', () => ({
  toast: { warning: mockToastWarning, success: mockToastSuccess },
}))
jest.mock('@/hooks/api/use-repositories', () => ({
  useCreateRepository: () => ({ mutateAsync: mockConnectRepository, isPending: false }),
}))
jest.mock('@/hooks/api/use-scan-jobs', () => ({
  useCreateScanJob: () => ({ mutateAsync: mockCreateScanJob }),
}))

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { ConnectRepoDialog } = require('./connect-repo-dialog') as typeof import('./connect-repo-dialog')

describe('ConnectRepoDialog scan retry', () => {
  afterEach(() => {
    cleanup()
    jest.restoreAllMocks()
  })

  beforeEach(() => {
    mockConnectRepository.mockReset()
    mockCreateScanJob.mockReset()
    mockRouterPush.mockReset()
    mockToastWarning.mockReset()
    mockToastSuccess.mockReset()
  })

  it('keeps the connected repository and reuses the scan request key after queue failure', async () => {
    const user = userEvent.setup()
    mockConnectRepository.mockResolvedValue({ repositoryId: 'repo-1' })
    mockCreateScanJob
      .mockRejectedValueOnce(new Error('temporary queue failure'))
      .mockResolvedValueOnce({ id: 'scan-1', status: 'QUEUED' })

    render(
      <ConnectRepoDialog>
        <button>Open connect dialog</button>
      </ConnectRepoDialog>,
    )

    await user.click(screen.getByRole('button', { name: 'Open connect dialog' }))
    await user.type(screen.getByPlaceholderText('https://github.com/org/repo'), 'https://github.com/org/repo')
    await user.type(screen.getByPlaceholderText('main'), 'main')
    await user.click(screen.getByRole('button', { name: 'connectAndScan' }))
    await waitFor(() => expect(mockCreateScanJob).toHaveBeenCalledTimes(1))

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(mockRouterPush).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'retryScan' }))
    await waitFor(() => expect(mockCreateScanJob).toHaveBeenCalledTimes(2))

    const scanRequests = mockCreateScanJob.mock.calls.map(([input]) => input as {
      repositoryId: string
      requestKey: string
      ref?: string
    })
    expect(mockConnectRepository).toHaveBeenCalledTimes(1)
    expect(scanRequests[1]).toEqual(scanRequests[0])
    await waitFor(() => expect(mockRouterPush).toHaveBeenCalledWith('/repositories/repo-1'))
  })
})
