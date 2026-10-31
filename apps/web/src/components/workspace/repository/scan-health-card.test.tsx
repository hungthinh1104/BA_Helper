jest.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }))

import { render, screen } from "@testing-library/react"
import { ScanHealthCard } from "./scan-health-card"

describe("ScanHealthCard", () => {
  it("does not present incomplete health data as a successful scan", () => {
    render(
      <ScanHealthCard
        payload={{
          coverageStatus: "FULL",
          scannedFileCount: 12,
          skippedFileCount: 0,
        }}
      />,
    )

    expect(screen.getByText("unableDisplayScanHealth")).toBeInTheDocument()
    expect(screen.queryByText("FULL")).not.toBeInTheDocument()
  })

  it("renders complete scan health diagnostics produced by the scanner", () => {
    render(
      <ScanHealthCard
        payload={{
          coverageStatus: "FULL",
          scannerVersion: "scanner@0.7.1",
          analyzerVersion: "analyzer@0.16.0",
          scannedFileCount: 12,
          skippedFileCount: 1,
          artifactCount: 5,
          skippedSummary: { BINARY_FILE: 1 },
          skippedFilesSample: [{ path: "assets/archive.bin", reason: "BINARY_FILE" }],
          limits: { maxFiles: 100, maxFileBytes: 1024 },
          limitHits: { fileLimitHit: false, repoSizeLimitHit: false },
        }}
      />,
    )

    expect(screen.getByText("FULL")).toBeInTheDocument()
    expect(screen.getByText("scanner@0.7.1")).toBeInTheDocument()
    expect(screen.getByText("analyzer@0.16.0")).toBeInTheDocument()
    expect(screen.getByText("skipReasonBinaryFile")).toBeInTheDocument()
  })
})
