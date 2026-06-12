import { Injectable, Logger } from '@nestjs/common';
import { AppError } from '../../../../shared/app-error';
import { QaCoverageResponse } from '@ba-helper/contracts';
import { ImpactGraphReadModelBuilder } from '../queries/impact-graph-read-model.builder';
import { QaCoverageDeriver } from './qa-coverage.deriver';

@Injectable()
export class GetQaCoverageUseCase {
  private readonly logger = new Logger(GetQaCoverageUseCase.name);

  constructor(
    private readonly graphBuilder: ImpactGraphReadModelBuilder,
    private readonly deriver: QaCoverageDeriver
  ) {}

  async execute(analysisId: string): Promise<QaCoverageResponse> {
    const graphData = await this.graphBuilder.buildGraph(analysisId);
    if (!graphData) {
      throw new AppError('IMPACT_ANALYSIS_NOT_FOUND', 'Could not build graph for analysis');
    }

    return this.deriver.derive(analysisId, graphData);
  }
}
