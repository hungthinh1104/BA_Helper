import { fireEvent, render, screen } from "@testing-library/react"
import type { CodeComprehensionResponse, ComprehensionScenario } from "@ba-helper/contracts"
import { ScenarioList } from "./scenario-list"

const scenario = {
  testArtifact: {
    id: "00000000-0000-4000-8000-000000000001",
    artifactKey: "test:refund",
    name: "refunds",
    artifactType: "JEST_TEST_CASE",
    universalKind: "TEST_CASE",
    filePath: "test/refund.spec.ts",
    startLine: 4,
    endLine: 8,
  },
  setup: [],
  inputs: [],
  invocations: [],
  assertions: [],
  behaviorAssociations: [],
  mockedBoundaries: [],
  expectedOutcomes: [],
  unresolved: [],
} as unknown as ComprehensionScenario

const snapshotContext = {
  snapshotId: "00000000-0000-4000-8000-000000000010",
  commitSha: "a".repeat(40),
}
const pagination: CodeComprehensionResponse["scenarioPagination"] = { limit: 50, offset: 0, hasMore: true }

function renderList(overrides: Partial<Parameters<typeof ScenarioList>[0]> = {}) {
  const onLoadMore = jest.fn()
  render(<ScenarioList
    scenarios={[scenario]}
    snapshotContext={snapshotContext}
    pagination={pagination}
    limitations={[]}
    hasNextPage
    isFetchingNextPage={false}
    isFetchNextPageError={false}
    onLoadMore={onLoadMore}
    tracePresentation="NORMAL"
    {...overrides}
  />)
  return onLoadMore
}

describe("ScenarioList pagination", () => {
  it("summarizes loaded scenarios with readable static relationship labels", () => {
    const direct = {
      ...scenario,
      testArtifact: { ...scenario.testArtifact, id: "00000000-0000-4000-8000-000000000002", name: "direct" },
      trace: { relation: "DIRECT_REFERENCE", artifacts: [], relationships: [] },
    } as unknown as ComprehensionScenario
    const indirect = {
      ...scenario,
      testArtifact: { ...scenario.testArtifact, id: "00000000-0000-4000-8000-000000000003", name: "indirect" },
      trace: { relation: "CALL_PATH", artifacts: [], relationships: [] },
    } as unknown as ComprehensionScenario

    renderList({ scenarios: [direct, indirect, scenario] })

    expect(screen.getByRole("status")).toHaveTextContent("Showing 3 currently loaded related scenarios.")
    expect(screen.getByText("Direct static test reference")).toBeInTheDocument()
    expect(screen.getByText("Indirect static call path")).toBeInTheDocument()
    expect(screen.getByText("No supported trace path recorded")).toBeInTheDocument()
  })

  it("shows a working load-more control when another API page is available", () => {
    const onLoadMore = renderList()

    fireEvent.click(screen.getByRole("button", { name: "Load more scenarios" }))

    expect(onLoadMore).toHaveBeenCalledTimes(1)
    expect(screen.getByRole("status")).toHaveTextContent("Showing 1 currently loaded related scenario.")
  })

  it("offers a retry after loading another page fails", () => {
    const onLoadMore = renderList({ isFetchNextPageError: true })

    fireEvent.click(screen.getByRole("button", { name: "Retry loading scenarios" }))

    expect(screen.getByRole("alert")).toHaveTextContent("More scenarios could not be loaded")
    expect(screen.queryByRole("button", { name: "Load more scenarios" })).not.toBeInTheDocument()
    expect(onLoadMore).toHaveBeenCalledTimes(1)
  })

  it("disables the retry control and announces progress while a failed page is retried", () => {
    renderList({ isFetchNextPageError: true, isFetchingNextPage: true })

    expect(screen.getByRole("button", { name: "Retrying scenarios..." })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Retrying scenarios..." })).toHaveAttribute("aria-busy", "true")
  })

  it("shows the retrieval cap when no further API page is available", () => {
    renderList({
      hasNextPage: false,
      pagination: { ...pagination, hasMore: false },
      limitations: [{ code: "SCENARIO_OFFSET_LIMIT", message: "More validated scenarios exist.", severity: "WARN" }],
    })

    expect(screen.queryByRole("button", { name: "Load more scenarios" })).not.toBeInTheDocument()
    expect(screen.getByText(/API retrieval limit was reached/)).toHaveTextContent("More source-linked scenarios exist beyond the available pages")
  })
})
