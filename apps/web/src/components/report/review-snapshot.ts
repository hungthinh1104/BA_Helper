import {
  evidenceQualityItemSchema,
  type ApprovedImpactReportResponse,
} from "@ba-helper/contracts"

export type ReviewSnapshotItem = NonNullable<
  ApprovedImpactReportResponse["evidenceQualityItems"]
>[number]

export function parseReviewSnapshotItems(value: unknown): ReviewSnapshotItem[] {
  if (!Array.isArray(value)) return []

  return value.flatMap((item) => {
    const parsed = evidenceQualityItemSchema.safeParse(item)
    return parsed.success ? [parsed.data] : []
  })
}
