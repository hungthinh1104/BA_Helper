import { act, fireEvent, render, screen } from "@testing-library/react"
import type { CodeComprehensionResponse, TestStaticBehaviorClaim } from "@ba-helper/contracts"
import CodeComprehensionPage from "./page"
import { useCodeComprehension } from "@/hooks/api/use-code-comprehension"

jest.mock("@/hooks/api/use-code-comprehension", () => ({
  ...jest.requireActual("@/hooks/api/use-code-comprehension"),
  useCodeComprehension: jest.fn(),
}))
jest.mock("@/i18n/navigation", () => ({ useLocalizedHref: () => (path: string) => path }))
jest.mock("next-intl", () => ({ useTranslations: () => (key: string) => ({
  scenarioDirectReference: "Direct static test reference",
  scenarioIndirectCallPath: "Indirect static call path",
  scenarioNoTracePath: "No supported trace path recorded",
  scenarioShowVisualTrace: "Show visual trace",
  scenarioHideVisualTrace: "Hide visual trace",
  scenarioSetupLabel: "Declared setup",
  scenarioInputsLabel: "Declared inputs",
  scenarioInvocationsLabel: "Declared invocations",
  scenarioAssertionsLabel: "Declared assertions",
  scenarioMocksLabel: "Mock declarations",
  scenarioExpectedOutcomesLabel: "Declared expected outcomes",
  scenarioAssociationsTitle: "Static invocation/assertion associations",
  scenarioAssociationsDescription: "Source relationships only; they do not establish a passing result.",
  scenarioInvocationUnresolved: "Invocation unresolved",
  scenarioExpectedValueCount: "(1 declared expected value)",
  scenarioUnresolvedEvidenceLabel: "Unresolved evidence",
  scenarioComparisonLabel: "Scenario comparison",
  scenarioComparisonTitle: "Compare extracted scenarios",
  scenarioFirstSelectLabel: "First scenario",
  scenarioSecondSelectLabel: "Second scenario",
  scenarioSetupComparisonLabel: "Setup declarations",
  scenarioInputsComparisonLabel: "Input declarations",
  scenarioInvocationsComparisonLabel: "Invocation declarations",
  scenarioAssertionsComparisonLabel: "Assertion declarations",
  scenarioMocksComparisonLabel: "Mock declarations",
  scenarioExpectedOutcomesComparisonLabel: "Expected outcome declarations",
  scenarioComparisonCounts: "{label}: {leftCount} vs {rightCount} static declarations",
  scenarioOnlyFirst: "Only first",
  scenarioOnlySecond: "Only second",
  scenarioRelationshipCounts: "Relationships: {leftCount} vs {rightCount} static edges",
  scenarioComparisonDescription: "Differences compare exact extracted source claims and static relationships only; they do not compare runtime behavior or test outcomes.",
  selectedStaticClaimEvidenceLabel: "Selected static claim evidence",
  selectedStaticEvidenceTitle: "Selected static evidence",
  scenarioSourceDeclarationCommit: "Source declaration · claim commit {commitSha}",
  scenarioContextLabel: "Scenario: {title}",
  scenarioSnapshotContext: "snapshot {snapshotId} · snapshot commit {commitSha}",
  traceNoConnectedPath: "No connected static path is available for this scenario.",
  traceRegionLabel: "Interactive static test trace",
  traceSelectedArtifact: "Selected artifact:",
  traceSnapshotContext: "Snapshot {snapshotId} · commit {commitSha}",
  traceSelectedRelationship: "Selected {relationship} relationship.",
  traceEvidenceMetadata: "{evidenceKind} · {sourceType} · commit {commitSha}",
  traceSnapshotLabel: "Snapshot {snapshotId}",
  traceNoPersistedEvidence: "No persisted source evidence is attached to this edge; the relationship remains static and unresolved for inspection.",
  traceInspectHint: "Select a node or edge to inspect its static identity and evidence.",
  traceEdgeCalls: "calls",
  traceEdgeTests: "tests",
  traceEdgeReferences: "references",
  traceEdgeImports: "imports",
  traceEvidenceProductionSource: "production source",
  traceEvidenceStaticTestDeclaration: "static test declaration",
  traceEvidenceStaticEdge: "static edge",
  traceSourceCode: "code",
  traceSourceTest: "test",
  traceSourceStaticAnalysis: "static analysis",
  traceTestNode: "TEST",
  traceCodeNode: "CODE",
})[key] ?? key }))
jest.mock("@/components/workspace/shared/back-button", () => ({
  BackButton: ({ href, label }: { href: string; label: string }) => <a href={href}>{label}</a>,
}))
jest.mock("@/components/workspace/shared/page-header", () => ({
  WorkspacePageHeader: ({ title }: { title: string }) => <h1>{title}</h1>,
}))

const methodId = "00000000-0000-4000-8000-000000000001"
const scenarioId = "00000000-0000-4000-8000-000000000002"
const repositoryId = "00000000-0000-4000-8000-000000000010"
const snapshotId = "00000000-0000-4000-8000-000000000011"
const commitSha = "a".repeat(40)
function behaviorClaim(kind: TestStaticBehaviorClaim["kind"], sourceText: string, line: number, startOffset: number,
  assertionKind?: TestStaticBehaviorClaim["assertionKind"]): TestStaticBehaviorClaim {
  return {
    kind, ...(assertionKind ? { assertionKind } : {}), evidenceKind: "STATIC_DECLARATION", sourceText,
    sourceLocation: {
      relativePath: "test/refund.spec.ts", startOffset, endOffset: startOffset + sourceText.length,
      startLine: line, startColumn: 3, endLine: line, endColumn: 3 + sourceText.length,
    },
    commitSha, evidenceProvenanceKey: `snapshot:s1:${line}:${startOffset}`,
  }
}
const setupClaim = behaviorClaim("SETUP_HOOK", "paymentGateway.refund.mockResolvedValue({ refunded: true })", 2, 30)
const inputClaim = behaviorClaim("INPUT", 'const bookingId = "booking-1"', 3, 90)
const invocationClaim = behaviorClaim("ACTION", "service.cancelBooking(bookingId)", 5, 160)
const assertionClaim = behaviorClaim("ASSERTION", "expect(result).toEqual({ refunded: true })", 6, 210, "RETURN_VALUE")
const mockClaim = behaviorClaim("MOCK", 'jest.spyOn(paymentGateway, "refund")', 2, 80)
const outcomeClaim = behaviorClaim("EXPECTED_OUTCOME", "expect(result.refunded).toBe(true)", 7, 260, "RETURN_VALUE")
const response = {
  selectedCode: {
    id: methodId, artifactKey: "method:refund", name: "refundBooking", artifactType: "METHOD",
    universalKind: "METHOD", filePath: "src/refund.ts", startLine: 10, endLine: 15,
  },
  codeEvidence: {
    source: {
      id: "00000000-0000-4000-8000-000000000003", evidenceKind: "PRODUCTION_SOURCE", sourceType: "CODE",
      artifactId: methodId, provenanceKey: "snapshot:s1:source:refund", filePath: "src/refund.ts",
      startLine: 10, endLine: 15, excerpt: "return service.refund()", commitSha,
    },
    parameters: [], returnType: null, conditions: [], exceptionHandlers: [], dependencies: [], staticCalls: [],
  },
  relatedScenarios: [{
    testArtifact: {
      id: scenarioId, artifactKey: "test:refund", name: "Refund paid booking", artifactType: "JEST_TEST_CASE",
      universalKind: "TEST_CASE", filePath: "test/refund.spec.ts", startLine: 4, endLine: 8,
    },
    setup: [setupClaim], inputs: [inputClaim], invocations: [invocationClaim], assertions: [assertionClaim],
    behaviorAssociations: [{
      associationId: "test/refund.spec.ts:5:6", invocation: invocationClaim, assertion: assertionClaim,
      expectedOutcomes: [outcomeClaim], mockedBoundaries: [mockClaim], basis: "AST_SUBJECT_REFERENCE", unresolved: [],
    }],
    trace: { relation: "DIRECT_REFERENCE", artifacts: [], relationships: [] },
    mockedBoundaries: [mockClaim], expectedOutcomes: [outcomeClaim], unresolved: [],
  }],
  scenarioPagination: { limit: 50, offset: 0, hasMore: false },
  limitations: [{ code: "STATIC_ONLY", severity: "INFO", message: "Runtime behavior was not observed." }],
  snapshotContext: {
    repositoryId, snapshotId,
    commitSha, analyzerVersion: "0.15.0", coverageStatus: "READY", basis: "STATIC_SOURCE_REFERENCE",
    runtimeObservations: "NOT_IMPORTED",
  },
  limits: { maxCallDepth: 2, maxScenarios: 50, maxRelationships: 250 },
  truncated: false,
} as unknown as CodeComprehensionResponse

const query = {
  data: { pages: [response] }, isLoading: false, isError: false, error: null, hasNextPage: false,
  isFetchingNextPage: false, isFetchNextPageError: false, fetchNextPage: jest.fn(), refetch: jest.fn(),
}

async function renderCondition(condition?: string) {
  const suppliedResponse = JSON.parse(JSON.stringify(response)) as CodeComprehensionResponse
  jest.mocked(useCodeComprehension).mockReturnValue({
    ...query, data: { pages: [suppliedResponse] },
  } as never)
  let view!: ReturnType<typeof render>
  await act(async () => {
    view = render(<CodeComprehensionPage
      params={Promise.resolve({ repositoryId, snapshotId, artifactId: methodId })}
      searchParams={Promise.resolve(condition === undefined ? {} : { studyCondition: condition })}
    />)
  })
  await screen.findByRole("heading", { name: "refundBooking" })
  fireEvent.click(screen.getByText("Refund paid booking"))
  return {
    view,
    evidenceText: view.container.textContent?.replace("Show visual trace", "").replace(/\s+/g, " ").trim(),
    projection: suppliedResponse,
    queryArgs: jest.mocked(useCodeComprehension).mock.lastCall,
    graphControl: screen.queryByRole("button", { name: "Show visual trace" }),
  }
}

describe("code comprehension study conditions", () => {
  beforeEach(() => jest.mocked(useCodeComprehension).mockClear())

  it("keeps the B and C evidence projection identical and changes only graph availability", async () => {
    const textual = await renderCondition("TEXTUAL_EVIDENCE")
    expect(textual.graphControl).not.toBeInTheDocument()
    expect(screen.queryByRole("link", { name: "Back to repository" })).not.toBeInTheDocument()
    for (const claim of [setupClaim, inputClaim, invocationClaim, assertionClaim, mockClaim, outcomeClaim]) {
      expect(textual.evidenceText).toContain(claim.sourceText)
    }
    expect(screen.getByText("Direct static test reference")).toBeInTheDocument()
    expect(screen.getByText("Declared assertions")).toBeInTheDocument()
    expect(screen.getByText("Mock declarations")).toBeInTheDocument()
    expect(screen.getByText("Source relationships only; they do not establish a passing result.")).toBeInTheDocument()
    textual.view.unmount()

    const visual = await renderCondition("VISUAL_TEST_TRACE")
    expect(visual.graphControl).toBeInTheDocument()
    expect(screen.queryByRole("link", { name: "Back to repository" })).not.toBeInTheDocument()
    expect(visual.evidenceText).toBe(textual.evidenceText)
    expect(visual.queryArgs).toEqual(textual.queryArgs)
    expect(visual.queryArgs).toEqual([snapshotId, methodId, true])
    expect(visual.projection.selectedCode).toEqual(textual.projection.selectedCode)
    expect(visual.projection.codeEvidence).toEqual(textual.projection.codeEvidence)
    expect(visual.projection.snapshotContext).toEqual(textual.projection.snapshotContext)
    expect(visual.projection.relatedScenarios).toEqual(textual.projection.relatedScenarios)
    expect(visual.projection.relatedScenarios[0]).toMatchObject({
      setup: [setupClaim], inputs: [inputClaim], invocations: [invocationClaim], assertions: [assertionClaim],
      behaviorAssociations: [{ invocation: invocationClaim, assertion: assertionClaim }],
      mockedBoundaries: [mockClaim], expectedOutcomes: [outcomeClaim],
    })
    expect(visual.projection.limitations).toEqual(textual.projection.limitations)
  })

  it("shows a compact evidence overview without presenting loaded scenarios as the full total", async () => {
    await renderCondition("TEXTUAL_EVIDENCE")

    const overview = screen.getByRole("region", { name: "Evidence overview" })
    expect(overview).toHaveTextContent("Production source")
    expect(overview).toHaveTextContent("Excerpt available")
    expect(overview).toHaveTextContent("Source facts")
    expect(overview).toHaveTextContent("Related scenarios")
    expect(overview).toHaveTextContent("1 currently loaded")
    expect(overview).toHaveTextContent("1 direct static test reference")
    expect(overview).toHaveTextContent("Uncertainty")
    expect(overview).toHaveTextContent("Runtime not imported")
  })

  it("offers a retry when the first comprehension request fails", async () => {
    const refetch = jest.fn()
    jest.mocked(useCodeComprehension).mockReturnValue({
      ...query, data: undefined, isError: true, error: new Error("Connection failed"), refetch,
    } as never)

    await act(async () => render(<CodeComprehensionPage
      params={Promise.resolve({ repositoryId, snapshotId, artifactId: methodId })}
      searchParams={Promise.resolve({})}
    />))

    expect(screen.getByRole("heading", { name: "Code evidence unavailable" })).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Retry loading code evidence" }))

    expect(refetch).toHaveBeenCalledTimes(1)
  })

  it("keeps the existing-workflow condition outside BA Helper evidence", async () => {
    await act(async () => render(<CodeComprehensionPage
      params={Promise.resolve({ repositoryId, snapshotId, artifactId: methodId })}
      searchParams={Promise.resolve({ studyCondition: "EXISTING_WORKFLOW" })}
    />))

    expect(await screen.findByRole("heading", { name: "Use the existing workflow" })).toBeInTheDocument()
    expect(useCodeComprehension).toHaveBeenCalledWith(snapshotId, methodId, false)
  })

  it("fails closed on an unsupported study condition instead of exposing normal Explorer mode", async () => {
    await act(async () => render(<CodeComprehensionPage
      params={Promise.resolve({ repositoryId, snapshotId, artifactId: methodId })}
      searchParams={Promise.resolve({ studyCondition: "TYPOGRAPHICAL_ERROR" })}
    />))

    expect(await screen.findByRole("heading", { name: "Unsupported study condition" })).toBeInTheDocument()
    expect(screen.queryByRole("heading", { name: "refundBooking" })).not.toBeInTheDocument()
    expect(useCodeComprehension).toHaveBeenCalledWith(snapshotId, methodId, false)
  })

  it("fails closed when duplicate study condition parameters make the assignment ambiguous", async () => {
    await act(async () => render(<CodeComprehensionPage
      params={Promise.resolve({ repositoryId, snapshotId, artifactId: methodId })}
      searchParams={Promise.resolve({ studyCondition: ["TEXTUAL_EVIDENCE", "VISUAL_TEST_TRACE"] })}
    />))

    expect(await screen.findByRole("heading", { name: "Unsupported study condition" })).toBeInTheDocument()
    expect(useCodeComprehension).toHaveBeenCalledWith(snapshotId, methodId, false)
  })

  it("keeps normal Explorer navigation available without a study condition", async () => {
    const normal = await renderCondition()

    expect(normal.graphControl).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Back to repository" })).toBeInTheDocument()
    expect(normal.queryArgs).toEqual([snapshotId, methodId, true])
  })
})
