import { Injectable } from '@nestjs/common';
import { AppError } from '@ba-helper/shared';
import { qaCoverageResponseSchema, type QaCoverageResponse } from '@ba-helper/contracts';
import { QaTraceRepository } from '../../infrastructure/qa-trace.repository';
import { QaCoverageDeriver } from './qa-coverage.deriver';

@Injectable()
export class GetQaCoverageUseCase {
  constructor(
    private readonly repository: QaTraceRepository,
    private readonly deriver: QaCoverageDeriver
  ) {}

  async execute(analysisId: string): Promise<QaCoverageResponse> {
    const input = await this.repository.read(analysisId);
    if (!input) {
      throw new AppError('IMPACT_ANALYSIS_NOT_FOUND', 'Impact analysis not found.');
    }

    return qaCoverageResponseSchema.parse(this.deriver.derive(input));
  }
}
