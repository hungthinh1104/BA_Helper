import { Injectable, Logger } from '@nestjs/common';
import {
  ImpactGraphResponse,
} from '@ba-helper/contracts';
import { ImpactGraphReadModelBuilder } from './impact-graph-read-model.builder';

@Injectable()
export class GetImpactGraphUseCase {
  private readonly logger = new Logger(GetImpactGraphUseCase.name);

  constructor(private readonly graphBuilder: ImpactGraphReadModelBuilder) {}

  async execute(analysisId: string): Promise<ImpactGraphResponse> {
    return this.graphBuilder.buildGraph(analysisId);
  }
}
