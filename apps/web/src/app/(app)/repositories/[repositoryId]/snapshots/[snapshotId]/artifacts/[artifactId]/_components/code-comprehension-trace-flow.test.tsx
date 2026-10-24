import { fireEvent, render, screen } from "@testing-library/react"
import { CodeComprehensionTraceFlow } from "./code-comprehension-trace-flow"
import type { ComprehensionScenario } from "@ba-helper/contracts"

const scenario: ComprehensionScenario = {
  testArtifact: { id: "00000000-0000-4000-8000-000000000001", artifactKey: "test:runs", name: "runs", artifactType: "JEST_TEST_CASE", universalKind: "TEST_CASE", filePath: "test.spec.ts", startLine: 4, endLine: 8 },
  setup: [], inputs: [], invocations: [], assertions: [], mockedBoundaries: [], expectedOutcomes: [], behaviorAssociations: [], unresolved: [],
  trace: {
    relation: "DIRECT_REFERENCE",
    artifacts: [
      { id: "00000000-0000-4000-8000-000000000001", artifactKey: "test:runs", name: "runs", artifactType: "JEST_TEST_CASE", universalKind: "TEST_CASE", filePath: "test.spec.ts", startLine: 4, endLine: 8 },
      { id: "00000000-0000-4000-8000-000000000002", artifactKey: "service:run", name: "Service.run", artifactType: "SERVICE_METHOD", universalKind: "DOMAIN_SERVICE", filePath: "service.ts", startLine: 10, endLine: 14 },
    ],
    relationships: [{ edgeId: "00000000-0000-4000-8000-000000000003", type: "TESTS", sourceArtifactId: "00000000-0000-4000-8000-000000000001", targetArtifactId: "00000000-0000-4000-8000-000000000002" }],
  },
}

describe("CodeComprehensionTraceFlow", () => {
  it("renders a bounded static path and exposes selected node context", () => {
    render(<CodeComprehensionTraceFlow scenario={scenario} snapshotContext={{ snapshotId: "00000000-0000-4000-8000-000000000010", commitSha: "a".repeat(40) }} />)
    expect(screen.getByRole("region", { name: "Interactive static test trace" })).toBeInTheDocument()
    expect(screen.getByText("Service.run")).toBeInTheDocument()
    fireEvent.click(screen.getByText("Service.run"))
    expect(screen.getByRole("status")).toHaveTextContent("Selected artifact: Service.run")
    expect(screen.getByRole("status")).toHaveTextContent("Snapshot 00000000-0000-4000-8000-000000000010")
  })
})
