import { expect, test, type Page } from '@playwright/test'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { login } from './fixtures/auth'
import { codeComprehensionResponseSchema } from '@ba-helper/contracts'
import { hasRequiredBrowserProofSamples, isPinnedBrowserProofRequired } from '../scripts/pinned-comprehension-browser-status'

const proofFile = process.env.PINNED_COMPREHENSION_PROOF_FILE ??
  'artifacts/evaluation/pinned-code-comprehension-proof.json'
const recordsProof = process.env.PINNED_BROWSER_PROOF_MODE === '1'
const proofRequired = isPinnedBrowserProofRequired(process.env.REQUIRE_PINNED_COMPREHENSION_PROOF)
const corpusRoot = path.resolve(process.env.PINNED_CORPUS_PATH ?? 'tmp/corpora/nest-api-example')
const proof = existsSync(proofFile) ? JSON.parse(readFileSync(proofFile, 'utf8')) as {
  repositoryId: string; projectId: string; projectName: string;
  snapshotId: string; methodId: string; multiMethodId: string;
  mockMethodId: string; indirectMethodId: string; noTestMethodId: string; commitSha: string;
  provenanceVerification?: { sourceEvidenceCount: number; relationshipCount: number; sourceFileCount: number };
  performance?: { coldProjection?: { latency?: { count: number } };
    higherComplexity?: Array<{ kind: string; latency?: { count: number };
      samples?: Array<{ unresolvedCodes?: string[] }> }> };
} : undefined
const repositoryId = proof?.repositoryId
const projectId = proof?.projectId
const projectName = proof?.projectName
const snapshotId = proof?.snapshotId
const methodId = proof?.methodId
const multiMethodId = proof?.multiMethodId
const mockMethodId = proof?.mockMethodId
const indirectMethodId = proof?.indirectMethodId
const noTestMethodId = proof?.noTestMethodId
const commitSha = proof?.commitSha
const workloads = proof?.performance?.higherComplexity ?? []
const unresolvedWorkload = workloads.find(item => item.kind === 'UNRESOLVED_EVIDENCE')
const requiredWorkloads = ['MULTIPLE_SCENARIOS', 'INDIRECT_PATH', 'MOST_RELATIONSHIPS',
  'UNRESOLVED_EVIDENCE', 'NO_SUPPORTED_TEST']
const proofReady = Boolean(repositoryId && projectId && projectName && snapshotId && methodId && multiMethodId &&
  mockMethodId && indirectMethodId && noTestMethodId && commitSha &&
  (proof?.provenanceVerification?.sourceEvidenceCount ?? 0) >= 1 &&
  (proof?.provenanceVerification?.relationshipCount ?? 0) >= 1 &&
  (proof?.provenanceVerification?.sourceFileCount ?? 0) >= 1 &&
  (proof?.performance?.coldProjection?.latency?.count ?? 0) >= 5 &&
  requiredWorkloads.every(kind => workloads.some(item => item.kind === kind && item.latency?.count === 5)) &&
  unresolvedWorkload?.samples?.length === 5 &&
  unresolvedWorkload.samples.every(sample => sample.unresolvedCodes?.includes('ASSERTION_INVOCATION_UNRESOLVED')))
if (process.env.REQUIRE_PINNED_COMPREHENSION_PROOF === '1' && !proofReady) {
  throw new Error('The required pinned proof artifact is missing or incomplete. Run pnpm prove:pinned-comprehension first.')
}

function waitForComprehensionResponse(page: Page, artifactId: string) {
  return page.waitForResponse(response => response.url().includes('/comprehension') &&
    response.url().includes(artifactId), { timeout: 60_000 })
}

async function parseComprehensionResponse(response: {
  status(): number; url(): string; json(): Promise<unknown>;
}) {
  expect(response.status(), `Comprehension API response failed: ${response.status()} ${response.url()}`).toBe(200)
  return codeComprehensionResponseSchema.parse(await response.json())
}

test('opens a persisted pinned-repository trace through the live API', async ({ page }, testInfo) => {
  test.skip(!proofRequired,
    'Run pnpm verify:pinned-comprehension-browser to execute this opt-in persisted-snapshot proof.')
  test.setTimeout(180_000)
  if (recordsProof && testInfo.repeatEachIndex === 0) {
    const currentProof = JSON.parse(readFileSync(proofFile, 'utf8')) as Record<string, unknown>
    writeFileSync(proofFile, `${JSON.stringify({ ...currentProof,
      apiVerification: { status: 'NOT_RUN' },
      browserVerification: { status: 'INCOMPLETE', samples: [] },
    }, null, 2)}\n`)
  }
  await login(page, { email: 'demo@ba-helper.local', password: 'demo-password-2026', projectId, projectName })

  const started = performance.now()
  const firstResponse = waitForComprehensionResponse(page, methodId!)
  await page.goto(`/repositories/${repositoryId}/snapshots/${snapshotId}/artifacts/${methodId}`)
  const firstNetworkResponse = await firstResponse
  const wire = await parseComprehensionResponse(firstNetworkResponse)
  expect(wire.snapshotContext.commitSha).toBe(commitSha)
  expect(wire.selectedCode.name).toBe('AuthController.register')
  await expect(page.getByRole('heading', { name: 'Source evidence', exact: true })).toBeVisible()
  await expect(page.getByText('should register a new user', { exact: true })).toBeVisible()
  const timeToUsableMs = performance.now() - started
  const scenario = page.locator('details').filter({ hasText: 'should register a new user' }).first()
  const expansionStarted = performance.now()
  await scenario.locator('summary').click()
  await expect(scenario).toHaveAttribute('open', '')
  const scenarioExpansionMs = performance.now() - expansionStarted
  const claim = wire.relatedScenarios[0]?.invocations[0] ?? wire.relatedScenarios[0]?.assertions[0]
  expect(claim, 'The direct scenario must expose a source claim for evidence inspection.').toBeDefined()
  const inspectionStarted = performance.now()
  await scenario.locator('button').filter({ hasText: claim!.sourceText }).first().click()
  await expect(scenario.getByRole('region', { name: 'Selected static claim evidence' })).toBeVisible()
  const evidenceInspectionMs = performance.now() - inspectionStarted
  const graphStarted = performance.now()
  await scenario.getByRole('button', { name: 'Show visual trace' }).click()
  await expect(scenario.locator('.react-flow')).toBeVisible()
  await expect(scenario.locator('.react-flow__node').first()).toBeVisible()
  const graphReadyMs = performance.now() - graphStarted
  await expect(page.getByText('RUNTIME_OBSERVATIONS_NOT_IMPORTED', { exact: true })).toBeVisible()

  const secondResponse = waitForComprehensionResponse(page, multiMethodId!)
  const methodSwitchStarted = performance.now()
  await page.goto(`/repositories/${repositoryId}/snapshots/${snapshotId}/artifacts/${multiMethodId}`)
  const secondNetworkResponse = await secondResponse
  const secondWire = await parseComprehensionResponse(secondNetworkResponse)
  expect(secondWire.relatedScenarios).toHaveLength(3)
  await expect(page.locator('details')).toHaveCount(3)
  const methodSwitchMs = performance.now() - methodSwitchStarted
  const switchStart = performance.now()
  const nextScenario = page.locator('details').nth(1)
  await nextScenario.locator('summary').click()
  await nextScenario.getByRole('button', { name: 'Show visual trace' }).click()
  await expect(nextScenario.locator('.react-flow')).toBeVisible()
  const scenarioSwitchMs = performance.now() - switchStart
  const mockResponse = waitForComprehensionResponse(page, mockMethodId!)
  await page.goto(`/repositories/${repositoryId}/snapshots/${snapshotId}/artifacts/${mockMethodId}`)
  const mockNetworkResponse = await mockResponse
  const mockWire = await parseComprehensionResponse(mockNetworkResponse)
  expect(mockWire.relatedScenarios[0].mockedBoundaries).toHaveLength(1)
  expect(mockWire.relatedScenarios.some(item => item.unresolved.some(diagnostic =>
    diagnostic.code === 'ASSERTION_INVOCATION_UNRESOLVED'))).toBe(true)
  const mockScenario = page.locator('details').filter({ hasText: 'should find a user from the payload' }).first()
  await mockScenario.locator('summary').click()
  await expect(mockScenario.getByText('mockedUserRepository.findOne.mockResolvedValueOnce(user)', { exact: true })).toBeVisible()
  await expect(mockScenario.getByText(/ASSERTION_INVOCATION_UNRESOLVED/)).toBeVisible()
  const indirectResponse = waitForComprehensionResponse(page, indirectMethodId!)
  await page.goto(`/repositories/${repositoryId}/snapshots/${snapshotId}/artifacts/${indirectMethodId}`)
  const indirectNetworkResponse = await indirectResponse
  const indirectWire = await parseComprehensionResponse(indirectNetworkResponse)
  expect(indirectWire.relatedScenarios.some((item: { trace?: { relation: string } }) =>
    item.trace?.relation === 'CALL_PATH')).toBe(true)
  await expect(page.locator('details').first()).toBeVisible()
  const noTestResponse = waitForComprehensionResponse(page, noTestMethodId!)
  await page.goto(`/repositories/${repositoryId}/snapshots/${snapshotId}/artifacts/${noTestMethodId}`)
  const noTestNetworkResponse = await noTestResponse
  const noTestWire = await parseComprehensionResponse(noTestNetworkResponse)
  expect(noTestWire.relatedScenarios).toHaveLength(0)
  await expect(page.getByText('No supported test-to-code reference was persisted.', { exact: false })).toBeVisible()
  await expect(page.getByText('NO_SUPPORTED_TEST_REFERENCE', { exact: true })).toBeVisible()
  const projections = [wire, secondWire, mockWire, indirectWire, noTestWire]
  for (const projection of projections) {
    expect(projection.snapshotContext.snapshotId).toBe(snapshotId)
    expect(projection.snapshotContext.commitSha).toBe(commitSha)
    expect(projection.snapshotContext.runtimeObservations).toBe('NOT_IMPORTED')
    expect(projection.codeEvidence.source.commitSha).toBe(commitSha)
    expect(projection.codeEvidence.source.filePath).toBe(projection.selectedCode.filePath)
    expect(projection.codeEvidence.source.artifactId).toBe(projection.selectedCode.id)
    expect(projection.codeEvidence.source.id).toBeTruthy()
    expect(projection.codeEvidence.source.provenanceKey).toBeTruthy()
    const sourceFile = path.resolve(corpusRoot, projection.codeEvidence.source.filePath)
    expect(sourceFile.startsWith(`${corpusRoot}${path.sep}`)).toBe(true)
    expect(existsSync(sourceFile)).toBe(true)
    for (const scenarioItem of projection.relatedScenarios) {
      for (const relation of scenarioItem.trace?.relationships ?? []) {
        expect(relation.evidence?.commitSha).toBe(commitSha)
        expect(relation.evidence?.provenanceKey).toBeTruthy()
      }
    }
  }
  const apiResponseBytes = (await Promise.all([
    firstNetworkResponse, secondNetworkResponse, mockNetworkResponse,
    indirectNetworkResponse, noTestNetworkResponse,
  ].map(response => response.body()))).reduce((bytes, body) => bytes + body.byteLength, 0)
  const metrics = { timeToUsableMs, scenarioExpansionMs, graphReadyMs,
    evidenceInspectionMs, methodSwitchMs, scenarioSwitchMs, apiResponseBytes, method: wire.selectedCode.name,
    scenariosAfterSelection: secondWire.relatedScenarios.length,
    mockClaims: mockWire.relatedScenarios[0].mockedBoundaries.length,
    indirectScenarios: indirectWire.relatedScenarios.length, noTestScenarios: noTestWire.relatedScenarios.length,
    snapshotId, commitSha }
  await testInfo.attach('pinned-real-comprehension-metrics', {
    body: JSON.stringify(metrics, null, 2), contentType: 'application/json',
  })
  if (recordsProof) {
    const recordedProof = JSON.parse(readFileSync(proofFile, 'utf8')) as Record<string, unknown> & {
      browserVerification?: { samples?: Array<typeof metrics>; metrics?: typeof metrics },
    }
    const previousSamples = recordedProof.browserVerification?.samples ?? []
    const samples = [...previousSamples, metrics]
    const timingKeys = ['timeToUsableMs', 'scenarioExpansionMs', 'graphReadyMs',
      'evidenceInspectionMs', 'methodSwitchMs', 'scenarioSwitchMs'] as const
    const latency = Object.fromEntries(timingKeys.map(key => {
      const values = samples.map(sample => sample[key]).sort((left, right) => left - right)
      return [key, { count: values.length, p50: values[Math.ceil(values.length * 0.5) - 1],
        p95: values[Math.ceil(values.length * 0.95) - 1] }]
    }))
    writeFileSync(proofFile, `${JSON.stringify({ ...recordedProof,
      apiVerification: { status: 'PASSED', responses: projections.length * samples.length,
        responseBytes: samples.reduce((bytes, sample) => bytes + sample.apiResponseBytes, 0),
        contractValidated: true, snapshotAndProvenanceValidated: true },
      browserVerification: { status: 'INCOMPLETE',
        assertionStatus: hasRequiredBrowserProofSamples(samples.length) ? 'PASSED' : 'INCOMPLETE', samples, latency },
    }, null, 2)}\n`)
  }
  process.stdout.write(`${JSON.stringify({ pinnedRealBrowserSample: metrics })}\n`)
})
