"use client"

import { useLocale } from "next-intl"
import { cn } from "@/lib/utils"
import { getDomainCapabilityBadge, type SupportedLocale } from "@/lib/i18n/status-labels"
import { normalizeAppLocale, type AppLocale } from "@ba-helper/contracts"

type BadgeTone = "neutral" | "success" | "warning" | "danger" | "info" | "muted"

interface StatusMeta {
  label: string
  tone: BadgeTone
  description?: string
  pulse?: boolean
}

function toneClass(tone: BadgeTone) {
  switch (tone) {
    case "success":
      return "border-success/30 bg-success/10 text-success"
    case "warning":
      return "border-warning/30 bg-warning/10 text-warning"
    case "danger":
      return "border-danger/30 bg-danger/10 text-danger"
    case "info":
      return "border-info/30 bg-info/10 text-info"
    case "muted":
      return "border-border/60 bg-surface-muted text-muted-foreground"
    default:
      return "border-border/50 bg-surface text-muted-foreground"
  }
}

function renderBadge(meta: StatusMeta, className?: string) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide",
        toneClass(meta.tone),
        className,
      )}
      title={meta.description}
    >
      {meta.pulse ? <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse" /> : null}
      {meta.label}
    </span>
  )
}

function defaultLabel(value: string) {
  return value.replace(/_/g, " ")
}

type MetaTranslations = Record<AppLocale, Record<string, Omit<StatusMeta, "tone" | "pulse">>>

const maturityLabels: MetaTranslations = {
  en: {
    STABLE: { label: "Stable", description: "Primary supported scanner path." },
    PARTIAL: { label: "Partial", description: "Usable with bounded scanner coverage." },
    EXPERIMENTAL: { label: "Experimental", description: "Capability proof only; manual review required." },
  },
  "vi-VN": {
    STABLE: { label: "Ổn định", description: "Luồng scanner được hỗ trợ chính." },
    PARTIAL: { label: "Một phần", description: "Dùng được nhưng coverage scanner có giới hạn." },
    EXPERIMENTAL: { label: "Thử nghiệm", description: "Chỉ là proof capability; cần review thủ công." },
  },
  "ja-JP": {
    STABLE: { label: "安定", description: "主要なサポート済み scanner path。" },
    PARTIAL: { label: "部分対応", description: "限定された scanner coverage で利用可能。" },
    EXPERIMENTAL: { label: "実験的", description: "Capability proof のみ。手動レビューが必要。" },
  },
}

const certaintyLabels: MetaTranslations = {
  en: {
    EVIDENCED: { label: "Evidenced", description: "Backed by persisted repository evidence." },
    INFERRED: { label: "Inferred", description: "Derived from evidence, not directly proven." },
    UNKNOWN: { label: "Unknown", description: "Insufficient support; needs clarification or review." },
    CONFLICTING: { label: "Conflicting", description: "Evidence conflicts or suggests risk." },
  },
  "vi-VN": {
    EVIDENCED: { label: "Có bằng chứng", description: "Được hỗ trợ bởi evidence repository đã persist." },
    INFERRED: { label: "Suy luận", description: "Suy ra từ evidence, chưa chứng minh trực tiếp." },
    UNKNOWN: { label: "Chưa rõ", description: "Chưa đủ support; cần clarification hoặc review." },
    CONFLICTING: { label: "Mâu thuẫn", description: "Evidence mâu thuẫn hoặc chỉ ra rủi ro." },
  },
  "ja-JP": {
    EVIDENCED: { label: "証拠あり", description: "Persisted repository evidence に基づきます。" },
    INFERRED: { label: "推論", description: "Evidence から派生していますが直接証明ではありません。" },
    UNKNOWN: { label: "不明", description: "根拠不足。clarification または review が必要です。" },
    CONFLICTING: { label: "矛盾", description: "Evidence が矛盾しているか risk を示します。" },
  },
}

const reviewStatusLabels: MetaTranslations = {
  en: {
    NEEDS_REVIEW: { label: "Needs Review", description: "A reviewer decision is still required." },
    CONFIRMED: { label: "Confirmed", description: "Human review accepted this item." },
    REJECTED: { label: "Rejected", description: "Human review rejected this item." },
  },
  "vi-VN": {
    NEEDS_REVIEW: { label: "Cần review", description: "Vẫn cần reviewer quyết định." },
    CONFIRMED: { label: "Đã xác nhận", description: "Review thủ công đã chấp nhận mục này." },
    REJECTED: { label: "Đã bác bỏ", description: "Review thủ công đã bác bỏ mục này." },
  },
  "ja-JP": {
    NEEDS_REVIEW: { label: "レビュー待ち", description: "Reviewer decision がまだ必要です。" },
    CONFIRMED: { label: "確認済み", description: "人のレビューでこの項目は承認されました。" },
    REJECTED: { label: "却下", description: "人のレビューでこの項目は却下されました。" },
  },
}

const diagnosticSeverityLabels: MetaTranslations = {
  en: {
    BLOCKER: { label: "Blocker", description: "Blocks reliable extraction or review." },
    ERROR: { label: "Error", description: "High-risk scanner diagnostic." },
    WARN: { label: "Warn", description: "Bounded extraction warning." },
    INFO: { label: "Info", description: "Context-only diagnostic; not a confirmed impact." },
  },
  "vi-VN": {
    BLOCKER: { label: "Blocker", description: "Chặn extraction hoặc review đáng tin cậy." },
    ERROR: { label: "Lỗi", description: "Diagnostic scanner rủi ro cao." },
    WARN: { label: "Cảnh báo", description: "Cảnh báo extraction có giới hạn." },
    INFO: { label: "Thông tin", description: "Chỉ là ngữ cảnh; không phải impact đã xác nhận." },
  },
  "ja-JP": {
    BLOCKER: { label: "Blocker", description: "信頼できる extraction または review をブロックします。" },
    ERROR: { label: "エラー", description: "高リスク scanner diagnostic。" },
    WARN: { label: "警告", description: "限定された extraction warning。" },
    INFO: { label: "情報", description: "Context-only diagnostic。confirmed impact ではありません。" },
  },
}

const analysisStatusDescriptions: MetaTranslations = {
  en: {
    RUNNING: { label: "Running", description: "Analysis is processing persisted evidence." },
    WAITING_FOR_REVIEW: { label: "Waiting for Review", description: "Analysis output exists but review is incomplete." },
    COMPLETED: { label: "Completed", description: "Analysis is finalized." },
    FAILED: { label: "Failed", description: "Analysis stopped and needs remediation or rerun." },
    QUEUED: { label: "Queued" },
    CANCELLED: { label: "Cancelled" },
    STALE: { label: "Stale", description: "Repository target moved since this result was created." },
  },
  "vi-VN": {
    RUNNING: { label: "Đang chạy", description: "Phân tích đang xử lý evidence đã persist." },
    WAITING_FOR_REVIEW: { label: "Chờ review", description: "Output phân tích đã có nhưng review chưa hoàn tất." },
    COMPLETED: { label: "Đã hoàn tất", description: "Phân tích đã finalize." },
    FAILED: { label: "Thất bại", description: "Phân tích đã dừng và cần xử lý hoặc rerun." },
    QUEUED: { label: "Đang chờ" },
    CANCELLED: { label: "Đã hủy" },
    STALE: { label: "Đã cũ", description: "Repository target đã thay đổi sau khi kết quả này được tạo." },
  },
  "ja-JP": {
    RUNNING: { label: "実行中", description: "分析は persisted evidence を処理中です。" },
    WAITING_FOR_REVIEW: { label: "レビュー待ち", description: "分析出力はありますがレビュー未完了です。" },
    COMPLETED: { label: "完了", description: "分析は finalized です。" },
    FAILED: { label: "失敗", description: "分析は停止し、remediation または rerun が必要です。" },
    QUEUED: { label: "待機中" },
    CANCELLED: { label: "キャンセル済み" },
    STALE: { label: "古い", description: "この結果の作成後に repository target が移動しました。" },
  },
}

const scanStatusDescriptions: MetaTranslations = {
  en: {
    QUEUED: { label: "Queued" },
    RUNNING: { label: "Running", description: "Scanner is indexing repository evidence." },
    COMPLETED: { label: "Completed" },
    FAILED: { label: "Failed", description: "Scan failed; evidence is unavailable or incomplete." },
    CANCELLED: { label: "Cancelled" },
  },
  "vi-VN": {
    QUEUED: { label: "Đang chờ" },
    RUNNING: { label: "Đang chạy", description: "Scanner đang index evidence repository." },
    COMPLETED: { label: "Đã hoàn tất" },
    FAILED: { label: "Thất bại", description: "Scan thất bại; evidence không khả dụng hoặc chưa đầy đủ." },
    CANCELLED: { label: "Đã hủy" },
  },
  "ja-JP": {
    QUEUED: { label: "待機中" },
    RUNNING: { label: "実行中", description: "Scanner は repository evidence を index 中です。" },
    COMPLETED: { label: "完了" },
    FAILED: { label: "失敗", description: "Scan 失敗。evidence は利用不可または不完全です。" },
    CANCELLED: { label: "キャンセル済み" },
  },
}

const coverageStatusDescriptions: MetaTranslations = {
  en: {
    READY: { label: "Ready", description: "Snapshot is analysis-ready." },
    FULL: { label: "Ready", description: "Snapshot is analysis-ready." },
    PARTIAL: { label: "Partial", description: "Snapshot is usable but coverage is bounded." },
    FAILED: { label: "Failed", description: "Scanner could not produce usable evidence." },
  },
  "vi-VN": {
    READY: { label: "Sẵn sàng", description: "Snapshot đã sẵn sàng để phân tích." },
    FULL: { label: "Sẵn sàng", description: "Snapshot đã sẵn sàng để phân tích." },
    PARTIAL: { label: "Một phần", description: "Snapshot dùng được nhưng coverage có giới hạn." },
    FAILED: { label: "Thất bại", description: "Scanner không tạo được evidence dùng được." },
  },
  "ja-JP": {
    READY: { label: "Ready", description: "Snapshot は analysis-ready です。" },
    FULL: { label: "Ready", description: "Snapshot は analysis-ready です。" },
    PARTIAL: { label: "Partial", description: "Snapshot は利用可能ですが coverage は限定的です。" },
    FAILED: { label: "失敗", description: "Scanner は利用可能な evidence を生成できませんでした。" },
  },
}

function resolveMeta(
  labels: MetaTranslations,
  locale: AppLocale,
  key: string,
): Omit<StatusMeta, "tone" | "pulse"> {
  return labels[locale][key] ?? labels.en[key] ?? { label: defaultLabel(key) }
}

function useBadgeLocale(): AppLocale {
  return normalizeAppLocale(useLocale())
}

export function getMaturityMeta(maturity: string, locale: AppLocale = "en"): StatusMeta {
  switch (maturity) {
    case "STABLE":
      return { ...resolveMeta(maturityLabels, locale, maturity), tone: "success" }
    case "PARTIAL":
      return { ...resolveMeta(maturityLabels, locale, maturity), tone: "warning" }
    case "EXPERIMENTAL":
      return { ...resolveMeta(maturityLabels, locale, maturity), tone: "info" }
    default:
      return { label: defaultLabel(maturity), tone: "neutral" }
  }
}

export function getCertaintyMeta(certainty: string, locale: AppLocale = "en"): StatusMeta {
  switch (certainty) {
    case "EVIDENCED":
      return { ...resolveMeta(certaintyLabels, locale, certainty), tone: "success" }
    case "INFERRED":
      return { ...resolveMeta(certaintyLabels, locale, certainty), tone: "info" }
    case "UNKNOWN":
      return { ...resolveMeta(certaintyLabels, locale, certainty), tone: "muted" }
    case "CONFLICTING":
      return { ...resolveMeta(certaintyLabels, locale, certainty), tone: "danger" }
    default:
      return { label: defaultLabel(certainty), tone: "neutral" }
  }
}

export function getReviewStatusMeta(status: string, locale: AppLocale = "en"): StatusMeta {
  switch (status) {
    case "NEEDS_REVIEW":
      return { ...resolveMeta(reviewStatusLabels, locale, status), tone: "warning" }
    case "CONFIRMED":
      return { ...resolveMeta(reviewStatusLabels, locale, status), tone: "success" }
    case "REJECTED":
      return { ...resolveMeta(reviewStatusLabels, locale, status), tone: "danger" }
    default:
      return { label: defaultLabel(status), tone: "neutral" }
  }
}

export function getDiagnosticSeverityMeta(severity: string, locale: AppLocale = "en"): StatusMeta {
  switch (severity) {
    case "BLOCKER":
      return { ...resolveMeta(diagnosticSeverityLabels, locale, severity), tone: "danger" }
    case "ERROR":
      return { ...resolveMeta(diagnosticSeverityLabels, locale, severity), tone: "danger" }
    case "WARN":
      return { ...resolveMeta(diagnosticSeverityLabels, locale, severity), tone: "warning" }
    case "INFO":
      return { ...resolveMeta(diagnosticSeverityLabels, locale, severity), tone: "info" }
    default:
      return { label: defaultLabel(severity), tone: "neutral" }
  }
}

export function getArtifactKindMeta(kind: string): StatusMeta {
  const kindUpper = kind.toUpperCase()

  if (kindUpper.includes("API") || kindUpper.includes("ENDPOINT")) {
    return { label: kind, tone: "info" }
  }
  if (kindUpper.includes("SERVICE") || kindUpper.includes("USECASE")) {
    return { label: kind, tone: "info" }
  }
  if (kindUpper.includes("MODEL") || kindUpper.includes("ENTITY") || kindUpper.includes("DATA")) {
    return { label: kind, tone: "success" }
  }
  if (kindUpper.includes("TEST") || kindUpper.includes("SPEC")) {
    return { label: kind, tone: "warning" }
  }
  if (kindUpper.includes("INSIGHT") || kindUpper.includes("NOTE")) {
    return { label: kind, tone: "muted" }
  }

  return { label: kind, tone: "neutral" }
}

export function getAnalysisStatusMeta(status: string, locale: AppLocale = "en"): StatusMeta {
  switch (status) {
    case "QUEUED":
      return { ...resolveMeta(analysisStatusDescriptions, locale, status), tone: "neutral" }
    case "RUNNING":
      return { ...resolveMeta(analysisStatusDescriptions, locale, status), tone: "info", pulse: true }
    case "WAITING_FOR_REVIEW":
      return { ...resolveMeta(analysisStatusDescriptions, locale, status), tone: "warning" }
    case "COMPLETED":
      return { ...resolveMeta(analysisStatusDescriptions, locale, status), tone: "success" }
    case "FAILED":
      return { ...resolveMeta(analysisStatusDescriptions, locale, status), tone: "danger" }
    case "CANCELLED":
      return { ...resolveMeta(analysisStatusDescriptions, locale, status), tone: "muted" }
    case "STALE":
      return { ...resolveMeta(analysisStatusDescriptions, locale, status), tone: "warning" }
    default:
      return { label: defaultLabel(status), tone: "neutral" }
  }
}

export function getScanStatusMeta(status: string, locale: AppLocale = "en"): StatusMeta {
  switch (status) {
    case "QUEUED":
      return { ...resolveMeta(scanStatusDescriptions, locale, status), tone: "neutral" }
    case "RUNNING":
      return { ...resolveMeta(scanStatusDescriptions, locale, status), tone: "info", pulse: true }
    case "COMPLETED":
      return { ...resolveMeta(scanStatusDescriptions, locale, status), tone: "success" }
    case "FAILED":
      return { ...resolveMeta(scanStatusDescriptions, locale, status), tone: "danger" }
    case "CANCELLED":
      return { ...resolveMeta(scanStatusDescriptions, locale, status), tone: "muted" }
    default:
      return { label: defaultLabel(status), tone: "neutral" }
  }
}

export function getCoverageStatusMeta(status: string, locale: AppLocale = "en"): StatusMeta {
  switch (status) {
    case "READY":
    case "FULL":
      return { ...resolveMeta(coverageStatusDescriptions, locale, status), tone: "success" }
    case "PARTIAL":
      return { ...resolveMeta(coverageStatusDescriptions, locale, status), tone: "warning" }
    case "FAILED":
      return { ...resolveMeta(coverageStatusDescriptions, locale, status), tone: "danger" }
    default:
      return { label: defaultLabel(status), tone: "muted" }
  }
}

export function MaturityBadge({ maturity, className }: { maturity: string; className?: string }) {
  return renderBadge(getMaturityMeta(maturity, useBadgeLocale()), className)
}

export function CertaintyBadge({ certainty, className }: { certainty: string; className?: string }) {
  return renderBadge(getCertaintyMeta(certainty, useBadgeLocale()), className)
}

export function ReviewStatusBadge({ status, className }: { status: string; className?: string }) {
  return renderBadge(getReviewStatusMeta(status, useBadgeLocale()), className)
}

export function DiagnosticRiskBadge({ severity, className }: { severity: string; className?: string }) {
  return renderBadge(getDiagnosticSeverityMeta(severity, useBadgeLocale()), className)
}

export function ArtifactKindBadge({ kind, className }: { kind: string; className?: string }) {
  return renderBadge(getArtifactKindMeta(kind), cn("font-mono font-medium normal-case tracking-normal", className))
}

export function AnalysisStatusBadge({ status, className }: { status: string; className?: string }) {
  return renderBadge(getAnalysisStatusMeta(status, useBadgeLocale()), className)
}

export function ScanStatusBadge({ status, className }: { status: string; className?: string }) {
  return renderBadge(getScanStatusMeta(status, useBadgeLocale()), className)
}

export function CoverageStatusBadge({ status, className }: { status: string; className?: string }) {
  return renderBadge(getCoverageStatusMeta(status, useBadgeLocale()), className)
}

export function DomainStatusBadge({ 
  domainPackStatus, 
  locale,
  className 
}: { 
  domainPackStatus?: string | null
  locale?: SupportedLocale
  className?: string 
}) {
  const currentLocale = useBadgeLocale()
  const badgeData = getDomainCapabilityBadge({ domainPackStatus, locale: locale ?? currentLocale })
  
  let tone: BadgeTone = "muted"
  if (badgeData.status === "STABLE") tone = "success"
  else if (badgeData.status === "PARTIAL") tone = "warning"
  else if (badgeData.status === "FALLBACK") tone = "muted"
  else if (badgeData.status === "EXPERIMENTAL") tone = "info"
  
  return renderBadge({
    label: badgeData.label,
    tone,
    description: badgeData.tooltip
  }, className)
}
