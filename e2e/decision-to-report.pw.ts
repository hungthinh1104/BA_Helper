import { test, expect } from '@playwright/test'
import { seedDemo, type DemoSeed } from './fixtures/seed'
import { login } from './fixtures/auth'
import { removeLiveTestTrace, seedTestTrace, traceCaseTitle } from './fixtures/test-trace'

/**
 * The headline journey: an open review queue → decide every item → the primary
 * CTA becomes Finalize → confirm → the approved report opens.
 */
test.describe('decision-to-report journey', () => {
  let seed: DemoSeed

  test.beforeEach(async ({ page }) => {
    seed = seedDemo()
    await login(page, seed)
  })

  test('accept all review items, finalize, and reach the approved report', async ({ page }) => {
    test.setTimeout(180_000)
    const trace = await seedTestTrace(seed.analysisId, { parameterized: true })
    // Verify the real DB -> QA projection path before asserting the visible UI.
    // A 200 response can still omit a TESTS edge when its canonical identity is invalid.
    const coverageWire = page.waitForResponse(response =>
      response.request().method() === 'GET' &&
      response.url().includes(`/api/v1/impact-analyses/${seed.analysisId}/qa-coverage`),
      { timeout: 60_000 });
    await page.goto(`/analyses/${seed.analysisId}?view=review&locale=en-US`);
    const coverageResponse = await coverageWire;
    expect(coverageResponse.ok()).toBe(true)
    const coverage = await coverageResponse.json() as {
      items: Array<{ artifactKey?: string; status: string;
        testArtifacts: Array<{ testCase?: { title: string; parameterized?: boolean } }> }>
      traceContext?: { limitations: string[] }
    }
    const booking = coverage.items.find(item => item.artifactKey === 'api:booking.service.cancelBooking')
    expect(booking).toMatchObject({ status: 'COVERED',
      testArtifacts: [{ testCase: { title: traceCaseTitle, parameterized: true } }] })
    expect(coverage.traceContext?.limitations).not.toContain('UNSUPPORTED_SOURCE_RELATIONSHIP')
    expect(coverage.traceContext?.limitations).not.toContain('UNSUPPORTED_IMPACT_ARTIFACT')
    expect(coverage.items.map(item => item.artifactKey).sort()).toEqual([
      'api:booking.service.cancelBooking',
      'api:inventory.service.releaseRoom',
      'api:refund.controller.processRefund',
    ])
    const workbench = page.locator('[data-review-workbench]')
    await expect(workbench).toBeVisible()
    await expect(page.locator('[data-stale-notice]')).toHaveCount(0)

    await page.locator('[data-review-queue]').getByRole('button')
      .filter({ hasText: 'BookingService.cancelBooking' }).first().click()
    await expect(page.getByRole('heading', { name: 'Review impact link: BookingService.cancelBooking', exact: true })).toBeVisible()
    await expect(page.getByRole('heading', { name: traceCaseTitle, exact: true })).toBeVisible()
    await expect(page.getByText('Parameterized source declaration; data rows are not expanded.', { exact: true })).toBeVisible()
    await expect(page.getByText('Static source references. Test execution and assertion coverage have not been measured. Dependencies may be mocked.', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Inspect source reference', exact: true }).click()
    const evidence = page.getByRole('dialog')
    await expect(evidence.locator('[data-reference-line="3"]')).toContainText('await service.cancelBooking();')
    await page.keyboard.press('Escape')
    await expect(evidence).toBeHidden()

    // Decide every review item via the desktop decision panel. Each accept
    // persists optimistically and auto-advances to the next NEEDS_REVIEW item.
    const panel = page.locator('[data-decision-panel]')
    const complete = page.locator('[data-review-complete]')
    const reviewedCount = await page.getByRole('button', { name: /^All \d+$/, exact: true }).innerText()
    const total = Number(reviewedCount.match(/\d+/)?.[0])
    expect(total).toBeGreaterThan(0)
    for (let i = 0; i < total; i += 1) {
      await expect(panel.getByText('Needs review', { exact: true })).toBeVisible()
      await panel.getByRole('button', { name: 'Accept', exact: true }).click()
      await expect(page.getByRole('button', { name: `Reviewed ${i + 1}`, exact: true })).toBeVisible()
    }
    await expect(complete).toBeVisible()

    // Finalize from the header CTA → confirm in the dialog.
    await page.getByRole('button', { name: 'Finalize', exact: true }).first().click()
    const dialog = page.getByRole('dialog')
    await expect(dialog.getByText('Finalize Impact Analysis')).toBeVisible()
    const finalized = page.waitForResponse(response => response.request().method() === 'POST' &&
      response.url().endsWith(`/api/v1/impact-analyses/${seed.analysisId}/finalize`))
    await dialog.getByRole('button', { name: 'Confirm Finalize' }).click()
    expect((await finalized).ok()).toBe(true)

    // The approved report opens for this analysis.
    await page.waitForURL(url => url.pathname === '/reports' && url.searchParams.get('analysisId') === seed.analysisId)
    await expect(page.getByRole('heading', { name: traceCaseTitle, exact: true })).toBeVisible()
    await removeLiveTestTrace(trace)
    await page.reload()
    const savedReferences = page.getByLabel('Saved test references', { exact: true })
    await expect(savedReferences.getByRole('heading', { name: traceCaseTitle, exact: true })).toBeVisible()
    // The saved, read-only projection must retain every reviewed impacted artifact
    // even after its live TESTS edge and source evidence have been removed.
    for (const artifactLabel of ['BookingService.cancelBooking',
      'InventoryService.releaseRoom', 'RefundController.processRefund']) {
      await expect(savedReferences.getByRole('heading', { name: artifactLabel, exact: true })).toBeVisible()
    }
    await expect(savedReferences.getByText('Parameterized source declaration; data rows are not expanded.', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Inspect source reference', exact: true })).toHaveCount(0)
    const diagram = page.locator('.report-mermaid-preview').first()
    await expect(diagram.locator('svg')).toBeVisible({ timeout: 60_000 })
    await expect(diagram.locator('svg text').first()).toContainText(/\S/)
    await expect(diagram.locator('foreignObject, script, [onload], [href^="javascript:"]')).toHaveCount(0)
  })
})
