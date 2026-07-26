import type { AnalysisWorkspaceMode, ReviewDisplay, ReviewFilter } from "./analysis-workbench-types"

export interface AnalysisWorkbenchUrlState {
  view: AnalysisWorkspaceMode | null
  item: string | null
  filter: ReviewFilter
  display: ReviewDisplay
}

const modes = new Set<AnalysisWorkspaceMode>(["summary", "review", "risks-qa", "history"])
const filters = new Set<ReviewFilter>([
  "all",
  "blocking",
  "pending",
  "conflicting",
  "needs_more_evidence",
  "reviewed",
])
const displays = new Set<ReviewDisplay>(["evidence", "dependency-path"])

export function readAnalysisWorkbenchUrlState(
  params: Pick<URLSearchParams, "get">,
): AnalysisWorkbenchUrlState {
  const view = params.get("view")
  const filter = params.get("filter")
  const display = params.get("display")

  return {
    view: view && modes.has(view as AnalysisWorkspaceMode) ? view as AnalysisWorkspaceMode : null,
    item: params.get("item") || null,
    filter: filter && filters.has(filter as ReviewFilter) ? filter as ReviewFilter : "all",
    display: display && displays.has(display as ReviewDisplay) ? display as ReviewDisplay : "evidence",
  }
}

export function writeAnalysisWorkbenchUrlState(
  current: URLSearchParams,
  state: Partial<AnalysisWorkbenchUrlState>,
): URLSearchParams {
  const next = new URLSearchParams(current)
  const resolved = { ...readAnalysisWorkbenchUrlState(current), ...state }

  setOptional(next, "view", resolved.view)
  setOptional(next, "item", resolved.item)
  setDefault(next, "filter", resolved.filter, "all")
  setDefault(next, "display", resolved.display, "evidence")
  return next
}

function setOptional(params: URLSearchParams, key: string, value: string | null) {
  if (value) params.set(key, value)
  else params.delete(key)
}

function setDefault(params: URLSearchParams, key: string, value: string, defaultValue: string) {
  if (value === defaultValue) params.delete(key)
  else params.set(key, value)
}
