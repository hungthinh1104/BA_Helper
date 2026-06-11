import {
  ImpactAnalysisResponse,
  InsightListResponse,
  TraceabilityLinkListResponse,
} from "@ba-helper/contracts";

export const MOCK_ANALYSIS_ID = "mock-analysis-123";

export const MOCK_IMPACT_ANALYSIS: ImpactAnalysisResponse = {
  id: MOCK_ANALYSIS_ID,
  sourceTarget: {
    id: "target-1",
    requestedRef: "main",
    resolvedRefType: "BRANCH",
    latestObservedCommitSha: "abc1234567890def",
  },
  snapshot: {
    id: "snap-1",
    repositoryId: "repo-1",
    commitSha: "abc1234567890def",
    analyzerVersion: "1.0.0",
    coverageStatus: "READY",
  },
  freshness: {
    isStale: false,
    isAnalyzerOutdated: false,
    basis: "LATEST_OBSERVED_SOURCE_TARGET",
  },
  requirement: {
    id: "req-1",
    revisionId: "rev-1",
    revisionTitle: "Cancel paid booking and refund",
    rawText: "Allow users to cancel paid bookings and receive a refund. The refund amount might depend on when they cancel.",
  },
  status: "COMPLETED",
  stage: "DONE",
  progress: 100,
  coverageWarning: null,
  capabilities: {
    canReview: true,
    canFinalize: true,
    canExport: true,
    canRerun: true,
    canCancel: false,
  },
};

export const MOCK_INSIGHTS: InsightListResponse = {
  items: [
    {
      id: "insight-1",
      category: "CLAIM",
      statement: "Cancellation route exists in the Booking Controller.",
      certainty: "EVIDENCED",
      reviewStatus: "CONFIRMED",
      confidence: 0.95,
      evidence: [
        {
          id: "ev-1",
          sourceType: "CODE",
          filePath: "src/booking/booking.controller.ts",
          startLine: 45,
          endLine: 52,
          excerpt: "@Post(':id/cancel')\nasync cancelBooking(@Param('id') id: string) {\n  return this.bookingService.cancel(id);\n}",
        },
      ],
    },
    {
      id: "insight-2",
      category: "CLAIM",
      statement: "Cancellation may affect the refund flow in Payment Service.",
      certainty: "INFERRED",
      reviewStatus: "NEEDS_REVIEW",
      confidence: 0.7,
      evidence: [
        {
          id: "ev-2",
          sourceType: "CODE",
          filePath: "src/booking/booking.service.ts",
          startLine: 110,
          endLine: 115,
          excerpt: "async cancel(id: string) {\n  const booking = await this.repo.findById(id);\n  booking.status = 'CANCELLED';\n  // Need to trigger refund here?\n  await this.repo.save(booking);\n}",
        },
        {
          id: "ev-3",
          sourceType: "CODE",
          filePath: "src/payment/payment.service.ts",
          startLine: 88,
          endLine: 95,
          excerpt: "async processRefund(bookingId: string, amount: number) {\n  const payment = await this.repo.findByBooking(bookingId);\n  if (payment.status !== 'PAID') throw new Error('Not paid');\n  // Call external gateway\n}",
        },
      ],
    },
    {
      id: "insight-3",
      category: "UNKNOWN",
      statement: "Refund percentage or policy based on cancellation time is not confirmed in the codebase.",
      certainty: "UNKNOWN",
      reviewStatus: "NEEDS_REVIEW",
      confidence: null,
      evidence: [],
    },
    {
      id: "insight-4",
      category: "QA_SCENARIO",
      statement: "Test refund failure during cancellation: The cancellation should rollback if the payment gateway rejects the refund.",
      certainty: "INFERRED",
      reviewStatus: "NEEDS_REVIEW",
      confidence: 0.8,
      evidence: [
        {
          id: "ev-4",
          sourceType: "CODE",
          filePath: "src/payment/payment.service.ts",
          startLine: 90,
          endLine: 95,
          excerpt: "  // Call external gateway\n  const result = await this.gateway.refund(payment.txId);\n  if (!result.success) {\n    throw new GatewayError('Refund failed');\n  }",
        },
      ],
    },
    {
      id: "insight-5",
      category: "QUESTION",
      statement: "Should the system automatically send an email to the user when the refund fails?",
      certainty: "UNKNOWN",
      reviewStatus: "NEEDS_REVIEW",
      confidence: null,
      evidence: [],
    },
  ],
};

export const MOCK_TRACEABILITY_LINKS: TraceabilityLinkListResponse = {
  items: [
    {
      id: "link-1",
      artifactId: "art-1",
      linkType: "AFFECTED",
      linkBasis: "EVIDENCED",
      reviewStatus: "CONFIRMED",
      confidence: 0.9,
      evidence: [
        {
          id: "ev-1",
          sourceType: "CODE",
          filePath: "src/booking/booking.controller.ts",
          startLine: null,
          endLine: null,
          excerpt: "export class BookingController { ... }",
        }
      ],
    },
    {
      id: "link-2",
      artifactId: "art-2",
      linkType: "AFFECTED",
      linkBasis: "EVIDENCED",
      reviewStatus: "NEEDS_REVIEW",
      confidence: 0.8,
      evidence: [
        {
          id: "ev-2",
          sourceType: "CODE",
          filePath: "src/booking/booking.service.ts",
          startLine: null,
          endLine: null,
          excerpt: "export class BookingService { ... }",
        }
      ],
    },
    {
      id: "link-3",
      artifactId: "art-3",
      linkType: "RELATED",
      linkBasis: "INFERRED",
      reviewStatus: "NEEDS_REVIEW",
      confidence: 0.6,
      evidence: [
        {
          id: "ev-3",
          sourceType: "CODE",
          filePath: "src/payment/payment.service.ts",
          startLine: null,
          endLine: null,
          excerpt: "export class PaymentService { ... }",
        }
      ],
    },
  ],
};
