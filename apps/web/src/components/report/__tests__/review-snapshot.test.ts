import { parseReviewSnapshotItems } from "../review-snapshot"

describe("parseReviewSnapshotItems", () => {
  it("keeps valid persisted review items and rejects malformed entries", () => {
    const result = parseReviewSnapshotItems([
      {
        linkId: "link-1",
        artifact: "BookingService.cancel",
        quality: "EVIDENCED",
        reasons: ["Persisted code evidence"],
        reviewDecision: null,
      },
      { artifact: "missing required fields" },
    ])

    expect(result).toHaveLength(1)
    expect(result[0]?.artifact).toBe("BookingService.cancel")
  })

  it("returns an empty list for non-array snapshots", () => {
    expect(parseReviewSnapshotItems({ invalid: true })).toEqual([])
  })
})
