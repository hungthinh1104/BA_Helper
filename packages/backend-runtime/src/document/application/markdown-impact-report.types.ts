import type { Prisma, ReviewNote } from '@prisma/client';
import type { ClarificationItemDto } from '@ba-helper/contracts';
import type { ApprovedReportMetadata } from '../domain/approved-report-metadata';
import type { ReportReviewCoverageSummary } from './report-review-coverage.summary';
import type { ReportDependencyEdge } from './mermaid-impact-diagram.builder';
import type { ReportLocale } from './render/report-localization';

export type AnalysisSnapshot = Prisma.ImpactAnalysisGetPayload<{
  include: {
    snapshot: { include: { repository: true; profile: true } };
    sourceTarget: true;
    requirementRevision: true;
  };
}>;

export type InsightWithEvidence = Prisma.BaInsightGetPayload<{
  include: {
    evidenceLinks: {
      include: {
        evidence: true;
      };
    };
  };
}>;

export type TraceabilityLinkWithArtifact = Prisma.TraceabilityLinkGetPayload<{
  include: {
    artifact: true;
    evidenceLinks: {
      include: {
        evidence: true;
      };
    };
  };
}>;

export type MarkdownReportRenderContext = {
  analysis: AnalysisSnapshot;
  locale: ReportLocale;
  insights: InsightWithEvidence[];
  traceabilityLinks: TraceabilityLinkWithArtifact[];
  reviewNotes: ReviewNote[];
  hasUnreviewedItems: boolean;
  dependencyEdges: ReportDependencyEdge[];
  clarifications: ClarificationItemDto[];
  reviewDecisions: any[];
  reviewDecisionsSnapshot?: any[];
  evidenceQualitySummarySnapshot?: any;
  reviewCoverageSummarySnapshot?: ReportReviewCoverageSummary;
  diff?: any;
  metadata?: ApprovedReportMetadata;
};
