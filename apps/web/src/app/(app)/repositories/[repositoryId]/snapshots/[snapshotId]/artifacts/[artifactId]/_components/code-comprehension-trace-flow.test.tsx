import { fireEvent, render, screen } from "@testing-library/react"
import { CodeComprehensionTraceFlow } from "./code-comprehension-trace-flow"
import type { ComprehensionScenario } from "@ba-helper/contracts"

jest.mock("next-intl", () => ({
  useTranslations: () => (key: string, values?: Record<string, string>) => {
    const messages: Record<string, string> = {
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
    }
    return (messages[key] ?? key).replace(/\{([^}]+)\}/g, (_match, name: string) => values?.[name] ?? `{${name}}`)
  },
}))

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
