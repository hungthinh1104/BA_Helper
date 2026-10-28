import React from "react"
import { render, screen } from "@testing-library/react"
import { ReviewCoveragePanel } from "./review-coverage-panel"
import englishMessages from "../../../../messages/en.json"
import vietnameseMessages from "../../../../messages/vi-VN.json"

jest.mock("next-intl", () => ({
  useTranslations: (namespace: string) => (key: string) => {
    const value = namespace === "workspace"
      ? englishMessages.workspace[key as keyof typeof englishMessages.workspace]
      : undefined
    if (value === undefined) throw new Error(`MISSING_MESSAGE: ${namespace}.${key}`)
    return value
  },
}))

jest.mock("@/hooks/api/use-review-coverage", () => ({
  useReviewCoverage: () => ({ data: undefined, isLoading: true, isError: false }),
}))

describe("ReviewCoveragePanel localization", () => {
  it("provides the heading in both supported locales", () => {
    expect(englishMessages.workspace.reviewCoverage).toBe(englishMessages.reports.reviewCoverage)
    expect(vietnameseMessages.workspace.reviewCoverage).toBe(vietnameseMessages.reports.reviewCoverage)
  })

  it("renders its loading heading from the active workspace namespace", () => {
    render(<ReviewCoveragePanel runId="run-1" />)

    expect(screen.getByText("Review Coverage", { exact: true })).toBeInTheDocument()
  })
})
