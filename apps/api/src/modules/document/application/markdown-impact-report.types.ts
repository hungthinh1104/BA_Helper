import { Prisma, ReviewNote } from '@prisma/client';
import { ClarificationItemDto } from '@ba-helper/contracts';
import { ApprovedReportMetadata } from '../domain/approved-report-metadata';
import { ReportDependencyEdge } from './mermaid-impact-diagram.builder';
import { ReportLocale } from './render/report-localization';

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
  diff?: any;
  metadata?: ApprovedReportMetadata;
};
