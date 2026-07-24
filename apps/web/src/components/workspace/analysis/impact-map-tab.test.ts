import { toConfidencePercent } from "./impact-map-presentation"

describe("toConfidencePercent", () => {
  it.each([
    [-0.2, 0],
    [0, 0],
    [0.456, 46],
    [1, 100],
    [1.5, 100],
    [Number.NaN, 0],
    [Number.POSITIVE_INFINITY, 0],
  ])("normalizes %p to %p percent", (confidence, expected) => {
    expect(toConfidencePercent(confidence)).toBe(expected)
  })
})
