import { fireEvent, render, screen } from "@testing-library/react"
import type { ComprehensionScenario, TestStaticBehaviorClaim } from "@ba-helper/contracts"
import { Scenario, ScenarioComparison } from "./page"

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

describe("Scenario static claim inspector", () => {
  it("reveals exact source provenance when a claim is selected", () => {
    render(<Scenario scenario={scenario} />)
    fireEvent.click(screen.getByRole("button", { name: /service\.refund/ }))

    expect(screen.getByRole("region", { name: "Selected static claim evidence" })).toHaveTextContent(
      "test/refund.spec.ts:5:3-5:19",
    )
    expect(screen.getByText(/STATIC_DECLARATION · claim commit/)).toBeInTheDocument()
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
})
