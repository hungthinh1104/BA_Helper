import type { AnalysisWorkspaceMode, ReviewDisplay, ReviewFilter } from "./analysis-workbench-types"

export interface AnalysisWorkbenchUrlState {
  view: AnalysisWorkspaceMode | null
  item: string | null
  filter: ReviewFilter
  display: ReviewDisplay
}

// Legacy `?tab=` values from the previous analysis UI, mapped onto the current
// view/display model so old bookmarks and deep-links keep working.
const legacyTabMap: Record<string, { view: AnalysisWorkspaceMode; display?: ReviewDisplay }> = {
  "review-queue": { view: "review" },
  insights: { view: "summary" },
  graph: { view: "review", display: "dependency-path" },
  "traceability-matrix": { view: "review" },
  "qa-coverage": { view: "risks-qa" },
  diff: { view: "history" },
  lineage: { view: "history" },
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

  // Fall back to the legacy `?tab=` mapping only when no explicit `view` is set.
  const legacy = view ? undefined : legacyTabMap[params.get("tab") ?? ""]

  return {
    view: view && modes.has(view as AnalysisWorkspaceMode) ? (view as AnalysisWorkspaceMode) : legacy?.view ?? null,
    item: params.get("item") || null,
    filter: filter && filters.has(filter as ReviewFilter) ? (filter as ReviewFilter) : "all",
    display: display && displays.has(display as ReviewDisplay) ? (display as ReviewDisplay) : legacy?.display ?? "evidence",
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
