import { Injectable } from '@nestjs/common';
import { AppError } from '../../../shared/app-error';
import { MultiRepoAnalysisRunRepository } from '../infrastructure/multi-repo-analysis-run.repository';

@Injectable()
export class GetMultiRepoAnalysisRunUseCase {
  constructor(private readonly runs: MultiRepoAnalysisRunRepository) {}

  async execute(runId: string) {
    const run = await this.runs.findById(runId);
    if (!run) {
      throw new AppError(
        'MULTI_REPO_ANALYSIS_RUN_NOT_FOUND',
        'Multi-repo analysis run not found.',
      );
    }

    return run;
  }
}
