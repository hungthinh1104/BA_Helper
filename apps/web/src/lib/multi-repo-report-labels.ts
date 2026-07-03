import { normalizeAppLocale, type AppLocale } from "@ba-helper/contracts"

const childBlockingReasonLabels: Record<AppLocale, Record<string, string>> = {
  en: {
    FAILED: "Failed",
    NOT_COMPLETED: "Not completed",
    WAITING_FOR_REVIEW: "Waiting for review",
    NEEDS_MORE_CLARIFICATION: "Needs clarification",
    REJECTED: "Rejected",
    STALE: "Stale",
    NONE: "Ready",
  },
  "vi-VN": {
    FAILED: "Thất bại",
    NOT_COMPLETED: "Chưa hoàn tất",
    WAITING_FOR_REVIEW: "Chờ review",
    NEEDS_MORE_CLARIFICATION: "Cần clarification",
    REJECTED: "Đã bác bỏ",
    STALE: "Đã cũ",
    NONE: "Sẵn sàng",
  },
  "ja-JP": {
    FAILED: "失敗",
    NOT_COMPLETED: "未完了",
    WAITING_FOR_REVIEW: "レビュー待ち",
    NEEDS_MORE_CLARIFICATION: "Clarification 必要",
    REJECTED: "却下",
    STALE: "古い",
    NONE: "Ready",
  },
}

const mergedReportBlockerLabels: Record<AppLocale, Record<string, string>> = {
  en: {
    CHILD_ANALYSIS_FAILED: "A child analysis failed",
    CHILD_ANALYSIS_NOT_COMPLETED: "A child analysis is not completed",
    CHILD_ANALYSIS_WAITING_FOR_REVIEW: "A child analysis is waiting for review",
    CHILD_ANALYSIS_STALE: "A child analysis is stale",
    CHILD_REVIEW_NEEDS_CLARIFICATION: "A child review needs clarification",
    CHILD_REVIEW_REJECTED: "A child review was rejected",
    CHILD_REVIEW_PENDING: "A child review is pending",
    MERGED_REPORT_CURRENT: "Approved merged report is current",
  },
  "vi-VN": {
    CHILD_ANALYSIS_FAILED: "Một child analysis thất bại",
    CHILD_ANALYSIS_NOT_COMPLETED: "Một child analysis chưa hoàn tất",
    CHILD_ANALYSIS_WAITING_FOR_REVIEW: "Một child analysis đang chờ review",
    CHILD_ANALYSIS_STALE: "Một child analysis đã stale",
    CHILD_REVIEW_NEEDS_CLARIFICATION: "Một child review cần clarification",
    CHILD_REVIEW_REJECTED: "Một child review đã bị bác bỏ",
    CHILD_REVIEW_PENDING: "Một child review đang chờ",
    MERGED_REPORT_CURRENT: "Báo cáo gộp đã phê duyệt đang current",
  },
  "ja-JP": {
    CHILD_ANALYSIS_FAILED: "Child analysis が失敗しました",
    CHILD_ANALYSIS_NOT_COMPLETED: "Child analysis が未完了です",
    CHILD_ANALYSIS_WAITING_FOR_REVIEW: "Child analysis はレビュー待ちです",
    CHILD_ANALYSIS_STALE: "Child analysis が stale です",
    CHILD_REVIEW_NEEDS_CLARIFICATION: "Child review は clarification 必要です",
    CHILD_REVIEW_REJECTED: "Child review は却下されました",
    CHILD_REVIEW_PENDING: "Child review は pending です",
    MERGED_REPORT_CURRENT: "承認済み merged report は current です",
  },
}

export function getMultiRepoChildBlockingReasonLabel(reason: string, locale: AppLocale | string = "en"): string {
  const resolvedLocale = normalizeAppLocale(locale)
  return childBlockingReasonLabels[resolvedLocale][reason] ?? reason
}

export function formatMultiRepoMergedReportBlockers(reasons: string[], locale: AppLocale | string = "en"): string {
  const resolvedLocale = normalizeAppLocale(locale)
  return reasons
    .map((reason) => mergedReportBlockerLabels[resolvedLocale][reason] ?? reason)
    .join("; ")
}
