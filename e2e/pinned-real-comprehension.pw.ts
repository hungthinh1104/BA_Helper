import { expect, test } from '@playwright/test'
import { existsSync, readFileSync } from 'node:fs'
import { login } from './fixtures/auth'

const proofFile = process.env.PINNED_COMPREHENSION_PROOF_FILE ??
  'artifacts/evaluation/pinned-code-comprehension-proof.json'
const proof = existsSync(proofFile) ? JSON.parse(readFileSync(proofFile, 'utf8')) as {
  repositoryId: string; snapshotId: string; methodId: string; multiMethodId: string;
  mockMethodId: string; indirectMethodId: string; noTestMethodId: string; commitSha: string;
} : undefined
const repositoryId = proof?.repositoryId
const snapshotId = proof?.snapshotId
const methodId = proof?.methodId
const multiMethodId = proof?.multiMethodId
const mockMethodId = proof?.mockMethodId
const indirectMethodId = proof?.indirectMethodId
const noTestMethodId = proof?.noTestMethodId
const commitSha = proof?.commitSha

test('opens a persisted pinned-repository trace through the live API', async ({ page }, testInfo) => {
  test.skip(!repositoryId || !snapshotId || !methodId || !multiMethodId ||
    !mockMethodId || !indirectMethodId || !noTestMethodId || !commitSha,
    'Run pnpm prove:pinned-comprehension to persist the optional browser proof snapshot.')
  test.setTimeout(120_000)
  await login(page, { email: 'demo@ba-helper.local', password: 'demo-password-2026' })

  const started = performance.now()
  const firstResponse = page.waitForResponse(response => response.url().includes('/comprehension') &&
    response.url().includes(methodId!) && response.status() === 200)
  await page.goto(`/repositories/${repositoryId}/snapshots/${snapshotId}/artifacts/${methodId}`)
  const wire = await (await firstResponse).json()
  expect(wire.snapshotContext.commitSha).toBe(commitSha)
  expect(wire.selectedCode.name).toBe('AuthController.register')
  await expect(page.getByRole('heading', { name: 'Source evidence', exact: true })).toBeVisible()
  await expect(page.getByText('should register a new user', { exact: true })).toBeVisible()
  const timeToUsableMs = performance.now() - started
  const scenario = page.locator('details').filter({ hasText: 'should register a new user' }).first()
  await scenario.locator('summary').click()
  await scenario.getByRole('button', { name: 'Show visual trace' }).click()
  await expect(scenario.locator('.react-flow')).toBeVisible()
  await expect(page.getByText('RUNTIME_OBSERVATIONS_NOT_IMPORTED', { exact: true })).toBeVisible()

  const secondResponse = page.waitForResponse(response => response.url().includes('/comprehension') &&
    response.url().includes(multiMethodId!) && response.status() === 200)
  await page.goto(`/repositories/${repositoryId}/snapshots/${snapshotId}/artifacts/${multiMethodId}`)
  const secondWire = await (await secondResponse).json()
  expect(secondWire.relatedScenarios).toHaveLength(3)
  await expect(page.locator('details')).toHaveCount(3)
  const switchStart = performance.now()
  const nextScenario = page.locator('details').nth(1)
  await nextScenario.locator('summary').click()
  await nextScenario.getByRole('button', { name: 'Show visual trace' }).click()
  await expect(nextScenario.locator('.react-flow')).toBeVisible()
  const scenarioSwitchMs = performance.now() - switchStart
  const mockResponse = page.waitForResponse(response => response.url().includes('/comprehension') &&
    response.url().includes(mockMethodId!) && response.status() === 200)
  await page.goto(`/repositories/${repositoryId}/snapshots/${snapshotId}/artifacts/${mockMethodId}`)
  const mockWire = await (await mockResponse).json()
  expect(mockWire.relatedScenarios[0].mockedBoundaries).toHaveLength(1)
  const mockScenario = page.locator('details').filter({ hasText: 'should find a user from the payload' }).first()
  await mockScenario.locator('summary').click()
  await expect(mockScenario.getByText('mockedUserRepository.findOne.mockResolvedValueOnce(user)', { exact: true })).toBeVisible()
  await expect(mockScenario.getByText(/ASSERTION_INVOCATION_UNRESOLVED/)).toBeVisible()
  const indirectResponse = page.waitForResponse(response => response.url().includes('/comprehension') &&
    response.url().includes(indirectMethodId!) && response.status() === 200)
  await page.goto(`/repositories/${repositoryId}/snapshots/${snapshotId}/artifacts/${indirectMethodId}`)
  const indirectWire = await (await indirectResponse).json()
  expect(indirectWire.relatedScenarios.some((item: { trace?: { relation: string } }) =>
    item.trace?.relation === 'CALL_PATH')).toBe(true)
  await expect(page.locator('details').first()).toBeVisible()
  const noTestResponse = page.waitForResponse(response => response.url().includes('/comprehension') &&
    response.url().includes(noTestMethodId!) && response.status() === 200)
  await page.goto(`/repositories/${repositoryId}/snapshots/${snapshotId}/artifacts/${noTestMethodId}`)
  const noTestWire = await (await noTestResponse).json()
  expect(noTestWire.relatedScenarios).toHaveLength(0)
  await expect(page.getByText('No supported test-to-code reference was persisted.', { exact: false })).toBeVisible()
  await expect(page.getByText('NO_SUPPORTED_TEST_REFERENCE', { exact: true })).toBeVisible()
  const metrics = { timeToUsableMs, scenarioSwitchMs, method: wire.selectedCode.name,
    scenariosAfterSelection: secondWire.relatedScenarios.length,
    mockClaims: mockWire.relatedScenarios[0].mockedBoundaries.length,
    indirectScenarios: indirectWire.relatedScenarios.length, noTestScenarios: noTestWire.relatedScenarios.length,
    snapshotId, commitSha }
  await testInfo.attach('pinned-real-comprehension-metrics', {
    body: JSON.stringify(metrics, null, 2), contentType: 'application/json',
  })
  process.stdout.write(`${JSON.stringify({ pinnedRealBrowserSample: metrics })}\n`)
})
