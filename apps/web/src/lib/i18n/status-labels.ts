export type SupportedLocale = "en" | "vi"

export const DEFAULT_ANALYSIS_WORKSPACE_LOCALE: SupportedLocale = "en"

type LabelMap = Record<string, string>

type LocalizedLabelMap = Record<SupportedLocale, LabelMap>

export const analysisStatusLabels = {
  en: {
    QUEUED: "Queued",
    RUNNING: "Running",
    WAITING_FOR_REVIEW: "Waiting for review",
    COMPLETED: "Completed",
    FAILED: "Failed",
    CANCELLED: "Cancelled",
  },
  vi: {
    QUEUED: "Đang chờ",
    RUNNING: "Đang chạy",
    WAITING_FOR_REVIEW: "Chờ xem xét",
    COMPLETED: "Đã hoàn tất",
    FAILED: "Thất bại",
    CANCELLED: "Đã hủy",
  },
} as const satisfies LocalizedLabelMap

export const reviewStatusLabels = {
  en: {
    not_started: "Not started",
    in_progress: "In progress",
    complete: "Complete",
  },
  vi: {
    not_started: "Chưa bắt đầu",
    in_progress: "Đang xử lý",
    complete: "Đã hoàn tất",
  },
} as const satisfies LocalizedLabelMap

export const snapshotStatusLabels = {
  en: {
    missing: "Missing",
    locked: "Locked",
  },
  vi: {
    missing: "Thiếu",
    locked: "Đã khóa",
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
  vi: {
    missing: "Thiếu",
    queued: "Đang chờ",
    running: "Đang chạy",
    completed: "Đã hoàn tất",
    failed: "Thất bại",
  },
} as const satisfies LocalizedLabelMap

export const driftStatusLabels = {
  en: {
    unknown: "Unknown",
    fresh: "Fresh",
    stale: "Stale",
  },
  vi: {
    unknown: "Chưa rõ",
    fresh: "Còn mới",
    stale: "Đã cũ",
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
  vi: {
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
} as const satisfies LocalizedLabelMap

export const evidenceBasisLabels = {
  en: {
    evidenced: "Evidenced",
    inferred: "Inferred",
    unknown: "Unknown",
    conflicting: "Conflicting",
  },
  vi: {
    evidenced: "Có bằng chứng",
    inferred: "Suy luận",
    unknown: "Chưa rõ",
    conflicting: "Mâu thuẫn",
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
  vi: {
    available: "Có thể xuất",
    blocked: "Bị chặn",
    none: "Không có",
    yes: "Có",
    no: "Không",
    not_applicable: "Không áp dụng",
  },
} as const satisfies LocalizedLabelMap

export function getLocalizedLabel(
  labels: LocalizedLabelMap,
  value: string | null | undefined,
  locale: SupportedLocale = DEFAULT_ANALYSIS_WORKSPACE_LOCALE,
) {
  if (!value) return labels[locale].not_applicable ?? formatFallbackLabel("not_applicable")
  return labels[locale][value] ?? formatFallbackLabel(value)
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
  vi: {
    STABLE: "Phạm vi ổn định",
    PARTIAL: "Phạm vi một phần",
    FALLBACK: "Suy luận tổng quát",
    EXPERIMENTAL: "Phạm vi thử nghiệm",
    UNKNOWN: "Capability chưa rõ",
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
  vi: {
    STABLE: "Được cover bởi các evaluation case đã test.",
    PARTIAL: "Phạm vi test giới hạn. Nên thận trọng với các gợi ý riêng của domain này.",
    FALLBACK: "Chỉ dùng generic heuristics. Mức độ chắc chắn về domain thấp.",
    EXPERIMENTAL: "Domain thử nghiệm. Có thể chưa ổn định.",
    UNKNOWN: "Trạng thái capability chưa rõ.",
  },
} as const satisfies LocalizedLabelMap

export function getDomainCapabilityBadge({
  domainPackStatus,
  locale = DEFAULT_ANALYSIS_WORKSPACE_LOCALE,
}: {
  domainPackStatus?: string | null
  locale?: SupportedLocale
}) {
  const resolvedStatus = (domainPackStatus as DomainPackStatusType | undefined | null) || "UNKNOWN"
  const safeStatus = (domainPackStatusLabels[locale] as Record<string, string>)[resolvedStatus] ? resolvedStatus : "UNKNOWN"

  return {
    status: safeStatus,
    label: domainPackStatusLabels[locale][safeStatus],
    tooltip: domainPackStatusTooltips[locale][safeStatus],
  }
}
