import { ScanJobResponse, RepositoryCreateResponse } from "@ba-helper/contracts"

export const MOCK_REPOSITORY_ID = "mock-repo-123"
export const MOCK_SNAPSHOT_ID = "mock-snap-456"

export const MOCK_REPOSITORY: RepositoryCreateResponse = {
  repositoryId: MOCK_REPOSITORY_ID,
  projectId: "mock-proj-123",
  canonicalUrl: "https://github.com/mock-org/booking-service",
  createdAt: new Date().toISOString()
}

export const MOCK_SCAN_JOB: ScanJobResponse = {
  id: "mock-job-789",
  status: "COMPLETED",
  stage: "DONE",
  progress: 100,
  error: null,
  result: {
    sourceTargetId: "mock-target-123",
    snapshotId: MOCK_SNAPSHOT_ID,
    snapshotCoverageStatus: "READY"
  },
  capabilities: {
    canCancel: false,
    canRerun: true
  },
  createdAt: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
  updatedAt: new Date(Date.now() - 3500000).toISOString()
}

export const MOCK_ARTIFACT_STATS = [
  { type: "Controllers", count: 5 },
  { type: "Services", count: 12 },
  { type: "Entities", count: 8 },
  { type: "Tests", count: 20 },
  { type: "Data Access", count: 7 }
]

export const MOCK_GRAPH_PREVIEW = {
  endpoints: [
    "POST /api/bookings",
    "GET /api/bookings/:id",
    "POST /api/bookings/:id/cancel",
    "POST /api/payments",
    "POST /api/payments/refund"
  ],
  entities: [
    "Booking",
    "Payment",
    "User",
    "RefundTransaction",
    "Notification"
  ]
}
