import { DEFAULT_APP_LOCALE, normalizeAppLocale, type AppLocale } from "@ba-helper/contracts"

export type SupportedLocale = AppLocale
export type LocaleInput = string | null | undefined

export const DEFAULT_ANALYSIS_WORKSPACE_LOCALE: SupportedLocale = DEFAULT_APP_LOCALE

type LabelMap = Record<string, string>
type LocalizedLabelMap = Record<SupportedLocale, LabelMap>

const analysisStatusEn = {
  QUEUED: "Queued",
  RUNNING: "Running",
  WAITING_FOR_REVIEW: "Waiting for review",
  COMPLETED: "Completed",
  FAILED: "Failed",
  CANCELLED: "Cancelled",
}

const analysisStatusVi = {
  QUEUED: "Đang chờ",
  RUNNING: "Đang chạy",
  WAITING_FOR_REVIEW: "Chờ xem xét",
  COMPLETED: "Đã hoàn tất",
  FAILED: "Thất bại",
  CANCELLED: "Đã hủy",
}

const analysisStatusJa = {
  QUEUED: "待機中",
  RUNNING: "実行中",
  WAITING_FOR_REVIEW: "レビュー待ち",
  COMPLETED: "完了",
  FAILED: "失敗",
  CANCELLED: "キャンセル済み",
}

export const analysisStatusLabels = {
  en: analysisStatusEn,
  "vi-VN": analysisStatusVi,
  "ja-JP": analysisStatusJa,
} as const satisfies LocalizedLabelMap

export const reviewStatusLabels = {
  en: {
    not_started: "Not started",
    in_progress: "In progress",
    complete: "Complete",
  },
  "vi-VN": {
    not_started: "Chưa bắt đầu",
    in_progress: "Đang xử lý",
    complete: "Đã hoàn tất",
  },
  "ja-JP": {
    not_started: "未開始",
    in_progress: "進行中",
    complete: "完了",
  },
} as const satisfies LocalizedLabelMap

export const snapshotStatusLabels = {
  en: {
    missing: "Missing",
    locked: "Locked",
  },
  "vi-VN": {
    missing: "Thiếu",
    locked: "Đã khóa",
  },
  "ja-JP": {
    missing: "欠落",
    locked: "ロック済み",
  },
} as const satisfies LocalizedLabelMap

export const reportStatusLabels = {
  en: {
    missing: "Missing",
    queued: "Queued",
    running: "Running",
    completed: "Completed",
    failed: "Failed",
  },
  "vi-VN": {
    missing: "Thiếu",
    queued: "Đang chờ",
    running: "Đang chạy",
    completed: "Đã hoàn tất",
    failed: "Thất bại",
  },
  "ja-JP": {
    missing: "欠落",
    queued: "待機中",
    running: "実行中",
    completed: "完了",
    failed: "失敗",
  },
} as const satisfies LocalizedLabelMap

export const driftStatusLabels = {
  en: {
    unknown: "Unknown",
    fresh: "Fresh",
    stale: "Stale",
  },
  "vi-VN": {
    unknown: "Chưa rõ",
    fresh: "Còn mới",
    stale: "Đã cũ",
  },
  "ja-JP": {
    unknown: "不明",
    fresh: "最新",
    stale: "古い",
  },
} as const satisfies LocalizedLabelMap

export const reviewDecisionLabels = {
  en: {
    needs_review: "Needs review",
    accepted: "Accepted",
    rejected: "Rejected",
    needs_more_evidence: "Needs more evidence",
    NEEDS_REVIEW: "Needs review",
    ACCEPTED: "Accepted",
    REJECTED: "Rejected",
    NEEDS_MORE_EVIDENCE: "Needs more evidence",
    CONFIRMED: "Confirmed",
  },
  "vi-VN": {
    needs_review: "Cần xem xét",
    accepted: "Đã chấp nhận",
    rejected: "Đã bác bỏ",
    needs_more_evidence: "Cần thêm bằng chứng",
    NEEDS_REVIEW: "Cần xem xét",
    ACCEPTED: "Đã chấp nhận",
    REJECTED: "Đã bác bỏ",
    NEEDS_MORE_EVIDENCE: "Cần thêm bằng chứng",
    CONFIRMED: "Đã xác nhận",
  },
  "ja-JP": {
    needs_review: "レビュー待ち",
    accepted: "承認済み",
    rejected: "却下",
    needs_more_evidence: "追加証拠が必要",
    NEEDS_REVIEW: "レビュー待ち",
    ACCEPTED: "承認済み",
    REJECTED: "却下",
    NEEDS_MORE_EVIDENCE: "追加証拠が必要",
    CONFIRMED: "確認済み",
  },
} as const satisfies LocalizedLabelMap

export const reviewItemTypeLabels = {
  en: {
    impact: "Impacted artifact",
    evidence: "Evidence",
    risk: "Risk",
    unknown: "Unknown",
    qa_scenario: "QA scenario",
    report: "Report",
  },
  "vi-VN": {
    impact: "Artifact ảnh hưởng",
    evidence: "Bằng chứng",
    risk: "Rủi ro",
    unknown: "Điểm chưa rõ",
    qa_scenario: "Kịch bản QA",
    report: "Báo cáo",
  },
  "ja-JP": {
    impact: "影響 artifact",
    evidence: "証拠",
    risk: "リスク",
    unknown: "不明点",
    qa_scenario: "QA シナリオ",
    report: "レポート",
  },
} as const satisfies LocalizedLabelMap

export const evidenceBasisLabels = {
  en: {
    evidenced: "Evidenced",
    inferred: "Inferred",
    unknown: "Unknown",
    conflicting: "Conflicting",
  },
  "vi-VN": {
    evidenced: "Có bằng chứng",
    inferred: "Suy luận",
    unknown: "Chưa rõ",
    conflicting: "Mâu thuẫn",
  },
  "ja-JP": {
    evidenced: "証拠あり",
    inferred: "推論",
    unknown: "不明",
    conflicting: "矛盾",
  },
} as const satisfies LocalizedLabelMap

export const exportStatusLabels = {
  en: {
    available: "Available",
    blocked: "Blocked",
    none: "None",
    yes: "Yes",
    no: "No",
    not_applicable: "N/A",
  },
  "vi-VN": {
    available: "Có thể xuất",
    blocked: "Bị chặn",
    none: "Không có",
    yes: "Có",
    no: "Không",
    not_applicable: "Không áp dụng",
  },
  "ja-JP": {
    available: "利用可能",
    blocked: "ブロック中",
    none: "なし",
    yes: "はい",
    no: "いいえ",
    not_applicable: "N/A",
  },
} as const satisfies LocalizedLabelMap

export function getLocalizedLabel(
  labels: LocalizedLabelMap,
  value: string | null | undefined,
  locale: LocaleInput = DEFAULT_ANALYSIS_WORKSPACE_LOCALE,
) {
  const resolvedLocale = normalizeAppLocale(locale)
  if (!value) return labels[resolvedLocale].not_applicable ?? formatFallbackLabel("not_applicable")
  return labels[resolvedLocale][value] ?? formatFallbackLabel(value)
}

export function formatFallbackLabel(value: string) {
  return value.replace(/_/g, " ").trim()
}

export type DomainPackStatusType = "STABLE" | "PARTIAL" | "FALLBACK" | "EXPERIMENTAL" | "UNKNOWN"

export const domainPackStatusLabels = {
  en: {
    STABLE: "Stable coverage",
    PARTIAL: "Partial coverage",
    FALLBACK: "Generic fallback",
    EXPERIMENTAL: "Experimental coverage",
    UNKNOWN: "Unknown capability",
  },
  "vi-VN": {
    STABLE: "Phạm vi ổn định",
    PARTIAL: "Phạm vi một phần",
    FALLBACK: "Suy luận tổng quát",
    EXPERIMENTAL: "Phạm vi thử nghiệm",
    UNKNOWN: "Capability chưa rõ",
  },
  "ja-JP": {
    STABLE: "安定カバレッジ",
    PARTIAL: "部分カバレッジ",
    FALLBACK: "汎用 fallback",
    EXPERIMENTAL: "実験的カバレッジ",
    UNKNOWN: "不明な capability",
  },
} as const satisfies LocalizedLabelMap

export const domainPackStatusTooltips = {
  en: {
    STABLE: "Covered by tested domain evaluation cases.",
    PARTIAL: "Limited tested coverage. Treat domain-specific hints conservatively.",
    FALLBACK: "Generic heuristics only. Domain-specific certainty is limited.",
    EXPERIMENTAL: "Experimental domain pack. May produce inaccurate results.",
    UNKNOWN: "Domain capability is unknown.",
  },
  "vi-VN": {
    STABLE: "Được cover bởi các evaluation case đã test.",
    PARTIAL: "Phạm vi test giới hạn. Nên thận trọng với các gợi ý riêng của domain này.",
    FALLBACK: "Chỉ dùng generic heuristics. Mức độ chắc chắn về domain thấp.",
    EXPERIMENTAL: "Domain thử nghiệm. Có thể chưa ổn định.",
    UNKNOWN: "Trạng thái capability chưa rõ.",
  },
  "ja-JP": {
    STABLE: "テスト済みドメイン評価ケースでカバーされています。",
    PARTIAL: "テスト済み範囲は限定的です。ドメイン固有のヒントは保守的に扱ってください。",
    FALLBACK: "汎用 heuristic のみです。ドメイン固有の確度は限定的です。",
    EXPERIMENTAL: "実験的なドメインパックです。結果が不正確な場合があります。",
    UNKNOWN: "ドメイン capability は不明です。",
  },
} as const satisfies LocalizedLabelMap

export function getDomainCapabilityBadge({
  domainPackStatus,
  locale = DEFAULT_ANALYSIS_WORKSPACE_LOCALE,
}: {
  domainPackStatus?: string | null
  locale?: LocaleInput
}) {
  const resolvedLocale = normalizeAppLocale(locale)
  const resolvedStatus = (domainPackStatus as DomainPackStatusType | undefined | null) || "UNKNOWN"
  const safeStatus = (domainPackStatusLabels[resolvedLocale] as Record<string, string>)[resolvedStatus] ? resolvedStatus : "UNKNOWN"

  return {
    status: safeStatus,
    label: domainPackStatusLabels[resolvedLocale][safeStatus],
    tooltip: domainPackStatusTooltips[resolvedLocale][safeStatus],
  }
}
