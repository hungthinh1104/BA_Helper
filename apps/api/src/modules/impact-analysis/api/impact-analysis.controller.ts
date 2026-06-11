import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import {
  impactAnalysisCreateRequestSchema,
  impactAnalysisResponseSchema,
  finalizeImpactAnalysisRequestSchema,
} from '@ba-helper/contracts';
import { CreateImpactAnalysisUseCase } from '../application/create-impact-analysis.usecase';
import { GetImpactAnalysisUseCase } from '../application/get-impact-analysis.usecase';
import { FinalizeImpactAnalysisUseCase } from '../application/finalize-impact-analysis.usecase';
import { mapImpactAnalysisResponse } from '../infrastructure/impact-analysis.mapper';

@Controller('/api/v1')
export class ImpactAnalysisController {
  constructor(
    private readonly createAnalysis: CreateImpactAnalysisUseCase,
    private readonly getAnalysis: GetImpactAnalysisUseCase,
    private readonly finalizeAnalysis: FinalizeImpactAnalysisUseCase,
  ) {}

  @Post('/requirement-revisions/:revisionId/impact-analyses')
  async create(
    @Param('revisionId') revisionId: string,
    @Body() body: unknown,
  ) {
    const input = impactAnalysisCreateRequestSchema.parse(body);
    const analysis = await this.createAnalysis.execute({
      requirementRevisionId: revisionId,
      snapshotId: input.snapshotId,
      sourceTargetId: input.sourceTargetId,
      allowPartialSnapshot: input.allowPartialSnapshot,
      requestKey: input.requestKey,
    });

    const response = impactAnalysisResponseSchema.parse(
      mapImpactAnalysisResponse({ analysis }),
    );

    return response;
  }

  @Get('/impact-analyses/:analysisId')
  async get(@Param('analysisId') analysisId: string) {
    const analysis = await this.getAnalysis.execute(analysisId);
    return impactAnalysisResponseSchema.parse(
      mapImpactAnalysisResponse({ analysis }),
    );
  }

  @Post('/impact-analyses/:analysisId/finalize')
  async finalize(
    @Param('analysisId') analysisId: string,
    @Body() body: unknown,
  ) {
    const input = finalizeImpactAnalysisRequestSchema.parse(body);
    const analysis = await this.finalizeAnalysis.execute({
      analysisId,
      acknowledgeUnreviewed: input.acknowledgeUnreviewed,
    });
    return impactAnalysisResponseSchema.parse(
      mapImpactAnalysisResponse({ analysis }),
    );
  }
}
