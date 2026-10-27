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
  it("shows a working load-more control when another API page is available", () => {
    const onLoadMore = renderList()

    fireEvent.click(screen.getByRole("button", { name: "Load more scenarios" }))

    expect(onLoadMore).toHaveBeenCalledTimes(1)
    expect(screen.getByText("Showing 1 related scenario(s). Declarations do not establish execution or test results.")).toBeInTheDocument()
  })

  it("offers a retry after loading another page fails", () => {
    const onLoadMore = renderList({ isFetchNextPageError: true })

    fireEvent.click(screen.getByRole("button", { name: "Retry loading scenarios" }))

    expect(screen.getByRole("alert")).toHaveTextContent("More scenarios could not be loaded")
    expect(screen.queryByRole("button", { name: "Load more scenarios" })).not.toBeInTheDocument()
    expect(onLoadMore).toHaveBeenCalledTimes(1)
  })

  it("shows the retrieval cap when no further API page is available", () => {
    renderList({
      hasNextPage: false,
      pagination: { ...pagination, hasMore: false },
      limitations: [{ code: "SCENARIO_OFFSET_LIMIT", message: "More validated scenarios exist.", severity: "WARN" }],
    })

    expect(screen.queryByRole("button", { name: "Load more scenarios" })).not.toBeInTheDocument()
    expect(screen.getByRole("status")).toHaveTextContent("API retrieval limit was reached")
  })
})
