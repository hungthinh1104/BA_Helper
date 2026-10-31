import { fireEvent, render, screen } from "@testing-library/react"
import type { ComprehensionScenario, TestStaticBehaviorClaim } from "@ba-helper/contracts"
import { mergeScenarioPages } from "@/hooks/api/use-code-comprehension"
import { Scenario, ScenarioComparison } from "./_components/scenario-inspector"

jest.mock("next-intl", () => ({
  useTranslations: () => (key: string) => ({
    scenarioSetupLabel: "Declared setup",
    scenarioInputsLabel: "Declared inputs",
    scenarioInvocationsLabel: "Declared invocations",
    scenarioAssertionsLabel: "Declared assertions",
    scenarioMocksLabel: "Mock declarations",
    scenarioExpectedOutcomesLabel: "Declared expected outcomes",
    scenarioDirectReference: "Direct static test reference",
    scenarioIndirectCallPath: "Indirect static call path",
    scenarioNoTracePath: "No supported trace path recorded",
    scenarioHideVisualTrace: "Hide visual trace",
    scenarioShowVisualTrace: "Show visual trace",
    scenarioLoadingVisualTrace: "Loading visual trace…",
    scenarioAssociationsTitle: "Static invocation/assertion associations",
    scenarioAssociationsDescription: "Source relationships only; they do not establish a passing result.",
    scenarioInvocationUnresolved: "Invocation unresolved",
    scenarioExpectedValueCount: "(1 declared expected value)",
    scenarioUnresolvedEvidenceLabel: "Unresolved evidence",
    scenarioSetupComparisonLabel: "Setup declarations",
    scenarioInputsComparisonLabel: "Input declarations",
    scenarioInvocationsComparisonLabel: "Invocation declarations",
    scenarioAssertionsComparisonLabel: "Assertion declarations",
    scenarioMocksComparisonLabel: "Mock declarations",
    scenarioExpectedOutcomesComparisonLabel: "Expected outcome declarations",
    scenarioComparisonLabel: "Scenario comparison",
    scenarioComparisonTitle: "Compare extracted scenarios",
    scenarioFirstSelectLabel: "First scenario",
    scenarioSecondSelectLabel: "Second scenario",
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
  })[key] ?? key,
}))

const claim: TestStaticBehaviorClaim = {
  kind: "ACTION",
  evidenceKind: "STATIC_DECLARATION",
  sourceText: "service.refund()",
  sourceLocation: {
    relativePath: "test/refund.spec.ts", startOffset: 20, endOffset: 36,
    startLine: 5, startColumn: 3, endLine: 5, endColumn: 19,
  },
  commitSha: "a".repeat(40),
  evidenceProvenanceKey: "snapshot:s1:artifact:test",
}

const scenario: ComprehensionScenario = {
  testArtifact: {
    id: "00000000-0000-4000-8000-000000000001", artifactKey: "test:refund", name: "refunds",
    artifactType: "JEST_TEST_CASE", universalKind: "TEST_CASE", filePath: "test/refund.spec.ts",
    startLine: 4, endLine: 8,
  },
  setup: [], inputs: [], invocations: [claim], assertions: [], mockedBoundaries: [], expectedOutcomes: [],
  behaviorAssociations: [], unresolved: [],
}
const directScenario = {
  ...scenario,
  trace: { relation: "DIRECT_REFERENCE", artifacts: [], relationships: [] },
} as unknown as ComprehensionScenario

describe("Scenario static claim inspector", () => {
  it("does not offer an empty visual trace for a scenario without a supported path", () => {
    render(<Scenario scenario={scenario} />)
    fireEvent.click(screen.getByText("refunds"))

    expect(screen.getByText("No supported trace path recorded")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Show visual trace" })).not.toBeInTheDocument()
  })

  it("reveals exact source provenance when a claim is selected", () => {
    render(<Scenario scenario={scenario} />)
    fireEvent.click(screen.getByRole("button", { name: /service\.refund/ }))

    expect(screen.getByRole("region", { name: "Selected static claim evidence" })).toHaveTextContent(
      "test/refund.spec.ts:5:3-5:19",
    )
    expect(screen.getByText(/Source declaration · claim commit/)).toBeInTheDocument()
  })

  it("shows exact claim differences when comparing extracted scenarios", () => {
    const second = {
      ...scenario,
      testArtifact: { ...scenario.testArtifact, id: "00000000-0000-4000-8000-000000000002", name: "other" },
      inputs: [claim],
      invocations: [],
    }
    render(<ScenarioComparison scenarios={[scenario, second]} />)

    expect(screen.getByLabelText("Scenario comparison")).toHaveTextContent("Only first: service.refund()")
    expect(screen.getByLabelText("Scenario comparison")).toHaveTextContent("Only second: service.refund()")
  })

  it("hides graph interactions in textual study mode while preserving the same source evidence", () => {
    render(<Scenario scenario={directScenario} tracePresentation="TEXTUAL_EVIDENCE" />)
    fireEvent.click(screen.getByText("refunds"))

    expect(screen.queryByRole("button", { name: "Show visual trace" })).not.toBeInTheDocument()
    expect(screen.getByText("service.refund()")).toBeInTheDocument()
    expect(screen.getByText("test/refund.spec.ts:5:3")).toBeInTheDocument()
  })

  it("enables the visual trace on the same scenario evidence in visual study mode", () => {
    render(<Scenario scenario={directScenario} tracePresentation="VISUAL_TEST_TRACE" />)
    fireEvent.click(screen.getByText("refunds"))

    expect(screen.getByRole("button", { name: "Show visual trace" })).toBeInTheDocument()
    expect(screen.getByText("service.refund()")).toBeInTheDocument()
    expect(screen.getByText("test/refund.spec.ts:5:3")).toBeInTheDocument()
  })

  it("keeps paginated scenario order and removes duplicate identities", () => {
    const second = { ...scenario, testArtifact: { ...scenario.testArtifact, id: "00000000-0000-4000-8000-000000000002", name: "second" } }
    const third = { ...scenario, testArtifact: { ...scenario.testArtifact, id: "00000000-0000-4000-8000-000000000003", name: "third" } }

    expect(mergeScenarioPages([[scenario, second], [second, third]]).map((item) => item.testArtifact.id)).toEqual([
      scenario.testArtifact.id, second.testArtifact.id, third.testArtifact.id,
    ])
  })
})
