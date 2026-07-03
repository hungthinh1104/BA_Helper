import {
  DEFAULT_ANALYSIS_WORKSPACE_LOCALE,
  analysisStatusLabels,
  driftStatusLabels,
  evidenceBasisLabels,
  exportStatusLabels,
	  formatFallbackLabel,
	  getDomainCapabilityBadge,
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
    expect(analysisWorkspaceLabels["vi-VN"].tabs.overview).toBe("Tổng quan")
    expect(getAnalysisWorkspaceLabels("vi-VN").reviewReport.accept).toBe("Chấp nhận")
  })

  it("maps status and review decisions from English contract values", () => {
    expect(getLocalizedLabel(reviewStatusLabels, "in_progress", "vi-VN")).toBe("Đang xử lý")
    expect(getLocalizedLabel(reportStatusLabels, "completed", "vi-VN")).toBe("Đã hoàn tất")
    expect(getLocalizedLabel(driftStatusLabels, "stale", "vi-VN")).toBe("Đã cũ")
    expect(getLocalizedLabel(reviewDecisionLabels, "needs_more_evidence", "vi-VN")).toBe("Cần thêm bằng chứng")
    expect(getLocalizedLabel(reviewDecisionLabels, "NEEDS_REVIEW", "vi-VN")).toBe("Cần xem xét")
    expect(getLocalizedLabel(analysisStatusLabels, "WAITING_FOR_REVIEW", "vi-VN")).toBe("Chờ xem xét")
    expect(getLocalizedLabel(snapshotStatusLabels, "locked", "vi-VN")).toBe("Đã khóa")
    expect(getLocalizedLabel(evidenceBasisLabels, "conflicting", "vi-VN")).toBe("Mâu thuẫn")
    expect(getLocalizedLabel(exportStatusLabels, "available", "vi-VN")).toBe("Có thể xuất")
  })

  it("keeps short Vietnamese alias backward compatible", () => {
    expect(getLocalizedLabel(reportStatusLabels, "completed", "vi")).toBe("Đã hoàn tất")
  })

  it("supports Japanese status chrome without changing contract values", () => {
    expect(getLocalizedLabel(analysisStatusLabels, "WAITING_FOR_REVIEW", "ja-JP")).toBe("レビュー待ち")
    expect(getLocalizedLabel(reportStatusLabels, "completed", "ja-JP")).toBe("完了")
  })

	  it("falls back mechanically for missing labels without inventing business state", () => {
	    expect(formatFallbackLabel("SOME_NEW_STATUS")).toBe("SOME NEW STATUS")
	    expect(getLocalizedLabel(reportStatusLabels, "archived", "vi-VN")).toBe("archived")
	    expect(getLocalizedLabel(exportStatusLabels, null, "vi-VN")).toBe("Không áp dụng")
	  })

	  it("uses backend-authored domain pack status without deriving from domain id", () => {
	    expect(getDomainCapabilityBadge({ domainPackStatus: "PARTIAL", locale: "vi-VN" })).toMatchObject({
	      status: "PARTIAL",
	      label: "Phạm vi một phần",
	    })
	    expect(getDomainCapabilityBadge({ domainPackStatus: null, locale: "en" })).toMatchObject({
	      status: "UNKNOWN",
	      label: "Unknown capability",
	    })
	  })
	})
