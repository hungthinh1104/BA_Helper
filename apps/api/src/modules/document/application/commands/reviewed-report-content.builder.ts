import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { TraceabilityRepository, InsightRepository, EvaluationContextAdapter, freezeReportTestTrace } from '@ba-helper/backend-runtime';
import { buildEvidenceQualityProjection } from '../evidence-quality.projection';
import { GetQaCoverageUseCase } from '../../../impact-analysis/application/qa/get-qa-coverage.usecase';

@Injectable()
export class ReviewedReportContentBuilder {
  constructor(private readonly traceabilityRepo: TraceabilityRepository, private readonly insightRepo: InsightRepository,
    private readonly evaluation: EvaluationContextAdapter, private readonly coverage: GetQaCoverageUseCase) {}

  async build(params: { analysisId: string; createdByUserId?: string }) {
    const [traceabilityLinks, insights, coverage] = await Promise.all([
      this.traceabilityRepo.listByAnalysis(params.analysisId), this.insightRepo.listByAnalysis(params.analysisId),
      this.coverage.execute(params.analysisId),
    ]);
    const quality = buildEvidenceQualityProjection({ traceabilityLinks, insights: insights as any[] });
    const evaluation = this.evaluation.getEvaluationContext();
    const retained = new Set(traceabilityLinks.filter(link => link.reviewStatus !== 'REJECTED').map(link => link.artifactId));
    return { analysisId: params.analysisId, approvedDocumentId: null, markdown: null,
      reviewDecisionsSnapshot: quality.items as Prisma.InputJsonValue,
      evidenceQualitySummarySnapshot: quality.summary as Prisma.InputJsonValue,
      evaluationContextSnapshot: evaluation ? evaluation as Prisma.InputJsonValue : Prisma.DbNull,
      testTraceSnapshot: freezeReportTestTrace(coverage, retained) as unknown as Prisma.InputJsonValue,
      createdByUserId: params.createdByUserId || null };
  }
}
