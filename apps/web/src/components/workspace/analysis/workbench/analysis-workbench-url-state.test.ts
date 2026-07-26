import { describe, expect, it } from "@jest/globals"
import { readAnalysisWorkbenchUrlState, writeAnalysisWorkbenchUrlState } from "./analysis-workbench-url-state"

describe("analysis workbench URL state", () => {
  it("reads supported query state without accepting raw workspace content", () => {
    const state = readAnalysisWorkbenchUrlState(new URLSearchParams("view=review&item=item-1&filter=blocking&display=evidence&text=secret"))
    expect(state).toEqual({ view: "review", item: "item-1", filter: "blocking", display: "evidence" })
  })

  it("falls back safely for invalid values and preserves unrelated parameters", () => {
    const current = new URLSearchParams("locale=vi-VN&view=graph&filter=unknown&display=raw")
    expect(readAnalysisWorkbenchUrlState(current)).toEqual({ view: null, item: null, filter: "all", display: "evidence" })
    expect(writeAnalysisWorkbenchUrlState(current, { view: "review", item: "impact-1" }).toString()).toBe("locale=vi-VN&view=review&item=impact-1")
  })

  it("maps legacy ?tab= deep-links onto the current view/display model", () => {
    expect(readAnalysisWorkbenchUrlState(new URLSearchParams("tab=review-queue")).view).toBe("review")
    expect(readAnalysisWorkbenchUrlState(new URLSearchParams("tab=insights")).view).toBe("summary")
    expect(readAnalysisWorkbenchUrlState(new URLSearchParams("tab=qa-coverage")).view).toBe("risks-qa")
    expect(readAnalysisWorkbenchUrlState(new URLSearchParams("tab=lineage")).view).toBe("history")
    const graph = readAnalysisWorkbenchUrlState(new URLSearchParams("tab=graph"))
    expect(graph).toMatchObject({ view: "review", display: "dependency-path" })
  })

  it("prefers an explicit view over a legacy tab", () => {
    expect(readAnalysisWorkbenchUrlState(new URLSearchParams("view=summary&tab=graph")).view).toBe("summary")
  })
})
