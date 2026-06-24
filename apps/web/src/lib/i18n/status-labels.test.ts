import {
  DEFAULT_ANALYSIS_WORKSPACE_LOCALE,
  analysisStatusLabels,
  driftStatusLabels,
  evidenceBasisLabels,
  exportStatusLabels,
  formatFallbackLabel,
  getLocalizedLabel,
  reportStatusLabels,
  reviewDecisionLabels,
  reviewStatusLabels,
  snapshotStatusLabels,
} from "./status-labels"
import { analysisWorkspaceLabels, getAnalysisWorkspaceLabels } from "./analysis-labels"

describe("analysis workspace i18n labels", () => {
  it("keeps runtime default locale English", () => {
    expect(DEFAULT_ANALYSIS_WORKSPACE_LOCALE).toBe("en")
    expect(getAnalysisWorkspaceLabels().title).toBe("Analysis Workspace")
  })

  it("provides Vietnamese labels without switching global product mode", () => {
    expect(analysisWorkspaceLabels.vi.tabs.overview).toBe("Tổng quan")
    expect(getAnalysisWorkspaceLabels("vi").reviewReport.accept).toBe("Chấp nhận")
  })

  it("maps status and review decisions from English contract values", () => {
    expect(getLocalizedLabel(reviewStatusLabels, "in_progress", "vi")).toBe("Đang xử lý")
    expect(getLocalizedLabel(reportStatusLabels, "completed", "vi")).toBe("Đã hoàn tất")
    expect(getLocalizedLabel(driftStatusLabels, "stale", "vi")).toBe("Đã cũ")
    expect(getLocalizedLabel(reviewDecisionLabels, "needs_more_evidence", "vi")).toBe("Cần thêm bằng chứng")
    expect(getLocalizedLabel(reviewDecisionLabels, "NEEDS_REVIEW", "vi")).toBe("Cần xem xét")
    expect(getLocalizedLabel(analysisStatusLabels, "WAITING_FOR_REVIEW", "vi")).toBe("Chờ xem xét")
    expect(getLocalizedLabel(snapshotStatusLabels, "locked", "vi")).toBe("Đã khóa")
    expect(getLocalizedLabel(evidenceBasisLabels, "conflicting", "vi")).toBe("Mâu thuẫn")
    expect(getLocalizedLabel(exportStatusLabels, "available", "vi")).toBe("Có thể xuất")
  })

  it("falls back mechanically for missing labels without inventing business state", () => {
    expect(formatFallbackLabel("SOME_NEW_STATUS")).toBe("SOME NEW STATUS")
    expect(getLocalizedLabel(reportStatusLabels, "archived", "vi")).toBe("archived")
    expect(getLocalizedLabel(exportStatusLabels, null, "vi")).toBe("Không áp dụng")
  })
})
