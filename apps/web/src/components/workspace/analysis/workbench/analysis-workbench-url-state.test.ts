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
})
