import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MergedReportReviewPanel } from './merged-report-review-panel'

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => 'en',
}))

function renderPanel(onSubmitReview: (data: { decision: 'ACCEPTED' | 'REJECTED' | 'NEEDS_MORE_CLARIFICATION'; note: string }) => Promise<void>) {
  return render(
    <MergedReportReviewPanel
      isStale={false}
      latestReviewedDecision={null}
      reviewDecisions={[]}
      reviewDecisionsLoading={false}
      canReview
      isSubmitting={false}
      onSubmitReview={onSubmitReview}
    />,
  )
}

it('keeps the selected decision and note until review submission succeeds', async () => {
  let resolveSubmission!: () => void
  const onSubmitReview = jest.fn(() => new Promise<void>((resolve) => {
    resolveSubmission = resolve
  }))
  renderPanel(onSubmitReview)

  fireEvent.click(screen.getByRole('button', { name: 'accept' }))
  fireEvent.change(screen.getByPlaceholderText('optionalReviewNote'), {
    target: { value: 'Recheck payment retry behavior.' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'submitReview' }))

  expect(onSubmitReview).toHaveBeenCalledWith({
    decision: 'ACCEPTED',
    note: 'Recheck payment retry behavior.',
  })
  expect(screen.getByPlaceholderText('optionalReviewNote')).toHaveValue('Recheck payment retry behavior.')
  expect(screen.getByRole('button', { name: 'submitReview' })).toBeEnabled()

  await act(async () => resolveSubmission())
  await waitFor(() => {
    expect(screen.getByPlaceholderText('optionalReviewNote')).toHaveValue('')
    expect(screen.getByRole('button', { name: 'submitReview' })).toBeDisabled()
  })
})

it('preserves review input when the submission fails', async () => {
  const onSubmitReview = jest.fn().mockRejectedValue(new Error('network unavailable'))
  renderPanel(onSubmitReview)

  fireEvent.click(screen.getByRole('button', { name: 'reject' }))
  fireEvent.change(screen.getByPlaceholderText('optionalReviewNote'), {
    target: { value: 'Keep this note for retry.' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'submitReview' }))

  await waitFor(() => expect(onSubmitReview).toHaveBeenCalledTimes(1))
  expect(screen.getByPlaceholderText('optionalReviewNote')).toHaveValue('Keep this note for retry.')
  expect(screen.getByRole('button', { name: 'submitReview' })).toBeEnabled()
})
