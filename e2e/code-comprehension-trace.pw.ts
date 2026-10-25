import { test, expect } from '@playwright/test'
import { seedDemo } from './fixtures/seed'
import { login } from './fixtures/auth'

const repositoryId = '00000000-0000-4000-8000-000000000101'
const snapshotId = '00000000-0000-4000-8000-000000000102'
const serviceId = '00000000-0000-4000-8000-000000000103'
const testId = '00000000-0000-4000-8000-000000000104'
const edgeId = '00000000-0000-4000-8000-000000000105'
const commitSha = 'browser-comprehension-commit'

test('opens static Visual Test Trace with source evidence and uncertainty labels', async ({ page }) => {
  test.setTimeout(120_000)
  const seed = seedDemo()
  await page.route('**/api/v1/snapshots/*/artifacts/*/comprehension*', async route => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(responseFixture()) })
  })
  await login(page, seed)
  await page.goto(`/repositories/${repositoryId}/snapshots/${snapshotId}/artifacts/${serviceId}`)

  await expect(page.getByRole('heading', { name: 'Source evidence', exact: true })).toBeVisible()
  await expect(page.getByText('Static evidence only', { exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Related Jest scenarios', exact: true })).toBeVisible()
  const scenario = page.locator('details').filter({ hasText: 'cancels a paid booking' }).first()
  await expect(scenario.locator('summary').getByText('cancels a paid booking', { exact: true })).toBeVisible()
  await scenario.locator('summary').click()
  await scenario.getByRole('button', { name: 'Show visual trace', exact: true }).click()
  await expect(scenario.getByRole('button', { name: 'Hide visual trace', exact: true })).toBeVisible()
  await expect(page.locator('.react-flow')).toBeVisible()
  await expect(page.getByText('RUNTIME_OBSERVATIONS_NOT_IMPORTED', { exact: true })).toBeVisible()
})

function location(relativePath: string, startOffset: number, endOffset: number, line: number) {
  return { relativePath, startOffset, endOffset, startLine: line, startColumn: 1, endLine: line, endColumn: endOffset - startOffset + 1 }
}

function responseFixture() {
  const invocationLocation = location('test/booking.spec.ts', 100, 123, 15)
  const assertionLocation = location('test/booking.spec.ts', 130, 155, 16)
  const expectedLocation = location('test/booking.spec.ts', 150, 160, 16)
  const provenanceKey = `snapshot:${snapshotId}:artifact:test:test/booking.spec.ts#cancel`
  const invocation = { kind: 'ACTION', evidenceKind: 'STATIC_DECLARATION', sourceText: 'service.cancel(bookingId)', sourceLocation: invocationLocation, commitSha, evidenceProvenanceKey: provenanceKey }
  const assertion = { kind: 'ASSERTION', assertionKind: 'RETURN_VALUE', evidenceKind: 'STATIC_DECLARATION', sourceText: 'expect(result).toBeUndefined()', sourceLocation: assertionLocation, relatedInvocationSourceLocation: invocationLocation, relatedSubjectText: 'result', commitSha, evidenceProvenanceKey: provenanceKey }
  const expected = { kind: 'EXPECTED_OUTCOME', assertionKind: 'RETURN_VALUE', evidenceKind: 'STATIC_DECLARATION', sourceText: 'undefined', sourceLocation: expectedLocation, relatedAssertionSourceLocation: assertionLocation, commitSha, evidenceProvenanceKey: provenanceKey }
  const service = { id: serviceId, artifactKey: 'service:src/booking.service.ts:BookingService.cancel', name: 'BookingService.cancel', artifactType: 'SERVICE_METHOD', universalKind: 'DOMAIN_SERVICE', filePath: 'src/booking.service.ts', startLine: 10, endLine: 24 }
  const testArtifact = { id: testId, artifactKey: 'test:test/booking.spec.ts#cancel', name: 'cancels a paid booking', artifactType: 'JEST_TEST_CASE', universalKind: 'TEST_CASE', filePath: 'test/booking.spec.ts', startLine: 8, endLine: 18 }
  return {
    selectedCode: service,
    codeEvidence: {
      source: { id: '00000000-0000-4000-8000-000000000106', evidenceKind: 'PRODUCTION_SOURCE', sourceType: 'CODE', artifactId: serviceId, provenanceKey: `snapshot:${snapshotId}:artifact:${service.artifactKey}`, filePath: service.filePath, startLine: 10, endLine: 24, excerpt: 'async cancel(bookingId: string): Promise<void> {\n  return;\n}', commitSha },
      parameters: [], returnType: null, conditions: [], exceptionHandlers: [], dependencies: [], staticCalls: [],
    },
    relatedScenarios: [{
      testArtifact, testCase: { framework: 'jest', suitePath: ['BookingService'], title: 'cancels a paid booking', modifier: 'NORMAL', declaredModifier: 'NORMAL', parentFileArtifactKey: 'test:test%2Fbooking.spec.ts#file', behaviorEvidence: [invocation, assertion, expected] },
      setup: [], inputs: [], invocations: [invocation], assertions: [assertion], mockedBoundaries: [], expectedOutcomes: [expected],
      behaviorAssociations: [{ associationId: 'assertion:test/booking.spec.ts:130', invocation, assertion, expectedOutcomes: [expected], mockedBoundaries: [], basis: 'AST_SUBJECT_REFERENCE', unresolved: [] }],
      trace: { relation: 'DIRECT_REFERENCE', artifacts: [testArtifact, service], relationships: [{ edgeId, type: 'TESTS', sourceArtifactId: testId, targetArtifactId: serviceId }] }, unresolved: [],
    }],
    scenarioPagination: { limit: 50, offset: 0, hasMore: false },
    limitations: [{ code: 'RUNTIME_OBSERVATIONS_NOT_IMPORTED', severity: 'INFO', message: 'Static declarations only.' }],
    snapshotContext: { repositoryId, snapshotId, commitSha, analyzerVersion: 'analyzer@0.14.0', coverageStatus: 'READY', basis: 'STATIC_SOURCE_REFERENCE', runtimeObservations: 'NOT_IMPORTED' },
    limits: { maxCallDepth: 4, maxScenarios: 50, maxRelationships: 80 }, truncated: false,
  }
}
